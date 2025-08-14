import { useRef, useState, useEffect, useCallback } from "react";
import WaveSurfer from "wavesurfer.js";
import "./App.css";

export default function Waveform({
  progress = 0,
  duration = 0,
  loop = null,
  onScrub,
  onLoopChange,
  videoId = null,
  onAudioLoaded,
}) {
  const containerRef = useRef(null);
  const wsRef = useRef(null);

  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [wsDuration, setWsDuration] = useState(0);

  const onScrubRef = useRef(onScrub);
  const onAudioLoadedRef = useRef(onAudioLoaded);

  useEffect(() => {
    onScrubRef.current = onScrub;
  }, [onScrub]);
  useEffect(() => {
    onAudioLoadedRef.current = onAudioLoaded;
  }, [onAudioLoaded]);

  useEffect(() => {
    if (!containerRef.current || wsRef.current) return;
    try {
      const ws = WaveSurfer.create({
        container: containerRef.current,
        waveColor: "#ff0a9c",
        progressColor: "#ff1aac",
        height: 180,
        normalize: false,
        interact: true,
        dragToSeek: true,
        partialRender: true,

        barWidth: 3,
        barGap: 1,
        barRadius: 3,
        barHeight: 1,
      });

      ws.on("ready", () => {
        setWsDuration(ws.getDuration() || 0);
        setLoadError(null);
      });
      ws.on("error", (e) => {
        console.error("WaveSurfer error:", e);
        setLoadError("Waveform render error.");
      });
      ws.on("seek", (ratio) => {
        onScrubRef.current?.(ratio);
      });

      wsRef.current = ws;
    } catch (e) {
      console.error("Failed to create WaveSurfer:", e);
      setLoadError("Audio renderer failed to initialize.");
    }

    return () => {
      if (wsRef.current) {
        try {
          wsRef.current.destroy();
        } catch {}
        wsRef.current = null;
      }
      setWsDuration(0);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const ws = wsRef.current;
    if (!ws || !videoId) return;

    async function load() {
      setIsLoading(true);
      setLoadError(null);
      console.log("Loading waveform for video:", videoId);

      if (window.audioAPI?.downloadAudioForVideo) {
        try {
          const { mime, data } = await window.audioAPI.downloadAudioForVideo(
            videoId
          );
          if (cancelled) return;
          const blob = new Blob([data], { type: mime || "audio/webm" });
          console.log(
            "Downloaded audio via Electron — size:",
            blob.size,
            "bytes"
          );
          ws.loadBlob(blob);
          onAudioLoadedRef.current?.(blob);
          setIsLoading(false);
          return;
        } catch (e) {
          console.error("Electron audioAPI failed:", e);
          setLoadError(`Failed to download audio: ${e.message || e}`);
          setIsLoading(false);
          return;
        }
      }

      setLoadError(
        "The desktop audio API is not available in this environment. Please run the application via Electron (npm run electron-dev or packaged build) so that audio can be downloaded locally."
      );
      setIsLoading(false);
      return;
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || !wsDuration || isDragging) return;
    const targetTime = (progress || 0) * wsDuration;
    const currentTime = ws.getCurrentTime?.() ?? 0;
    if (Math.abs(currentTime - targetTime) > 0.25) {
      ws.setTime(targetTime);
    }
  }, [progress, wsDuration, isDragging]);

  const toRatio = useCallback((clientX) => {
    const box = containerRef.current?.getBoundingClientRect();
    if (!box) return 0;
    const x = Math.min(Math.max(clientX - box.left, 0), box.width);
    return x / box.width;
  }, []);

  const handleMouseDown = useCallback(
    (e, type) => {
      e.preventDefault();
      setIsDragging(true);
      setDragType(type);
      if (type === "scrub") {
        const r = toRatio(e.clientX);
        onScrub?.(r);
      }
    },
    [onScrub, toRatio]
  );

  const handleMouseMove = useCallback(
    (e) => {
      if (!isDragging) return;
      const r = toRatio(e.clientX);
      if (dragType === "scrub") {
        onScrub?.(r);
      } else if (dragType === "start" || dragType === "end") {
        const ytTime = r * (duration || 0);
        onLoopChange?.(
          dragType === "start" ? { ...loop, a: ytTime } : { ...loop, b: ytTime }
        );
      }
    },
    [isDragging, dragType, toRatio, duration, loop, onScrub, onLoopChange]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragType(null);
  }, []);

  const startPos = (loop?.a ?? 0) / (duration || 1);
  const endPos = (loop?.b ?? duration ?? 1) / (duration || 1);

  return (
    <div
      className="waveform-wrapper"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ position: "relative" }}
    >
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "180px",
          opacity: isLoading ? 0.5 : 1,
          transition: "opacity 0.3s ease",
          backgroundColor: "rgba(255, 0, 0, 0.1)",
          border: "1px solid rgba(255, 255, 255, 0.3)",
          cursor: "pointer",
          position: "relative",
          zIndex: 2,
        }}
        onMouseDown={(e) => handleMouseDown(e, "scrub")}
      />

      {isLoading && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "rgba(255,255,255,0.7)",
            fontSize: 14,
            fontFamily: "Inter, sans-serif",
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          Loading waveform...
        </div>
      )}

      {loadError && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "#ff6b6b",
            fontFamily: "Inter, sans-serif",
            fontSize: 14,
            textAlign: "center",
            pointerEvents: "none",
            backgroundColor: "rgba(0,0,0,0.8)",
            padding: "12px 16px",
            borderRadius: "8px",
            maxWidth: "80%",
            lineHeight: "1.4",
          }}
        >
          ⚠️ {loadError}
        </div>
      )}

      {loop && duration > 0 && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: `${startPos * 100}%`,
            width: `${(endPos - startPos) * 100}%`,
            height: "100%",
            backgroundColor: "rgba(0,0,0,0.3)",
            pointerEvents: "none",
            zIndex: 5,
          }}
        />
      )}

      <div
        className="waveform-clip-handle start"
        style={{ left: `${startPos * 100}%` }}
        onMouseDown={(e) => handleMouseDown(e, "start")}
      >
        <div className="clip-handle-cap" />
      </div>

      <div
        className="waveform-clip-handle end"
        style={{ left: `${endPos * 100}%` }}
        onMouseDown={(e) => handleMouseDown(e, "end")}
      >
        <div className="clip-handle-cap" />
      </div>
    </div>
  );
}
