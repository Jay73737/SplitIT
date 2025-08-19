import { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import YouTubePlayer from "./YoutubePlayer";
import WaveformPlayer from "./components/WaveformPlayer";
import CustomDropdown from "./CustomDropdown";
import { downloadAudioBlob } from "./lib/downloadAudio";
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

  const [audioBlob, setAudioBlob] = useState(null);
  const [backendAudioUrl, setBackendAudioUrl] = useState(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const abortRef = useRef(null);
  const [waveformInstance, setWaveformInstance] = useState(null);
  const [waveformPlaying, setWaveformPlaying] = useState(false);

  // Load audio from backend for accurate waveform
  useEffect(() => {
    return () => {
      if (backendAudioUrl) URL.revokeObjectURL(backendAudioUrl);
    };
  }, [backendAudioUrl]);

  useEffect(() => {
    if (video?.isLocalFile) {
      // For local files, use the existing file URL
      setBackendAudioUrl(video.filePath);
      setAudioBlob(video.file);
      return;
    }

    if (!video?.id) {
      if (backendAudioUrl) URL.revokeObjectURL(backendAudioUrl);
      setBackendAudioUrl(null);
      return;
    }

    // Cancel any existing request
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const loadBackendAudio = async () => {
      setAudioLoading(true);
      try {
        const youtubeUrl = `https://www.youtube.com/watch?v=${video.id}`;
        const { objectUrl } = await downloadAudioBlob(
          youtubeUrl,
          "mp3",
          abortRef.current.signal
        );
        if (backendAudioUrl) URL.revokeObjectURL(backendAudioUrl);
        setBackendAudioUrl(objectUrl);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Failed to load backend audio:", err);
        }
      } finally {
        setAudioLoading(false);
      }
    };

    loadBackendAudio();

    return () => {
      abortRef.current?.abort();
    };
  }, [video?.id, video?.isLocalFile]);

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
  const seek = (s) => {
    const targetTime = Math.max(0, Math.min(duration, s));
    if (video.isLocalFile) {
      if (ytRef.current) {
        ytRef.current.currentTime = targetTime;
      }
    } else {
      ytRef.current?.seek(targetTime);
    }
  };

  return (
    <motion.div
      className="dashboard"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.1 }}
    >
      <div className="dash-header" style={{ WebkitAppRegion: "drag" }}>
        {video.thumbnail && (
          <img src={video.thumbnail} className="dash-thumbnail" alt="" />
        )}
        {!video.thumbnail && video.isLocalFile && (
          <div className="dash-thumbnail local-file-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
              <path
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}
        <div className="dash-info">
          <h2 className="dash-title">{video.title}</h2>
          <p className="dash-artist">{video.channel}</p>
        </div>
        <button
          className="dash-close"
          onClick={onBack}
          style={{ WebkitAppRegion: "no-drag" }}
        >
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

      <div className="dash-content" style={{ WebkitAppRegion: "no-drag" }}>
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
              if (!backendAudioUrl && !audioBlob) {
                alert(
                  "Audio not available. The waveform must load successfully before splitting. Try a different video or check if the video is geo-restricted."
                );
                return;
              }
              console.log("Ready to process audio:", {
                backendAudioUrl,
                audioBlob,
              });
            }}
          >
            SPLIT AUDIO
          </button>
        </div>

        <div className="dash-waveform-container">
          <div className="waveform-time-left">{formatTime(current)}</div>

          {/* New backend-powered accurate waveform */}
          <div
            className="waveform-wrapper"
            style={{
              width: "100%",
              height: "120px",
              position: "relative",
              margin: "20px 0",
              zIndex: 1001,
            }}
          >
            {audioLoading && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  color: "#fff",
                  fontSize: "12px",
                }}
              >
                Loading accurate waveform...
              </div>
            )}

            {!audioLoading && backendAudioUrl && (
              <WaveformPlayer
                url={backendAudioUrl}
                height={80} /* Even smaller height for very compact dashboard */
                onWaveformReady={(instance) => setWaveformInstance(instance)}
                onPlayStateChange={(playing) => setWaveformPlaying(playing)}
              />
            )}

            {!audioLoading && !backendAudioUrl && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  color: "#ff6b6b",
                  fontSize: "10px",
                }}
              >
                Failed to load waveform. Please try again.
              </div>
            )}
          </div>

          <div className="waveform-time-right">{formatTime(duration)}</div>

          <div className="dash-transport">
            <button className="transport-btn" onClick={() => seek(current - 5)}>
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M16 15V5l-3.5 2.5L9 10l3.5 2.5L16 15zm-7 0V5l-3.5 2.5L2 10l3.5 2.5L9 15z" />
              </svg>
            </button>
            <button
              className="transport-btn play"
              onClick={() => {
                if (waveformInstance) {
                  // Use waveform for playback control
                  waveformInstance.playPause();
                } else if (video.isLocalFile) {
                  playing ? ytRef.current?.pause() : ytRef.current?.play();
                } else {
                  playing ? ytRef.current?.pause() : ytRef.current?.play();
                }
              }}
            >
              {(waveformInstance ? waveformPlaying : playing) ? (
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
                <path d="M4 5v10l3.5-2.5L11 10l-3.5-2.5L4 5zm7 0v10l3.5-2.5L18 10l-3.5-2.5L11 5z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {video.isLocalFile ? (
        <audio
          ref={ytRef}
          src={video.filePath}
          onLoadedMetadata={(e) => {
            setDuration(e.target.duration);
          }}
          onTimeUpdate={(e) => {
            setCurrent(e.target.currentTime);
            if (
              loop?.a != null &&
              loop?.b != null &&
              e.target.currentTime >= loop.b
            ) {
              e.target.currentTime = loop.a;
            }
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          style={{ display: "none" }}
        />
      ) : (
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
              e.data === 1
                ? true
                : e.data === 0 || e.data === 2
                ? false
                : playing
            )
          }
          onTime={(t, d) => {
            setCurrent(t);
            if (d && d !== duration) setDuration(d);
            if (loop?.a != null && loop?.b != null && t >= loop.b) seek(loop.a);
          }}
        />
      )}
    </motion.div>
  );
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
