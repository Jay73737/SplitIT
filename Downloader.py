from PyQt6.QtCore import QThread, pyqtSignal
import yt_dlp
import os
import shutil
import traceback
from pathlib import Path
from contextvars import ContextVar

import re
_ffmpeg_location = ContextVar('ffmpeg_location', default=None)
_ffmpeg_location = ContextVar('ffmpeg_location', default=None)
ffmpeg_path = Path(__file__).parent / 'ffmpeg' 

eval = None
_ffmpeg_location.set(ffmpeg_path.absolute())


os.environ["PATH"] += os.pathsep + str(ffmpeg_path.absolute())
#url = 'https://www.youtube.com/watch?v=x4SsfuOolkU'


def _resolve_ffmpeg_directory() -> Path | None:
    bundled_dir = ffmpeg_path.absolute()
    bundled_bin_dir = bundled_dir / 'bin'
    candidate_directories = [bundled_dir, bundled_bin_dir]

    for directory in candidate_directories:
        if (directory / 'ffmpeg.exe').exists() and (directory / 'ffprobe.exe').exists():
            return directory

    return None


def _ffmpeg_tools_on_path() -> bool:
    return shutil.which('ffmpeg') is not None and shutil.which('ffprobe') is not None


def sanitize_folder_name(name: str) -> str:
    # Remove invalid characters for Windows paths
    return re.sub(r'[<>:"|?*]', '', name)
class DownloadThread(QThread):
  
    finished_signal = pyqtSignal(bool,  Path, str) 


    def __init__(self, url, save_path):
        super().__init__()
      
        self.out_path = Path()
        self.url = url
        self.save_path = save_path
        self.service = None
        self.downloaded_filename = ""
        self.ffmpeg_dir = _resolve_ffmpeg_directory()
        self.has_system_ffmpeg = _ffmpeg_tools_on_path()

        if self.ffmpeg_dir is not None:
            os.environ["PATH"] += os.pathsep + str(self.ffmpeg_dir)

    def run(self):   
        if self.ffmpeg_dir is None and not self.has_system_ffmpeg:
            self.finished_signal.emit(
                False,
                Path(),
                "FFmpeg and ffprobe were not found. Install them and add them to PATH, or place ffmpeg.exe and ffprobe.exe in the SplitIT/ffmpeg folder.",
            )
            return

        
        ydl_opts = {
            'format': 'bestaudio/best[ext=webm]',
            'outtmpl': f"{self.save_path}\\tempfile.tmp",
            
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'wav',
                
                }]
                }
        if self.ffmpeg_dir is not None:
            ydl_opts['ffmpeg_location'] = str(self.ffmpeg_dir)
        eval = None
        pth = None
        opth = None
        dl_path = Path()
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                #temp = ydl.evaluate_outtmpl(ydl_opts['outtmpl'])
                import shutil
                ydl.download([self.url])
                eval = ydl.extract_info(self.url)     
                dl_path = Path(rf"{self.save_path}\tempfile.tmp.wav")
                self.out_path = Path(dl_path).parent / Path(sanitize_folder_name(str(eval['title']))) / sanitize_folder_name(str(eval['title'] + '.wav'))
                Path(dl_path).with_stem(sanitize_folder_name(eval['title'])).absolute()
                if not self.out_path.exists():
                    if not self.out_path.parent.exists():
                        os.makedirs(self.out_path.parent)
                    shutil.move(str(dl_path),str(self.out_path) )
                else:
                    #
                    print('file already existed - ', dl_path.absolute())
                    Path(dl_path).unlink()

                print('self.out_path 77777777777777777 ' + str(self.out_path))
                self.finished_signal.emit(True,  self.out_path, "")
        except Exception as e:
            traceback.print_exc()
            print(self.out_path, '---------------')
            self.finished_signal.emit(False, Path(), str(e))



