from __future__ import annotations

import json
import os
import socket
import sys
import threading
from pathlib import Path


def _frozen_data_root() -> Path:
    if sys.platform == "win32":
        base = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
    elif sys.platform == "darwin":
        base = Path.home() / "Library" / "Application Support"
    else:
        base = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share"))
    return base / "SplitIT" / "data"


def _pick_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def main() -> None:
    is_frozen = getattr(sys, "frozen", False)

    if is_frozen:
        os.environ.setdefault("SPLITIT_DATA_DIR", str(_frozen_data_root()))

    backend_dir = Path(__file__).resolve().parent
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))

    import uvicorn
    from app import app

    port = int(os.environ.get("SPLITIT_PORT") or _pick_free_port())
    host = os.environ.get("SPLITIT_HOST", "127.0.0.1")

    config = uvicorn.Config(app, host=host, port=port, log_level="warning", access_log=False)
    server = uvicorn.Server(config)

    def _announce_when_ready() -> None:
        while not server.started:
            if server.should_exit:
                return
            threading.Event().wait(0.05)
        sys.stdout.write(json.dumps({"event": "ready", "host": host, "port": port}) + "\n")
        sys.stdout.flush()

    threading.Thread(target=_announce_when_ready, daemon=True).start()
    server.run()


if __name__ == "__main__":
    main()
