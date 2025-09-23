import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const STEM_COLORS = [
  "#6546FED6",
  "#0009FF47",
  "#0088FF52",
  "#5100FF80",
  "#7300FF80",
  "#BF00FF80",
  "#FF00B757",
];

const STEM_LABELS = {
  vocals: "Vocal Stem Split",
  drums: "Drum Stem Split",
  bass: "Bass Stem Split",
  guitar: "Guitar Stem Split",
  piano: "Piano Stem Split",
  other: "Other Stem Split",
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const formatTime = (seconds = 0) => {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const total = Math.floor(safeSeconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export default function StemCardStack({ stems, artist = "" }) {
  const decorated = useMemo(
    () =>
      stems.map((stem, index) => {
        const key = (stem.stem || "").toLowerCase();
        const title = STEM_LABELS[key] || `${key.charAt(0).toUpperCase()}${key.slice(1)} Stem Split`;
        return {
          ...stem,
          stem: key,
          title,
          color: STEM_COLORS[index % STEM_COLORS.length],
          duration: stem.duration ?? 0,
        };
      }),
    [stems]
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const [playingIndex, setPlayingIndex] = useState(null);
  const [currentTimes, setCurrentTimes] = useState(() => decorated.map((stem) => stem.duration ?? 0));
  const [durations, setDurations] = useState(() => decorated.map((stem) => stem.duration ?? 0));
  const audioRefs = useRef([]);
  const wheelLockRef = useRef(false);

  useEffect(() => {
    audioRefs.current.forEach((audio) => audio?.pause?.());
    audioRefs.current = [];
    setPlayingIndex(null);
    setCurrentTimes(decorated.map((stem) => stem.duration ?? 0));
    setDurations(decorated.map((stem) => stem.duration ?? 0));
    setActiveIndex((prev) => clamp(prev, 0, Math.max(decorated.length - 1, 0)));
  }, [decorated]);

  const navigate = useCallback(
    (delta) => {
      if (!decorated.length) return;
      setActiveIndex((prev) => {
        const total = decorated.length;
        const next = (prev + delta + total) % total;
        return next;
      });
    },
    [decorated.length]
  );

  useEffect(() => {
    const handler = (event) => {
      if (decorated.length === 0) return;
      if (event.key === "ArrowUp") {
        event.preventDefault();
        navigate(-1);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        navigate(1);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [decorated.length, navigate]);

  const handleWheel = useCallback(
    (event) => {
      if (!decorated.length || wheelLockRef.current) return;
      event.preventDefault();
      wheelLockRef.current = true;
      navigate(event.deltaY > 0 ? 1 : -1);
      setTimeout(() => {
        wheelLockRef.current = false;
      }, 250);
    },
    [navigate, decorated.length]
  );

  const handleTimeUpdate = useCallback((index, value) => {
    setCurrentTimes((prev) => {
      if (prev[index] === value) return prev;
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const handleLoadedMetadata = useCallback((index, value) => {
    setDurations((prev) => {
      if (prev[index] === value) return prev;
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const togglePlayback = useCallback(
    async (index) => {
      const audio = audioRefs.current[index];
      if (!audio) return;

      if (playingIndex === index) {
        audio.pause();
        setPlayingIndex(null);
        return;
      }

      audioRefs.current.forEach((item, itemIndex) => {
        if (itemIndex !== index) {
          item?.pause?.();
        }
      });

      try {
        await audio.play();
        setPlayingIndex(index);
      } catch (err) {
        console.error("Failed to play stem:", err);
      }
    },
    [playingIndex]
  );

  if (!decorated.length) {
    return null;
  }

  return (
    <div className="stem-stack" onWheel={handleWheel}>
      <div className="stem-stack-inner">
        {decorated.map((stem, index) => {
          const offset = ((index - activeIndex) + decorated.length) % decorated.length;
          const visible = offset <= 3;
          const translateY = offset * 24;
          const scale = 1 - offset * 0.06;
          const opacity = offset === 3 ? 0.4 : 1;
          const zIndex = decorated.length - offset;
          const isActive = index === activeIndex;
          const isPlaying = index === playingIndex;
          const timelineSeconds = isPlaying ? currentTimes[index] : durations[index];

          return (
            <div
              key={stem.stem}
              className={`stem-card${isActive ? " active" : ""}${isPlaying ? " playing" : ""}`}
              style={{
                background: `linear-gradient(135deg, ${stem.color} 0%, rgba(15, 15, 35, 0.85) 100%)`,
                transform: `translateY(${translateY}px) scale(${scale})`,
                opacity: visible ? opacity : 0,
                zIndex,
              }}
            >
              <div className="stem-card-content">
                <div className="stem-card-header">
                  <span className="stem-card-title">{stem.title}</span>
                  <span className="stem-card-artist">{artist}</span>
                </div>
                <div className="stem-card-footer">
                  <span className="stem-card-time">{formatTime(timelineSeconds)}</span>
                  <button
                    type="button"
                    className="stem-card-play"
                    onClick={() => togglePlayback(index)}
                  >
                    {isPlaying ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <rect x="7" y="5" width="3.5" height="14" rx="1.2" fill="white" />
                        <rect x="13.5" y="5" width="3.5" height="14" rx="1.2" fill="white" />
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M8 5v14l11-7z" fill="white" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <audio
                ref={(el) => {
                  audioRefs.current[index] = el;
                }}
                src={stem.streamUrl}
                preload="metadata"
                onTimeUpdate={(event) => handleTimeUpdate(index, event.target.currentTime || 0)}
                onLoadedMetadata={(event) => handleLoadedMetadata(index, event.target.duration || stem.duration)}
                onEnded={() => setPlayingIndex(null)}
              />
            </div>
          );
        })}
      </div>
      <div className="stem-stack-instructions">Use ↑↓ keys or scroll to navigate</div>
    </div>
  );
}

      <div className="stem-stack-instructions">Use ↑↓ keys or scroll to navigate</div>
