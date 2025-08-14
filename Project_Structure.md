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
npm run electron-dev # runs electron with hot reload (dev mode)
```

## npm dependencies you'll need

when someone downloads this project, they'll need to install these npm packages for the electron frontend to work:

### core dependencies (automatically installed with `npm install`)

**react ecosystem:**

- `react@^19.1.1` - the main react framework
- `react-dom@^19.1.1` - react rendering for web
- `react-scripts@5.0.1` - create-react-app toolchain

**electron:**

- `electron@^37.2.5` - desktop app framework (dev dependency)

**animations & ui:**

- `framer-motion@^11.18.2` - smooth animations and transitions
- `@wavesurfer/react@^1.0.11` - react wrapper for wavesurfer
- `wavesurfer.js@^7.10.1` - audio waveform visualization

**youtube integration:**

- `ytdl-core@^4.11.5` - download youtube audio/video

**testing:**

- `@testing-library/react@^16.3.0` - react testing utilities
- `@testing-library/jest-dom@^6.6.4` - jest dom matchers
- `@testing-library/dom@^10.4.1` - dom testing utilities
- `@testing-library/user-event@^13.5.0` - user interaction testing

**development tools:**

- `concurrently@^9.2.0` - run multiple commands at once
- `cross-env@^10.0.0` - cross-platform environment variables
- `wait-on@^8.0.4` - wait for services to be available

**monitoring:**

- `web-vitals@^2.1.4` - performance monitoring

### quick setup for new users

**option 1: use the setup script (easiest)**

```bash
# clone the repo
git clone [your-repo-url]
cd SplitMe

# run the setup script
chmod +x setup.sh && ./setup.sh    # on mac/linux
# or
setup.bat                           # on windows
```

**option 2: manual setup**

```bash
# clone the repo
git clone [your-repo-url]
cd SplitMe

# install python dependencies
pip install -r requirements.txt

# install node dependencies for the frontend
cd frontend
npm install

# run the electron app
npm run electron-dev
```
