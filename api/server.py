import os
import uuid
import shutil
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
import yt_dlp  # pip install yt-dlp

# Where we cache downloaded/converted audio
DATA_DIR = Path("./data/audio_cache")
DATA_DIR.mkdir(parents=True, exist_ok=True)

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

def _download_audio_to_cache(src_url: str, fmt: str) -> Path:
    uid = str(uuid.uuid4())
    ext = "mp3" if fmt == "mp3" else ("opus" if fmt == "opus" else "wav")
    final_path = DATA_DIR / f"{uid}.{ext}"

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
            shutil.move(produced, final_path)

    return final_path

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