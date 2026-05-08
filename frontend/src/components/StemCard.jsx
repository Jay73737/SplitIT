import React from "react";

const STEM_ICONS = {
  vocals: "🎤",
  drums: "🥁",
  bass: "🎸",
  guitar: "🎼",
  piano: "🎹",
  other: "🎶",
};

export default function StemCard({ stem, streamUrl }) {
  const canDragOut = typeof window !== "undefined"
    && window.splitit
    && typeof window.splitit.startDrag === "function"
    && stem.local_path;

  const handleDragStart = (event) => {
    if (!canDragOut) return;
    // Suppress the browser's default drag (which would try to drag the DOM
    // element as text/url) so Electron's native OS-file drag can take over.
    event.preventDefault();
    window.splitit.startDrag(stem.local_path);
  };

  const icon = STEM_ICONS[stem.name?.toLowerCase()] || STEM_ICONS.other;
  const sizeMb = stem.size_bytes ? (stem.size_bytes / (1024 * 1024)).toFixed(1) : null;

  return (
    <div
      className="stem-card"
      draggable={canDragOut}
      onDragStart={handleDragStart}
      title={canDragOut ? "Drag onto your DAW or a folder" : "Drag-out is only available in the desktop app"}
    >
      <div className="stem-card__head">
        <span className="stem-card__icon">{icon}</span>
        <div className="stem-card__name">{stem.name}</div>
        {sizeMb && <div className="stem-card__size">{sizeMb} MB</div>}
      </div>
      <audio className="stem-card__audio" src={streamUrl} controls preload="metadata" />
      <div className="stem-card__hint">
        {canDragOut ? "↗ Drag this card to export" : "Open in desktop app to drag"}
      </div>
    </div>
  );
}
