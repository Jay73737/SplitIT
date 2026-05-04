import json
import os
import re
import socket
import threading
import urllib.parse
import urllib.request
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Set
from urllib.error import HTTPError

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import soundfile as sf
import yt_dlp
from yt_dlp.utils import DownloadError

from _demucs.api import Separator
from _demucs.apply import BagOfModels

app = FastAPI(
    title="SplitIT API",
    version="1.0.0",
    description=(
        "Stem-splitting API powered by Demucs. "
        "Submit a YouTube video ID or an audio file upload, poll the returned job_id for progress, "
        "then download the separated WAV stems.\n\n"
        "Interactive docs: **/api/docs** · Alternative (ReDoc): **/api/redoc**"
    ),
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# Allow any origin so third-party frontends can call the API freely.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_ROOT = Path("/var/tmp/splitit/uploads")
OUTPUT_ROOT = Path("/var/www/splitit_outputs")
UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Job registry — keyed by job_id
# Each entry: {"pct": float 0-100, "done": bool, "result": dict|None, "error": str|None}
# ---------------------------------------------------------------------------
_jobs: dict[str, dict] = {}
_jobs_lock = threading.Lock()
_executor = ThreadPoolExecutor(max_workers=2)

CONFIG_PATHS = [Path("/root/splitta/SplitIT/ui/config.json"), Path("/root/splitta/SplitIT/config.json")]
ENV_PATHS = [Path("/root/splitta/SplitIT/frontend/.env"), Path("/root/splitta/SplitIT/frontend/.env.example")]
COOKIE_PATHS = [Path("/root/splitta/SplitIT/yt_cookies.txt"), Path("/root/splitta/SplitIT/frontend/yt_cookies.txt")]

ALLOWED_MODELS = {
    "htdemucs",
    "htdemucs_ft",
    "htdemucs_6s",
    "mdx",
    "mdx_extra",
}


def parse_stems(raw: str) -> Set[str]:
    stems = {s.strip().lower() for s in raw.split(",") if s.strip()}
    if not stems:
        stems = {"vocals", "drums", "bass", "other"}
    return stems


def load_youtube_api_key() -> str:
    for config_path in CONFIG_PATHS:
        if not config_path.exists():
            continue
        try:
            payload = json.loads(config_path.read_text("utf-8"))
        except json.JSONDecodeError:
            continue
        key = payload.get("api_key") or payload.get("YOUTUBE_API_KEY") or payload.get("youtube_api_key")
        if key:
            return key
    for env_path in ENV_PATHS:
        if not env_path.exists():
            continue
        for line in env_path.read_text("utf-8").splitlines():
            if line.startswith("REACT_APP_YOUTUBE_API_KEY="):
                value = line.split("=", 1)[1].strip()
                if value:
                    return value
    return os.environ.get("YOUTUBE_API_KEY", "")


def sanitize_filename(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._ -]+", "", value).strip()
    return cleaned or "youtube-audio"


def format_duration(seconds: int | None) -> str:
    if not seconds:
        return ""
    hours, remainder = divmod(int(seconds), 3600)
    minutes, secs = divmod(remainder, 60)
    if hours:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes}:{secs:02d}"


def get_cookie_file() -> str | None:
    configured = os.environ.get("YTDLP_COOKIE_FILE")
    if configured and Path(configured).exists():
        return configured
    for path in COOKIE_PATHS:
        if path.exists():
            return str(path)
    return None


def get_proxy() -> str | None:
    """Return a proxy URL if one is configured or the SSH tunnel is active."""
    configured = os.environ.get("YTDLP_PROXY")
    if configured:
        return configured
    # Auto-detect SSH reverse SOCKS5 tunnel on port 1080
    try:
        with socket.create_connection(("127.0.0.1", 1080), timeout=0.5):
            return "socks5://127.0.0.1:1080"
    except OSError:
        return None


def run_split(source_path: Path, model: str, stems: str, shifts: int = 1, overlap: float = 0.5, job_id: str | None = None) -> dict:
    selected_model = model.strip()
    if selected_model not in ALLOWED_MODELS:
        raise HTTPException(status_code=400, detail=f"Unsupported model: {selected_model}")

    wanted_stems = parse_stems(stems)
    if job_id is None:
        job_id = str(uuid.uuid4())
    out_dir = OUTPUT_ROOT / job_id
    out_dir.mkdir(parents=True, exist_ok=True)

    # --- progress callback ---------------------------------------------------
    _progress_state: dict = {"segment_total": None, "completed_frames": 0}

    def _progress_callback(info: dict) -> None:
        if info.get("state") != "end":
            return
        audio_length = info.get("audio_length") or 1
        models_count = info.get("models") or 1
        model_idx = info.get("model_idx_in_bag", 0)
        shift_idx = info.get("shift_idx", 0)
        seg_offset = info.get("segment_offset", 0)

        # Approximate fraction: weight each (model, shift) pass equally.
        # segment_offset is the START of the chunk that just finished.
        # We accumulate offset progress across passes.
        total_passes = models_count * shifts
        passes_done = model_idx * shifts + shift_idx
        within_pass = min(seg_offset / audio_length, 1.0)
        raw_pct = (passes_done + within_pass) / total_passes * 90  # cap at 90% until export done
        with _jobs_lock:
            if job_id in _jobs:
                _jobs[job_id]["pct"] = round(raw_pct, 1)

    # -------------------------------------------------------------------------
    separator = Separator(selected_model, shifts=shifts, split=True, overlap=overlap, progress=False,
                          callback=_progress_callback)

    # For htdemucs_ft: each sub-model in the bag corresponds to exactly one stem
    # (weights are identity rows).  Drop sub-models whose stem isn't requested so
    # we skip their inference entirely — same result, faster run.
    if selected_model == "htdemucs_ft":
        inner = separator._model  # BagOfModels instance
        if isinstance(inner, BagOfModels):
            sources = inner.sources  # e.g. ['drums','bass','other','vocals']
            keep_models = []
            keep_weights = []
            for sub_model, weight_row in zip(list(inner.models), inner.weights):
                # Check whether this sub-model contributes any wanted stem
                contributes = any(
                    weight_row[i] != 0.0 and sources[i] in wanted_stems
                    for i in range(len(sources))
                )
                if contributes:
                    keep_models.append(sub_model)
                    keep_weights.append(weight_row)
            if keep_models:
                inner.models = type(inner.models)(keep_models)  # nn.ModuleList
                inner.weights = keep_weights

    _, separated = separator.separate_audio_file(source_path)

    output_files = []
    for stem_name, audio_tensor in separated.items():
        stem = stem_name.lower()
        if stem not in wanted_stems:
            continue
        stem_path = out_dir / f"{stem}.wav"
        export_wav(audio_tensor, stem_path, separator.samplerate)
        output_files.append(f"/outputs/{job_id}/{stem}.wav")

    if not output_files:
        raise HTTPException(status_code=400, detail="No stems were produced for selected options")

    return {
        "job_id": job_id,
        "model": selected_model,
        "stems": sorted(wanted_stems),
        "files": output_files,
    }


def youtube_search(query: str, limit: int = 8) -> list[dict]:
    api_key = load_youtube_api_key()
    if api_key:
        try:
            params = urllib.parse.urlencode(
                {
                    "part": "snippet",
                    "q": query,
                    "maxResults": limit,
                    "type": "video",
                    "key": api_key,
                }
            )
            with urllib.request.urlopen(f"https://www.googleapis.com/youtube/v3/search?{params}", timeout=12) as response:
                payload = json.loads(response.read().decode("utf-8"))

            ids = [item["id"].get("videoId") for item in payload.get("items", []) if item.get("id", {}).get("videoId")]
            durations = {}
            if ids:
                duration_params = urllib.parse.urlencode(
                    {
                        "part": "contentDetails",
                        "id": ",".join(ids),
                        "key": api_key,
                    }
                )
                with urllib.request.urlopen(f"https://www.googleapis.com/youtube/v3/videos?{duration_params}", timeout=12) as response:
                    video_payload = json.loads(response.read().decode("utf-8"))
                for item in video_payload.get("items", []):
                    durations[item["id"]] = item.get("contentDetails", {}).get("duration", "")

            results = []
            for item in payload.get("items", []):
                video_id = item.get("id", {}).get("videoId")
                if not video_id:
                    continue
                snippet = item["snippet"]
                results.append(
                    {
                        "id": video_id,
                        "title": snippet["title"],
                        "thumb": snippet["thumbnails"]["medium"]["url"],
                        "channel": snippet["channelTitle"],
                        "duration": durations.get(video_id, ""),
                        "url": f"https://www.youtube.com/watch?v={video_id}",
                    }
                )
            if results:
                return results
        except HTTPError:
            pass
        except Exception:
            pass

    search_query = f"ytsearch{limit}:{query}"
    search_options = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "extract_flat": True,
    }
    with yt_dlp.YoutubeDL(search_options) as downloader:
        payload = downloader.extract_info(search_query, download=False)

    results = []
    for item in payload.get("entries", []) or []:
        if not item:
            continue
        video_id = item.get("id")
        if not video_id:
            continue
        thumbnail = item.get("thumbnail")
        if not thumbnail and item.get("thumbnails"):
            thumbnail = item["thumbnails"][-1].get("url")
        results.append(
            {
                "id": video_id,
                "title": item.get("title") or video_id,
                "thumb": thumbnail or "",
                "channel": item.get("uploader") or item.get("channel") or "YouTube",
                "duration": format_duration(item.get("duration")),
                "url": f"https://www.youtube.com/watch?v={video_id}",
            }
        )
    return results


def download_youtube_audio(video_id: str, destination: Path) -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    base_template = str(destination.with_suffix(""))
    options = {
        "format": "bestaudio/best",
        "outtmpl": base_template,
        "postprocessors": [{"key": "FFmpegExtractAudio", "preferredcodec": "wav"}],
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "js_runtimes": {"node": {}},
        "socket_timeout": 20,
        "retries": 1,
        "fragment_retries": 1,
        "extractor_retries": 1,
    }
    cookie_file = get_cookie_file()
    if cookie_file:
        options["cookiefile"] = cookie_file
    proxy = get_proxy()
    if proxy:
        options["proxy"] = proxy
    url = f"https://www.youtube.com/watch?v={video_id}"
    try:
        with yt_dlp.YoutubeDL(options) as downloader:
            info = downloader.extract_info(url, download=True)
            requested = sanitize_filename(info.get("title") or video_id)
    except DownloadError as exc:
        if get_proxy() is None:
            raise HTTPException(
                status_code=502,
                detail="youtube blocked: SSH tunnel is not connected. On your PC run: ssh -N -o ServerAliveInterval=15 -R 1080 root@split.clamzz.com — then try again.",
            ) from exc
        raise HTTPException(
            status_code=502,
            detail="youtube blocked: YouTube rejected the download even through the tunnel. Your cookies may have expired — try re-exporting them from your browser.",
        ) from exc

    wav_path = destination.with_suffix(".wav")
    if wav_path.exists():
        return wav_path

    named_wav = destination.parent / f"{requested}.wav"
    if named_wav.exists():
        named_wav.replace(wav_path)
        return wav_path

    raise HTTPException(status_code=500, detail="Downloaded YouTube audio could not be located")


def export_wav(audio_tensor, path: Path, samplerate: int) -> None:
    audio = audio_tensor.detach().cpu().transpose(0, 1).numpy()
    sf.write(path, audio, samplerate, subtype="FLOAT")


@app.get("/api/health", tags=["Meta"])
def health() -> dict:
    """Check that the API is reachable and running.

    Returns `{"status": "ok"}` when healthy.
    """
    return {"status": "ok"}


@app.get("/api/status", tags=["Meta"])
def server_status() -> dict:
    """Live capability status — poll this to show tunnel/cookie indicators in the UI."""
    return {
        "tunnel": get_proxy() is not None,
        "cookies": get_cookie_file() is not None,
    }


@app.get("/api/job/{job_id}", tags=["Jobs"])
def job_status(job_id: str) -> dict:
    """Poll the status of a running or finished split job.

    **Poll this every ~800 ms after submitting a split request.**

    Response fields:
    - `pct` – progress percentage 0-100 (float)
    - `done` – `true` once processing has finished
    - `result` – the final split payload (same shape as a synchronous result) once `done` is `true`
    - `error` – error message string if the job failed, otherwise `null`

    ```json
    // In-progress
    { "pct": 42.5, "done": false, "result": null, "error": null }

    // Finished successfully
    {
      "pct": 100,
      "done": true,
      "error": null,
      "result": {
        "job_id": "<uuid>",
        "model": "htdemucs",
        "stems": ["bass", "drums", "other", "vocals"],
        "files": ["/outputs/<uuid>/vocals.wav", ...]
      }
    }
    ```

    Returns **404** if the job_id is unknown (never submitted or server restarted).
    """
    with _jobs_lock:
        entry = _jobs.get(job_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Unknown job")
    return entry


@app.get("/api/youtube/search", tags=["YouTube"])
def youtube_search_endpoint(q: str, limit: int = 8) -> dict:
    """Search YouTube for tracks.

    Query params:
    - `q` – search query string (required)
    - `limit` – max results to return, default 8

    ```json
    {
      "items": [
        {
          "id": "dQw4w9WgXcQ",
          "title": "Rick Astley - Never Gonna Give You Up",
          "channel": "RickAstleyVEVO",
          "thumb": "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
          "duration": "3:33"
        }
      ]
    }
    ```
    """
    if not q.strip():
        raise HTTPException(status_code=400, detail="Missing search query")
    return {"items": youtube_search(q.strip(), limit=limit)}


def _run_youtube_split_job(job_id: str, video_id: str, model: str, stems: str, shifts: int, overlap: float) -> None:
    temp_source = UPLOAD_ROOT / f"youtube_{job_id}_{video_id}.wav"
    try:
        source_path = download_youtube_audio(video_id.strip(), temp_source)
        result = run_split(source_path, model, stems, shifts=shifts, overlap=overlap, job_id=job_id)
        with _jobs_lock:
            _jobs[job_id].update({"pct": 100, "done": True, "result": result})
    except HTTPException as exc:
        with _jobs_lock:
            _jobs[job_id].update({"done": True, "error": exc.detail})
    except Exception as exc:
        with _jobs_lock:
            _jobs[job_id].update({"done": True, "error": f"YouTube split failed: {exc}"})
    finally:
        temp_source.unlink(missing_ok=True)


@app.post("/api/youtube/split", tags=["YouTube"])
def split_youtube_audio(
    video_id: str = Form(..., description="YouTube video ID (the part after `?v=`)"),
    model: str = Form("htdemucs_ft", description="Demucs model name. One of: htdemucs, htdemucs_ft, htdemucs_6s, mdx, mdx_extra"),
    stems: str = Form("vocals,drums,bass,other", description="Comma-separated list of stems to extract"),
    shifts: int = Form(1, description="Number of random shifts (higher = better quality, slower)"),
    overlap: float = Form(0.5, description="Overlap between segments (0.0–1.0)"),
) -> dict:
    """Download a YouTube track by video ID and split it into stems.

    Submits the job asynchronously. Poll `GET /api/job/{job_id}` for progress.

    **Request** – multipart/form-data:
    - `video_id` (required) – e.g. `dQw4w9WgXcQ`
    - `model` – default `htdemucs`
    - `stems` – default `vocals,drums,bass,other`
    - `shifts` – default `1`
    - `overlap` – default `0.5`

    **Response** – `202 Accepted`:
    ```json
    { "job_id": "<uuid>" }
    ```

    Returns **502** if YouTube blocks the server-side download.
    """
    job_id = str(uuid.uuid4())
    with _jobs_lock:
        _jobs[job_id] = {"pct": 0, "done": False, "result": None, "error": None}
    _executor.submit(_run_youtube_split_job, job_id, video_id, model, stems, shifts, overlap)
    return {"job_id": job_id}


def _run_upload_split_job(job_id: str, upload_path: Path, model: str, stems: str, shifts: int, overlap: float) -> None:
    try:
        result = run_split(upload_path, model, stems, shifts=shifts, overlap=overlap, job_id=job_id)
        with _jobs_lock:
            _jobs[job_id].update({"pct": 100, "done": True, "result": result})
    except HTTPException as exc:
        with _jobs_lock:
            _jobs[job_id].update({"done": True, "error": exc.detail})
    except Exception as exc:
        with _jobs_lock:
            _jobs[job_id].update({"done": True, "error": f"Split failed: {exc}"})
    finally:
        upload_path.unlink(missing_ok=True)


@app.post("/api/split", tags=["Upload"])
async def split_audio(
    file: UploadFile = File(..., description="Audio file to split (WAV, MP3, FLAC, etc.)"),
    model: str = Form("htdemucs_ft", description="Demucs model name. One of: htdemucs, htdemucs_ft, htdemucs_6s, mdx, mdx_extra"),
    stems: str = Form("vocals,drums,bass,other", description="Comma-separated list of stems to extract"),
    shifts: int = Form(1, description="Number of random shifts (higher = better quality, slower)"),
    overlap: float = Form(0.5, description="Overlap between segments (0.0–1.0)"),
) -> dict:
    """Upload a local audio file and split it into stems.

    Submits the job asynchronously. Poll `GET /api/job/{job_id}` for progress.

    **Request** – multipart/form-data:
    - `file` (required) – the audio file
    - `model` – default `htdemucs`
    - `stems` – default `vocals,drums,bass,other`
    - `shifts` – default `1`
    - `overlap` – default `0.5`

    **Response** – `200 OK`:
    ```json
    { "job_id": "<uuid>" }
    ```
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    upload_path = UPLOAD_ROOT / f"{uuid.uuid4()}_{Path(file.filename).name}"
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    upload_path.write_bytes(data)

    job_id = str(uuid.uuid4())
    with _jobs_lock:
        _jobs[job_id] = {"pct": 0, "done": False, "result": None, "error": None}
    _executor.submit(_run_upload_split_job, job_id, upload_path, model, stems, shifts, overlap)
    return {"job_id": job_id}
