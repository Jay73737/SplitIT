"""YouTube search + audio download for local SplitIT use.

Search uses yt-dlp's built-in ytsearch extractor (no API key, no quota).
Download uses yt-dlp + ffmpeg postprocessor to extract a .wav we can hand
straight to the splitter.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Optional

import yt_dlp


_INVALID_FS_CHARS = re.compile(r'[\\/:*?"<>|]')


def _sanitize_filename(value: str) -> str:
    cleaned = _INVALID_FS_CHARS.sub("_", value).strip()
    return cleaned[:160] or "track"


def _resolve_ffmpeg() -> Optional[str]:
    """Find ffmpeg, in priority order:
    1. SPLITIT_FFMPEG_DIR / DEMUCS_FFMPEG_DIR env var (directory)
    2. imageio-ffmpeg bundled binary
    3. None - yt-dlp will fall back to PATH search
    """
    import os

    for env_key in ("SPLITIT_FFMPEG_DIR", "DEMUCS_FFMPEG_DIR"):
        candidate = os.environ.get(env_key)
        if candidate and Path(candidate).is_dir():
            return candidate
    try:
        import imageio_ffmpeg
        exe = imageio_ffmpeg.get_ffmpeg_exe()
        if exe and Path(exe).is_file():
            return exe
    except Exception:
        pass
    return None


def search_youtube(query: str, limit: int = 8) -> list[dict]:
    """Search YouTube via yt-dlp's flat extractor. No API key needed."""
    if not query.strip():
        return []
    options = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": "in_playlist",
        "skip_download": True,
        "default_search": f"ytsearch{max(1, min(int(limit), 25))}",
    }
    with yt_dlp.YoutubeDL(options) as ydl:
        info = ydl.extract_info(query, download=False)

    entries = info.get("entries") or []
    results: list[dict] = []
    for entry in entries:
        if not entry:
            continue
        video_id = entry.get("id")
        if not video_id:
            continue
        thumbnails = entry.get("thumbnails") or []
        thumb = thumbnails[-1]["url"] if thumbnails else (entry.get("thumbnail") or "")
        results.append({
            "id": video_id,
            "title": entry.get("title") or video_id,
            "channel": entry.get("channel") or entry.get("uploader") or "",
            "duration": entry.get("duration") or 0,
            "thumb": thumb,
            "url": entry.get("url") or f"https://www.youtube.com/watch?v={video_id}",
        })
    return results


def download_audio(video_id: str, destination_dir: Path, cookies_file: Optional[Path] = None) -> Path:
    """Download YouTube audio as .wav. Returns path to the produced file."""
    import os

    destination_dir.mkdir(parents=True, exist_ok=True)
    template = str(destination_dir / f"{video_id}.%(ext)s")

    options = {
        "format": "bestaudio/best",
        "outtmpl": template,
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "wav",
        }],
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "socket_timeout": 30,
        "retries": 2,
    }
    ffmpeg_path = _resolve_ffmpeg()
    if ffmpeg_path:
        options["ffmpeg_location"] = ffmpeg_path
    if cookies_file and cookies_file.is_file():
        options["cookiefile"] = str(cookies_file)

    url = f"https://www.youtube.com/watch?v={video_id}"
    with yt_dlp.YoutubeDL(options) as ydl:
        info = ydl.extract_info(url, download=True)

    wav_path = destination_dir / f"{video_id}.wav"
    if wav_path.exists():
        title = info.get("title") or video_id
        sanitized = _sanitize_filename(title)
        renamed = destination_dir / f"{sanitized}.wav"
        try:
            wav_path.replace(renamed)
            return renamed
        except OSError:
            return wav_path

    # Fallback: yt-dlp may have used the resolved title in the path
    candidates = list(destination_dir.glob(f"{video_id}*.wav"))
    if candidates:
        return candidates[0]
    raise RuntimeError(f"yt-dlp finished but no .wav produced for {video_id}")
