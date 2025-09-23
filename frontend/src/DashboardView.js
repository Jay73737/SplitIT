import { useRef, useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import YouTubePlayer from "./YoutubePlayer";
import WaveformPlayer from "./components/WaveformPlayer";
import StemCardStack from "./components/StemCardStack";
import CustomDropdown from "./CustomDropdown";
import { downloadAudioBlob, API_BASE } from "./lib/downloadAudio";
import { startStemSplit, fetchStemSplitStatus } from "./lib/splitAudio";
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
  const [backendAudioId, setBackendAudioId] = useState(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState(null);
  const abortRef = useRef(null);
  const [waveformInstance, setWaveformInstance] = useState(null);
  const [waveformPlaying, setWaveformPlaying] = useState(false);
  const [splitJobId, setSplitJobId] = useState(null);
  const [splitStatus, setSplitStatus] = useState("idle");
  const [splitError, setSplitError] = useState(null);
  const [splitResults, setSplitResults] = useState([]);
  const splitPollRef = useRef(null);

  // Load audio from backend for accurate waveform
  useEffect(() => {
    return () => {
      if (backendAudioUrl) URL.revokeObjectURL(backendAudioUrl);
    };
  }, [backendAudioUrl]);

  useEffect(() => {
    return () => {
      if (splitPollRef.current) {
        clearInterval(splitPollRef.current);
        splitPollRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (splitPollRef.current) {
      clearInterval(splitPollRef.current);
      splitPollRef.current = null;
    }

    setSplitJobId(null);
    setSplitStatus("idle");
    setSplitError(null);
    setSplitResults([]);

    if (video?.isLocalFile) {
      // For local files, use the existing file URL
      setBackendAudioUrl(video.filePath);
      setAudioBlob(video.file);
      setAudioError(null);
      setBackendAudioId(null);
      setWaveformInstance(null);
      setWaveformPlaying(false);
      return;
    }

    if (!video?.id) {
      if (backendAudioUrl) URL.revokeObjectURL(backendAudioUrl);
      setBackendAudioUrl(null);
      setAudioBlob(null);
      setAudioError(null);
      setBackendAudioId(null);
      setWaveformInstance(null);
      setWaveformPlaying(false);
      return;
    }

    // Cancel any existing request
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const loadBackendAudio = async () => {
      setAudioLoading(true);
      setAudioError(null);
      setAudioBlob(null);
      setWaveformInstance(null);
      setWaveformPlaying(false);
      try {
        const youtubeUrl = `https://www.youtube.com/watch?v=${video.id}`;
        const { objectUrl, blob, id } = await downloadAudioBlob(
          youtubeUrl,
          "mp3",
          abortRef.current.signal
        );
        if (backendAudioUrl) URL.revokeObjectURL(backendAudioUrl);
        setBackendAudioUrl(objectUrl);
        setAudioBlob(blob);
        setBackendAudioId(id);
      } catch (err) {
        if (err.name === "AbortError") {
          return;
        }
        console.error("Failed to load backend audio:", err);
        if (backendAudioUrl) URL.revokeObjectURL(backendAudioUrl);
        setBackendAudioUrl(null);
        setAudioError(err.message || "Failed to load waveform audio.");
        setBackendAudioId(null);
        setWaveformInstance(null);
        setWaveformPlaying(false);
      } finally {
        setAudioLoading(false);
      }
    };

    loadBackendAudio();

    return () => {
      abortRef.current?.abort();
    };
  }, [video?.id, video?.isLocalFile]);

  const handleWaveformReady = useCallback((instance) => {
    setWaveformInstance(instance);
  }, []);

  const handleWaveformPlayStateChange = useCallback((playingState) => {
    setWaveformPlaying(playingState);
  }, []);

  const beginSplitPolling = useCallback((jobId) => {
    const poll = async () => {
      try {
        const data = await fetchStemSplitStatus(jobId);
        if (!data) return;
        if (data.status === "completed") {
          const results = (data.results || []).map((item) => ({
            ...item,
            streamUrl: `${API_BASE}${item.streamUrl}`,
          }));
          setSplitResults(results);
          setSplitStatus("completed");
          clearInterval(splitPollRef.current);
          splitPollRef.current = null;
        } else if (data.status === "error") {
          setSplitStatus("error");
          setSplitError(data.error || "Stem split failed.");
          clearInterval(splitPollRef.current);
          splitPollRef.current = null;
        } else {
          setSplitStatus("processing");
        }
      } catch (err) {
        console.error("Stem split status error:", err);
        setSplitStatus("error");
        setSplitError(err.message || "Unable to retrieve stem split status.");
        clearInterval(splitPollRef.current);
        splitPollRef.current = null;
      }
    };

    poll();
    splitPollRef.current = window.setInterval(poll, 2500);
  }, []);

  const handleSplitAudio = useCallback(async () => {
    if (splitStatus === "processing") return;

    const selectedStems = Object.entries(stems)
      .filter(([, enabled]) => enabled)
      .map(([name]) => name);

    if (!selectedStems.length) {
      setSplitError("Select at least one stem to split.");
      return;
    }

    if (!backendAudioId) {
      setSplitError(
        video?.isLocalFile
          ? "Stem splitting for local files is not yet available."
          : "Audio must finish downloading before splitting. Please wait for the waveform to load."
      );
      return;
    }

    try {
      if (splitPollRef.current) {
        clearInterval(splitPollRef.current);
        splitPollRef.current = null;
      }

      setSplitError(null);
      setSplitResults([]);
      setSplitStatus("processing");

      const payload = {
        audioId: backendAudioId,
        stems: selectedStems,
        model: aiModel || "ht-demucs-v4",
      };

      const { jobId, status } = await startStemSplit(payload);
      setSplitJobId(jobId);
      setSplitStatus(status || "processing");
      beginSplitPolling(jobId);
    } catch (err) {
      if (err.name === "AbortError") return;
      console.error("Failed to start stem split:", err);
      setSplitStatus("error");
      setSplitError(err.message || "Unable to start stem splitting.");
    }
  }, [aiModel, backendAudioId, beginSplitPolling, splitStatus, stems, video?.isLocalFile]);

  const showStemStack = splitStatus === "completed" && splitResults.length > 0;

  useEffect(() => {
    if (showStemStack && waveformInstance?.pause) {
      try {
        waveformInstance.pause();
      } catch (err) {
        /* ignore pause errors */
      }
    }
  }, [showStemStack, waveformInstance]);

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
            onClick={handleSplitAudio}
            disabled={splitStatus === "processing" || audioLoading}
          >
            {splitStatus === "processing" ? "SPLITTING..." : "SPLIT AUDIO"}
          </button>
        </div>

        <div className="dash-waveform-container">
          {!showStemStack && (
            <div className="waveform-time-left">{formatTime(current)}</div>
          )}

          {/* New backend-powered accurate waveform */}
          <div className={`waveform-wrapper${showStemStack ? " stems" : ""}`}>
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

            {!audioLoading && showStemStack && (
              <StemCardStack
                stems={splitResults}
                artist={video.channel || video.title || ""}
              />
            )}

            {!audioLoading && !showStemStack && splitStatus === "processing" && (
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
                Splitting stems… this can take a minute.
              </div>
            )}

            {!audioLoading && splitStatus === "error" && splitError && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  color: "#ff6b6b",
                  fontSize: "10px",
                  textAlign: "center",
                  padding: "0 12px",
                }}
              >
                {splitError}
              </div>
            )}

            {!audioLoading && !showStemStack && splitStatus !== "processing" && !splitError && backendAudioUrl && !audioError && (
              <WaveformPlayer
                url={backendAudioUrl}
                blob={audioBlob}
                height={80} /* Even smaller height for very compact dashboard */
                onWaveformReady={handleWaveformReady}
                onPlayStateChange={handleWaveformPlayStateChange}
              />
            )}

            {!audioLoading && audioError && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  color: "#ff6b6b",
                  fontSize: "10px",
                  textAlign: "center",
                }}
              >
                {audioError}
              </div>
            )}

          {!audioLoading && !showStemStack && splitStatus !== "processing" && !splitError && !audioError && !backendAudioUrl && (
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

          {!showStemStack && (
            <>
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
            </>
          )}
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
