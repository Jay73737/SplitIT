import { useEffect, useRef, useState } from "react";
import "./App.css";

function SearchBar({
  onSearch,
  onAudioDrop,
  loading,
  children,
  introActive,
  dragOffset,
  onDragStart,
}) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [internalDragOffset, setInternalDragOffset] = useState({ x: 0, y: 0 });
  const introCanvasRef = useRef(null);
  const pillRef = useRef(null);
  const dragStateRef = useRef({
    active: false,
    dragging: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const trimmed = value.trim();
      if (trimmed) onSearch(trimmed);
    }
  };

  const isAudioFile = (file) => {
    const audioTypes = [
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/flac', 
      'audio/aac', 'audio/ogg', 'audio/m4a', 'audio/webm'
    ];
    const audioExtensions = ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.webm'];
    
    return audioTypes.includes(file.type) || 
           audioExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const audioFile = files.find(isAudioFile);
    
    if (audioFile && onAudioDrop) {
      onAudioDrop(audioFile);
    }
  };

  const showPlaceholder = !introActive && !value && !focused;
  const resolvedDragOffset = dragOffset || internalDragOffset;
  const dragStyle = {
    transform: `translate3d(${resolvedDragOffset.x}px, ${resolvedDragOffset.y}px, 0)`,
  };

  useEffect(() => {
    if (!introActive) return undefined;
    const canvas = introCanvasRef.current;
    const pill = pillRef.current;
    if (!canvas || !pill) return undefined;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    const dpr = window.devicePixelRatio || 1;
    const rect = pill.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const area = width * height;
    const totalParticles = Math.min(
      8000,
      Math.max(2500, Math.round(area / 6))
    );
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) * 0.48;

    const particles = Array.from({ length: totalParticles }, () => {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random()) * maxRadius;
      const mix = Math.random();
      const baseR = 26 + (254 - 26) * mix;
      const baseG = 0 + (20 - 0) * mix;
      const baseB = 255 + (168 - 255) * mix;
      return {
        angle,
        radius,
        scatter: 0.9 + Math.random() * 0.35,
        turns: 4 + Math.random() * 4,
        drag: 20 + Math.random() * 30,
        size: 0.6 + Math.random() * 1.4,
        r: baseR,
        g: baseG,
        b: baseB,
      };
    });

    const MORPH_DURATION = 5000;
    const SWIRL_DURATION = 5000;
    const SHRINK_END = 0.6;
    const COLOR_START = 0.55;
    const COLOR_RANGE = 0.3;
    const FADE_START = 0.72;
    const FADE_END = 0.9;
    const start = performance.now();
    let rafId = 0;

    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    const tick = (now) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / MORPH_DURATION);
      const spinT = Math.min(1, elapsed / SWIRL_DURATION);
      const ease = easeOutCubic(t);
      const spinEase = easeOutCubic(spinT);
      const shrinkEase = easeOutCubic(Math.min(1, t / SHRINK_END));
      const expandEase = easeOutCubic(
        Math.max(0, (t - SHRINK_END) / (1 - SHRINK_END))
      );
      const fadeOut =
        t > FADE_START
          ? Math.max(0, 1 - (t - FADE_START) / (FADE_END - FADE_START))
          : 1;
      const colorMix = Math.min(1, Math.max(0, (t - COLOR_START) / COLOR_RANGE));

      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";

      particles.forEach((p) => {
        const spin = p.turns * Math.PI * 2 * spinEase * 0.5;
        const baseRadius = p.radius * Math.pow(1 - shrinkEase, 1.6) + 4;
        const targetRadius = Math.min(maxRadius, p.radius * p.scatter);
        const radius = baseRadius + expandEase * (targetRadius - baseRadius);
        const drag =
          p.drag * Math.pow(1 - shrinkEase, 0.7) + p.drag * 0.2 * expandEase;
        const angle = p.angle + spin + drag / maxRadius;
        const x =
          centerX + Math.cos(angle) * radius + Math.cos(angle + Math.PI / 2) * drag;
        const y =
          centerY + Math.sin(angle) * radius + Math.sin(angle + Math.PI / 2) * drag;
        const alpha = 0.9 * (0.35 + 0.65 * (1 - ease)) * fadeOut;
        const r = Math.round(255 * (1 - colorMix) + p.r * colorMix);
        const g = Math.round(255 * (1 - colorMix) + p.g * colorMix);
        const b = Math.round(255 * (1 - colorMix) + p.b * colorMix);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      if (elapsed < MORPH_DURATION) {
        rafId = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, width, height);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [introActive]);

  const handlePointerDown = (event) => {
    if (event.button !== 0) return;
    dragStateRef.current = {
      active: true,
      dragging: false,
      startX: event.clientX,
      startY: event.clientY,
      originX: internalDragOffset.x,
      originY: internalDragOffset.y,
    };

    const handlePointerMove = (moveEvent) => {
      if (!dragStateRef.current.active) return;
      const dx = moveEvent.clientX - dragStateRef.current.startX;
      const dy = moveEvent.clientY - dragStateRef.current.startY;
      if (!dragStateRef.current.dragging) {
        if (Math.hypot(dx, dy) < 4) return;
        dragStateRef.current.dragging = true;
        document.body.style.userSelect = "none";
      }
      setInternalDragOffset({
        x: dragStateRef.current.originX + dx,
        y: dragStateRef.current.originY + dy,
      });
    };

    const handlePointerUp = () => {
      dragStateRef.current.active = false;
      dragStateRef.current.dragging = false;
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  };

  const pointerDownHandler = onDragStart || handlePointerDown;

  return (
    <div className="pill-wrapper">
      <div className="pill-drag-shell" style={dragStyle}>
        <div 
          className={`pill-window ${dragOver ? 'drag-over' : ''}${introActive ? ' intro' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onPointerDown={pointerDownHandler}
          style={{ WebkitAppRegion: "drag" }}
          ref={pillRef}
        >
          {introActive && (
            <canvas className="pill-intro-canvas" ref={introCanvasRef} aria-hidden="true" />
          )}
          {showPlaceholder && children}
          <input
            className="pill-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            disabled={introActive}
            style={{ WebkitAppRegion: "no-drag" }}
          />
        </div>
      </div>
    </div>
  );
}

export default SearchBar;
