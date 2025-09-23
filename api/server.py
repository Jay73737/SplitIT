import os
import uuid
import shutil
import tempfile
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
import yt_dlp  # pip install yt-dlp
from demucs import pretrained
from demucs.separate import apply_model, save_audio, load_track
import torch

# Where we cache downloaded/converted audio
DATA_DIR = Path("./data/audio_cache")
DATA_DIR.mkdir(parents=True, exist_ok=True)

STEMS_DIR = Path("./data/stem_cache")
STEMS_DIR.mkdir(parents=True, exist_ok=True)

SUPPORTED_FORMATS = {
    "mp3": ".mp3",
    "opus": ".opus",
    "wav": ".wav",
}

MODEL_MAP = {
    "ht-demucs-v4": "htdemucs_6s",
    "mdxnet-hq": "mdx_extra_q",
}

split_jobs: Dict[str, Dict[str, Any]] = {}
split_jobs_lock = threading.Lock()
split_executor = ThreadPoolExecutor(max_workers=1)

app = FastAPI(title="SplitMe Audio API")

# DEV CORS (lock down origins in prod)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class DownloadReq(BaseModel):
    sourceUrl: str
    format: Optional[str] = "mp3"  # "mp3" | "opus" | "wav"


class SplitAudioReq(BaseModel):
    audioId: str
    stems: List[str]
    model: Optional[str] = "ht-demucs-v4"


def _looks_like_audio(header: bytes) -> bool:
    """Best-effort sniffing of common audio container headers."""

    if not header:
        return False

    sample = header[:16]

    if sample.startswith(b"ID3"):
        return True
    if sample[:2] in (b"\xFF\xFB", b"\xFF\xF3", b"\xFF\xF2"):
        return True

    if sample.startswith(b"RIFF"):
        return True

    if sample.startswith(b"OggS"):
        return True

    if sample.startswith(b"fLaC"):
        return True

    if len(sample) >= 12 and sample[4:8] == b"ftyp":
        return True

    return False


def _download_audio_to_cache(src_url: str, fmt: str) -> Path:
    fmt = (fmt or "mp3").lower()
    if fmt not in SUPPORTED_FORMATS:
        raise RuntimeError(f"Unsupported audio format '{fmt}'.")

    uid = str(uuid.uuid4())
    expected_suffix = SUPPORTED_FORMATS[fmt]
    ext = expected_suffix.lstrip(".")
    final_path = DATA_DIR / f"{uid}{expected_suffix}"

    with tempfile.TemporaryDirectory() as tmpdir:
        outtmpl = str(Path(tmpdir) / f"%(id)s.%(ext)s")
        ydl_opts = {
            "format": "bestaudio/best",
            "outtmpl": outtmpl,
            "quiet": True,
            "noprogress": True,
            "postprocessors": [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": ext,
                    "preferredquality": "192",
                }
            ],
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(src_url, download=True)
            produced = None
            if "requested_downloads" in info and info["requested_downloads"]:
                produced = info["requested_downloads"][0].get("filepath")
            if not produced:
                for p in Path(tmpdir).glob(f"*.{ext}"):
                    produced = str(p)
                    break
            if not produced or not os.path.exists(produced):
                raise RuntimeError("Audio conversion failed; no output found.")

            produced_path = Path(produced)
            try:
                with produced_path.open("rb") as fh:
                    header = fh.read(32)
            except OSError:
                header = b""

            if not _looks_like_audio(header):
                produced_path.unlink(missing_ok=True)
                raise RuntimeError(
                    "Downloaded data is not an audio stream. The video may have audio downloads disabled."
                )

            actual_suffix = produced_path.suffix.lower()
            if actual_suffix != expected_suffix:
                produced_path.unlink(missing_ok=True)
                raise RuntimeError(
                    "Audio conversion did not produce the requested format. "
                    "Ensure FFmpeg is installed and accessible."
                )

            shutil.move(str(produced_path), final_path)

    return final_path


VALID_STEMS = {"vocals", "drums", "bass", "guitar", "piano", "other"}


def _normalize_stems(stems: List[str]) -> List[str]:
    cleaned: List[str] = []
    for stem in stems:
        if not stem:
            continue
        name = stem.strip().lower()
        if not name or name not in VALID_STEMS:
            continue
        if name not in cleaned:
            cleaned.append(name)
    return cleaned


def _locate_audio_file(audio_id: str) -> Path:
    matches = list(DATA_DIR.glob(f"{audio_id}.*"))
    if not matches:
        raise FileNotFoundError(f"Cached audio with id '{audio_id}' not found.")
    return matches[0]


def _set_job_state(job_id: str, **updates: Any) -> None:
    with split_jobs_lock:
        job = split_jobs.get(job_id)
        if not job:
            job = {}
            split_jobs[job_id] = job
        job.update(updates)


def _run_split_job(
    job_id: str,
    audio_path: Path,
    requested_stems: List[str],
    model_alias: str,
    model_key: str,
) -> None:
    _set_job_state(job_id, status="processing")
    try:
        # Load the pretrained model
        model = pretrained.get_model(model_key)

        job_dir = STEMS_DIR / audio_path.stem / job_id
        job_dir.mkdir(parents=True, exist_ok=True)

        # Load the audio track
        wav = load_track(str(audio_path), model.audio_channels, model.samplerate)

        # Apply the model
        ref = wav.mean(0)
        wav = (wav - ref.mean()) / ref.std()
        sources = apply_model(model, wav[None], device='cpu')[0]

        # Get the sample rate from the model
        sample_rate = model.samplerate

        # Map tensor indices to stem names based on model type
        stem_mapping = {
            'htdemucs_6s': ['drums', 'bass', 'other', 'vocals', 'guitar', 'piano'],
            'mdx_extra_q': ['drums', 'bass', 'other', 'vocals']
        }

        stem_names = stem_mapping.get(model_key, ['drums', 'bass', 'other', 'vocals'])

        results = []
        for i, stem_name in enumerate(stem_names):
            if stem_name not in requested_stems:
                continue
            if i >= sources.shape[0]:
                continue

            output_path = job_dir / f"{stem_name}.wav"

            # Save the audio tensor using demucs save_audio
            save_audio(sources[i], str(output_path), sample_rate, as_float=True)

            duration_seconds = float(sources[i].shape[-1] / sample_rate)
            results.append(
                {
                    "stem": stem_name,
                    "duration": duration_seconds,
                    "path": str(output_path),
                }
            )

        if not results:
            raise RuntimeError(
                "Requested stems were not produced by the selected model. Try different stem choices or a different model."
            )

        _set_job_state(
            job_id,
            status="completed",
            results=results,
            output_dir=str(job_dir),
            model=model_alias,
            model_key=model_key,
        )
    except Exception as exc:  # noqa: BLE001
        _set_job_state(job_id, status="error", error=str(exc))


def _submit_split_job(audio_id: str, stems: List[str], model_alias: str) -> str:
    requested_stems = _normalize_stems(stems)
    if not requested_stems:
        raise ValueError("No valid stems selected for splitting.")

    audio_path = _locate_audio_file(audio_id)
    model_key = MODEL_MAP.get(model_alias, MODEL_MAP.get("ht-demucs-v4", "htdemucs_6s"))

    job_id = str(uuid.uuid4())
    with split_jobs_lock:
        split_jobs[job_id] = {
            "status": "queued",
            "audio_id": audio_path.stem,
            "audio_path": str(audio_path),
            "requested_stems": requested_stems,
            "model": model_alias,
            "model_key": model_key,
        }

    split_executor.submit(
        _run_split_job,
        job_id,
        audio_path,
        requested_stems,
        model_alias,
        model_key,
    )
    return job_id


@app.get("/api/health")
def health():
    return {"ok": True}


@app.post("/api/download-audio")
def download_audio(req: DownloadReq):
    try:
        audio_path = _download_audio_to_cache(req.sourceUrl, req.format or "mp3")
        return {
            "id": audio_path.stem,
            "filename": audio_path.name,
            "mime": (
                "audio/mpeg" if audio_path.suffix == ".mp3"
                else "audio/ogg" if audio_path.suffix == ".opus"
                else "audio/wav"
            ),
            "streamUrl": f"/api/audio/{audio_path.stem}",
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/audio/{audio_id}")
def stream_audio(audio_id: str):
    matches = list(DATA_DIR.glob(f"{audio_id}.*"))
    if not matches:
        raise HTTPException(status_code=404, detail="Audio not found")
    p = matches[0]
    mime = (
        "audio/mpeg" if p.suffix == ".mp3"
        else "audio/ogg" if p.suffix == ".opus"
        else "audio/wav"
    )
    return FileResponse(path=str(p), media_type=mime, filename=p.name)


@app.post("/api/split-audio")
def split_audio(req: SplitAudioReq):
    try:
        job_id = _submit_split_job(req.audioId, req.stems, req.model or "ht-demucs-v4")
        return {"jobId": job_id, "status": "queued"}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/split-audio/{job_id}")
def split_audio_status(job_id: str):
    job = split_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Split job not found")

    response: Dict[str, Any] = {
        "jobId": job_id,
        "status": job.get("status", "unknown"),
        "audioId": job.get("audio_id"),
        "model": job.get("model"),
    }

    status = response["status"]
    if status == "completed":
        results = []
        for item in job.get("results", []):
            results.append(
                {
                    "stem": item.get("stem"),
                    "duration": item.get("duration"),
                    "streamUrl": f"/api/split-audio/{job_id}/stems/{item.get('stem')}",
                }
            )
        response["results"] = results
    elif status == "error":
        response["error"] = job.get("error", "Unknown error")

    return response


@app.get("/api/split-audio/{job_id}/stems/{stem_name}")
def get_split_stem(job_id: str, stem_name: str):
    job = split_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Split job not found")

    if job.get("status") != "completed":
        raise HTTPException(status_code=409, detail="Split job not completed yet")

    target_name = (stem_name or "").strip().lower()
    for item in job.get("results", []):
        if item.get("stem") == target_name:
            path_str = item.get("path")
            if not path_str:
                break
            path = Path(path_str)
            if not path.exists():
                raise HTTPException(status_code=404, detail="Stem file not found")
            return FileResponse(
                path=str(path),
                media_type="audio/wav",
                filename=path.name,
            )

    raise HTTPException(status_code=404, detail="Stem not available")


@app.delete("/api/audio/{audio_id}")
def delete_audio(audio_id: str):
    matches = list(DATA_DIR.glob(f"{audio_id}.*"))
    if not matches:
        return JSONResponse(status_code=200, content={"deleted": False})
    for p in matches:
        try:
            p.unlink(missing_ok=True)
        except Exception:
            pass
    return {"deleted": True}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
