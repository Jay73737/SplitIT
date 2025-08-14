import { useRef, useState } from "react";
import { motion } from "framer-motion";
import YouTubePlayer from "./YoutubePlayer";
import Waveform from "./Waveform";
import CustomDropdown from "./CustomDropdown";
import "./App.css";

export default function DashboardView({ video, onBack }) {
  const ytRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loop, setLoop] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [audioFormat, setAudioFormat] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [stems, setStems] = useState({
    vocals: true,
    piano: false,
    guitar: false,
    bass: false,
    drums: false,
    other: false,
  });

  // will hold the downloaded WAV blob provided by Waveform
  const [audioBlob, setAudioBlob] = useState(null);

  if (!video) return null;

  const audioFormatOptions = [
    { value: "wav", label: "WAV" },
    { value: "aiff", label: "AIFF" },
    { value: "mp3", label: "MP3" },
  ];

  const aiModelOptions = [
    { value: "ht-demucs-v4", label: "HT Demucs v4" },
    { value: "mdxnet-hq", label: "MDXNet HQ" },
  ];

  const volume = 80;
  const rate = 1;
  const progress = duration ? Math.min(1, current / duration) : 0;
  const seek = (s) => ytRef.current?.seek(Math.max(0, Math.min(duration, s)));

  return (
    <motion.div
      className="dashboard"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.1 }}
      style={{ WebkitAppRegion: "drag" }}
    >
      <div className="dash-header">
        <img src={video.thumbnail} className="dash-thumbnail" alt="" />
        <div className="dash-info">
          <h2 className="dash-title">{video.title}</h2>
          <p className="dash-artist">{video.channel}</p>
        </div>
        <button className="dash-close" onClick={onBack}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M18 6L6 18M6 6l12 12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div className="dash-content">
        <div className="dash-sidebar">
          <div className="dash-controls">
            <CustomDropdown
              options={audioFormatOptions}
              placeholder="Select audio format"
              value={audioFormat}
              onChange={setAudioFormat}
              pushContent={true}
            />

            <CustomDropdown
              options={aiModelOptions}
              placeholder="Select AI Model"
              value={aiModel}
              onChange={setAiModel}
              pushContent={false}
            />

            <div className="stem-list">
              {Object.entries(stems).map(([k, v]) => (
                <div
                  key={k}
                  className={`stem-item ${v ? "active" : ""}`}
                  onClick={() => setStems((s) => ({ ...s, [k]: !v }))}
                >
                  <span className="stem-dot" />
                  <span className="stem-label">
                    {k.charAt(0).toUpperCase() + k.slice(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button
            className="split-audio-btn"
            onClick={() => {
              if (!audioBlob) {
                alert(
                  "Audio not available. The waveform must load successfully before splitting. Try a different video or check if the video is geo-restricted."
                );
                return;
              }
              // example: save / upload / pass to a worker
              console.log("Ready to process audioBlob:", audioBlob);
            }}
          >
            SPLIT AUDIO
          </button>
        </div>

        <div className="dash-waveform-container">
          <div className="waveform-time-left">{formatTime(current)}</div>
          <Waveform
            progress={progress}
            markers={markers}
            duration={duration}
            loop={loop}
            videoId={video?.id}
            youtubePlayer={ytRef.current}
            onScrub={(r) => seek(r * duration)}
            onMarkerAdd={(t) =>
              setMarkers((m) => [...m, { id: crypto.randomUUID(), t }])
            }
            onMarkerMove={(id, t) =>
              setMarkers((m) => m.map((o) => (o.id === id ? { ...o, t } : o)))
            }
            onMarkerRemove={(id) =>
              setMarkers((m) => m.filter((o) => o.id !== id))
            }
            onLoopChange={setLoop}
            onAudioLoaded={(blob) => {
              console.log("Dashboard received audio blob:", blob);
              setAudioBlob(blob);
            }}
          />
          <div className="waveform-time-right">{formatTime(duration)}</div>

          <div className="dash-transport">
            <button className="transport-btn" onClick={() => seek(current - 5)}>
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M4 5v10l3.5-2.5L11 10l-3.5-2.5L4 5zm7 0v10l3.5-2.5L18 10l-3.5-2.5L11 5z" />
              </svg>
            </button>
            <button
              className="transport-btn play"
              onClick={() =>
                playing ? ytRef.current?.pause() : ytRef.current?.play()
              }
            >
              {playing ? (
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
            <button className="transport-btn" onClick={() => seek(current + 5)}>
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M16 15V5l-3.5 2.5L9 10l3.5 2.5L16 15zm-7 0V5l-3.5 2.5L2 10l3.5 2.5L9 15z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <YouTubePlayer
        ref={ytRef}
        videoId={video.id}
        volume={volume}
        playbackRate={rate}
        onReady={(_, i) =>
          setDuration(i.duration || ytRef.current?.getDuration() || 0)
        }
        onStateChange={(e) =>
          setPlaying(
            e.data === 1 ? true : e.data === 0 || e.data === 2 ? false : playing
          )
        }
        onTime={(t, d) => {
          setCurrent(t);
          if (d && d !== duration) setDuration(d);
          if (loop?.a != null && loop?.b != null && t >= loop.b) seek(loop.a);
        }}
      />
    </motion.div>
  );
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
