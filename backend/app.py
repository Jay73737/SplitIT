from __future__ import annotations

import os
import shutil
import threading
import uuid
from datetime import datetime
from pathlib import Path
from typing import Literal

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from split_service import split_audio_file
import youtube_service


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("SPLITIT_DATA_DIR") or (BASE_DIR / "data"))
UPLOAD_DIR = DATA_DIR / "uploads"
OUTPUT_DIR = DATA_DIR / "outputs"
ARCHIVE_DIR = DATA_DIR / "archives"
YT_DOWNLOAD_DIR = DATA_DIR / "youtube"

for folder in (UPLOAD_DIR, OUTPUT_DIR, ARCHIVE_DIR, YT_DOWNLOAD_DIR):
    folder.mkdir(parents=True, exist_ok=True)


JobStatus = Literal["queued", "running", "completed", "failed"]


class JobStore:
    def __init__(self) -> None:
        self._jobs: dict[str, dict] = {}
        self._lock = threading.Lock()

    def create(self, payload: dict) -> str:
        job_id = uuid.uuid4().hex
        with self._lock:
            self._jobs[job_id] = {
                "id": job_id,
                "status": "queued",
                "created_at": datetime.utcnow().isoformat() + "Z",
                "updated_at": datetime.utcnow().isoformat() + "Z",
                "error": None,
                "download_url": None,
                "payload": payload,
            }
        return job_id

    def update(self, job_id: str, **changes) -> None:
        with self._lock:
            if job_id not in self._jobs:
                return
            self._jobs[job_id].update(changes)
            self._jobs[job_id]["updated_at"] = datetime.utcnow().isoformat() + "Z"

    def get(self, job_id: str) -> dict | None:
        with self._lock:
            job = self._jobs.get(job_id)
            return dict(job) if job else None


store = JobStore()
app = FastAPI(title="SplitIT Web API", version="1.0.0")

_cors_origins_env = os.environ.get("SPLITIT_CORS_ORIGINS")
_cors_origins = [o.strip() for o in _cors_origins_env.split(",")] if _cors_origins_env else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _run_job(job_id: str, input_path: Path, models: list[str], instruments: list[str], shifts: int, overlap: float, device: str):
    try:
        store.update(job_id, status="running")
        output_dir = split_audio_file(
            input_path=input_path,
            output_root=OUTPUT_DIR,
            models=models,
            instruments=instruments,
            shifts=shifts,
            overlap=overlap,
            requested_device=device,
        )

        archive_base = ARCHIVE_DIR / f"{job_id}"
        archive_file = shutil.make_archive(str(archive_base), "zip", root_dir=output_dir)
        store.update(
            job_id,
            status="completed",
            download_url=f"/api/jobs/{job_id}/download",
            archive_file=archive_file,
            stem_dir=str(output_dir),
        )
    except Exception as exc:
        store.update(job_id, status="failed", error=str(exc))


@app.get("/api/health")
def health():
    return {"ok": True}


@app.post("/api/jobs")
async def create_job(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    model: str = Form("htdemucs"),
    instruments: str = Form("vocals,drums,bass,other"),
    shifts: int = Form(1),
    overlap: float = Form(0.5),
    device: str = Form("cuda:0"),
):
    suffix = Path(file.filename or "upload.wav").suffix or ".wav"
    job_file = UPLOAD_DIR / f"{uuid.uuid4().hex}{suffix}"

    with job_file.open("wb") as out:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            out.write(chunk)

    model_names = [m.strip() for m in model.split(",") if m.strip()]
    instrument_list = [i.strip() for i in instruments.split(",") if i.strip()]

    payload = {
        "filename": file.filename,
        "model": model_names,
        "instruments": instrument_list,
        "shifts": shifts,
        "overlap": overlap,
        "device": device,
    }
    job_id = store.create(payload)

    background_tasks.add_task(
        _run_job,
        job_id,
        job_file,
        model_names,
        instrument_list,
        shifts,
        overlap,
        device,
    )

    return {"job_id": job_id, "status_url": f"/api/jobs/{job_id}"}


@app.get("/api/jobs/{job_id}")
def job_status(job_id: str):
    job = store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "id": job["id"],
        "status": job["status"],
        "error": job["error"],
        "download_url": job["download_url"],
        "created_at": job["created_at"],
        "updated_at": job["updated_at"],
    }


@app.get("/api/jobs/{job_id}/download")
def download_job(job_id: str):
    job = store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.get("status") != "completed" or not job.get("archive_file"):
        raise HTTPException(status_code=409, detail="Job not completed")

    archive_path = Path(job["archive_file"])
    if not archive_path.exists():
        raise HTTPException(status_code=404, detail="Archive missing")

    return FileResponse(archive_path, media_type="application/zip", filename=f"splitit-{job_id}.zip")


def _resolve_stem_path(job: dict, stem_name: str) -> Path:
    stem_dir = job.get("stem_dir")
    if not stem_dir:
        raise HTTPException(status_code=409, detail="Job has no stems available")
    base = Path(stem_dir).resolve()
    candidate = (base / f"{stem_name}.wav").resolve()
    # Defense in depth: never let a crafted stem name escape the stem dir
    try:
        candidate.relative_to(base)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid stem name")
    if not candidate.is_file():
        raise HTTPException(status_code=404, detail=f"Stem '{stem_name}' not found")
    return candidate


@app.get("/api/jobs/{job_id}/stems")
def list_stems(job_id: str):
    job = store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.get("status") != "completed":
        raise HTTPException(status_code=409, detail="Job not completed")
    stem_dir = job.get("stem_dir")
    if not stem_dir or not Path(stem_dir).is_dir():
        raise HTTPException(status_code=404, detail="Stem directory missing")

    stems = []
    for path in sorted(Path(stem_dir).iterdir()):
        if path.is_file() and path.suffix.lower() == ".wav":
            stems.append({
                "name": path.stem,
                "filename": path.name,
                "size_bytes": path.stat().st_size,
                "url": f"/api/jobs/{job_id}/stems/{path.stem}",
                "local_path": str(path.resolve()),
            })
    return {"job_id": job_id, "stems": stems}


@app.get("/api/jobs/{job_id}/stems/{stem_name}")
def stream_stem(job_id: str, stem_name: str):
    job = store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.get("status") != "completed":
        raise HTTPException(status_code=409, detail="Job not completed")

    path = _resolve_stem_path(job, stem_name)
    return FileResponse(path, media_type="audio/wav", filename=path.name)


@app.get("/api/youtube/search")
def youtube_search(q: str, limit: int = 8):
    if not q.strip():
        raise HTTPException(status_code=400, detail="Query is required")
    try:
        return {"items": youtube_service.search_youtube(q, limit=limit)}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"YouTube search failed: {exc}")


def _run_youtube_job(job_id: str, video_id: str, models: list[str], instruments: list[str], shifts: int, overlap: float, device: str):
    try:
        store.update(job_id, status="downloading")
        wav_path = youtube_service.download_audio(video_id, YT_DOWNLOAD_DIR)
        _run_job(job_id, wav_path, models, instruments, shifts, overlap, device)
    except Exception as exc:
        store.update(job_id, status="failed", error=str(exc))


@app.post("/api/youtube/jobs")
def create_youtube_job(
    background_tasks: BackgroundTasks,
    video_id: str = Form(...),
    model: str = Form("htdemucs"),
    instruments: str = Form("vocals,drums,bass,other"),
    shifts: int = Form(1),
    overlap: float = Form(0.5),
    device: str = Form("cuda:0"),
):
    if not video_id.strip():
        raise HTTPException(status_code=400, detail="video_id is required")

    model_names = [m.strip() for m in model.split(",") if m.strip()]
    instrument_list = [i.strip() for i in instruments.split(",") if i.strip()]

    payload = {
        "video_id": video_id,
        "model": model_names,
        "instruments": instrument_list,
        "shifts": shifts,
        "overlap": overlap,
        "device": device,
        "source": "youtube",
    }
    job_id = store.create(payload)

    background_tasks.add_task(
        _run_youtube_job,
        job_id,
        video_id,
        model_names,
        instrument_list,
        shifts,
        overlap,
        device,
    )

    return {"job_id": job_id, "status_url": f"/api/jobs/{job_id}"}
