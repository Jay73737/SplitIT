# SplitMe Project Structure

Audio stem separation desktop app built with Electron.

## Project Layout

```
SplitMe/
├── setup.bat              # Setup script
├── frontend/              # Electron React app
│   ├── package.json
│   ├── electron.js
│   └── src/               # React components
└── src/                   # Python backend (auto-handled)
    ├── core/              # Audio processing
    └── demucs/            # AI model
```

## Quick Start

```bash
setup.bat
```

## Run the App

```bash
cd frontend
npm run electron-dev
```
