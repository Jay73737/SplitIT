# splitme - project structure

just a quick overview of how everything's organized in this audio stem separation app.

## how it's laid out

```text
SplitMe/
├── main.py                 # where you start the python app
├── main.pyw               # windows version (hides the terminal)
├── requirements.txt       # all the python stuff you need
├── README.md             # the original docs
├── PROJECT_STRUCTURE.md  # this file you're reading
├── assets/               # icons and other static stuff
│   ├── icon.ico         # app icon
│   ├── CLOSE.svg        # close button
│   └── MINIMIZE.svg     # minimize button
├── config/               # settings and config files
│   └── config.json      # where your settings live
├── scripts/              # installation helpers
│   ├── download_gpu.ps1    # script for gpu setup
│   └── download_nogpu.ps1  # script for cpu-only setup
├── frontend/             # the fancy electron ui
│   ├── electron.js          # electron's main process
│   ├── package.json         # node dependencies
│   ├── preload.js           # electron security layer
│   ├── public/              # web assets
│   │   ├── index.html       # main html file
│   │   └── ... (icons, manifest, etc.)
│   └── src/                 # react components
│       ├── App.js           # main react app
│       ├── SearchBar.js     # search interface
│       ├── VideoCard.js     # video cards in results
│       ├── DashboardView.js # main dashboard
│       ├── Waveform.js      # audio visualization
│       ├── YoutubePlayer.js # youtube integration
│       └── ... (other components)
└── src/                  # all the python code
    ├── __init__.py
    ├── core/             # the main business logic
    │   ├── __init__.py
    │   ├── Downloader.py      # downloads audio from youtube
    │   ├── Results.py         # shows results window
    │   ├── StemSplitter.py    # does the actual stem splitting
    │   └── YoutubeDownloader.py # handles youtube api calls
    ├── demucs/           # the ai model for audio separation
    │   ├── __main__.py
    │   ├── api.py
    │   ├── apply.py
    │   ├── audio.py
    │   └── ... (tons of model files)
    ├── ui/               # python gui components
    │   ├── __init__.py
    │   ├── GUIComponents.py   # reusable ui parts
    │   ├── ModernUI.py        # modern looking interface
    │   ├── config.py          # ui settings
    │   ├── constants.py       # ui constants
    │   ├── main_window.py     # main window
    │   ├── models.py          # ui data models
    │   ├── youtube.py         # youtube ui bits
    │   └── widgets/           # custom widgets
    │       ├── __init__.py
    │       ├── border.py
    │       ├── card.py
    │       ├── placeholders.py
    │       └── results_panel.py
    └── utils/            # random useful stuff
        └── train.py      # training utilities
```

## what's cool about this setup

### you get two different uis to choose from

this thing actually has **two completely different interfaces**:

1. **python pyqt6 ui** (`src/ui/`) - the classic desktop app
   - just run: `python main.py`
   - looks and feels like a native desktop app
   
2. **electron react ui** (`frontend/`) - the shiny modern one
   - run: `cd frontend && npm install && npm start`
   - has that fancy pill-shaped animated window
   - basically a web app that runs on your desktop

### how to connect them

you've got a few options for making these work together:

#### option 1: keep them separate (what we have now)
- both apps do their own thing
- users pick whichever they like better
- electron can talk to python through apis or just run python as a subprocess

#### option 2: electron calls python
- use the pretty electron ui as your main interface
- when you need to do audio processing, just call the python scripts
- best of both worlds - pretty ui + powerful python backend

#### option 3: build an api
- turn the python stuff into a proper rest api
- electron frontend talks to python over http
- most flexible but takes more work to set up

## how to run everything

### the python version
```bash
python main.py     # normal mode
python main.pyw    # windows mode (no console window)
```

### the electron version
```bash
cd frontend
npm install        # first time only - installs all the node packages
npm start          # dev server
npm run electron   # runs as a desktop app
```

## what got cleaned up

### organized the mess
- **core stuff** (`src/core/`) - all the download and stem splitting logic
- **python ui** (`src/ui/`) - the pyqt6 interface
- **electron frontend** (`frontend/`) - your modern react interface
- **config** (`config/`) - settings all in one place
- **assets** (`assets/`) - icons and images

### got rid of duplicates
- deleted duplicate files that were confusing
- put similar things together in logical folders

### fixed all the imports
- updated python imports to work with the new structure
- made sure asset paths point to the right places

now everything's organized and you can easily work on either interface without things getting messy.
