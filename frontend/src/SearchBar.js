import { useState } from "react";
import "./App.css";

function SearchBar({ onSearch, onAudioDrop, loading, children }) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [dragOver, setDragOver] = useState(false);

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

  return (
    <div className="pill-wrapper" style={{ WebkitAppRegion: "drag" }}>
      <div 
        className={`pill-window ${dragOver ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {!value && !focused && children}
        <input
          className="pill-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ WebkitAppRegion: "no-drag" }}
        />
      </div>
    </div>
  );
}

export default SearchBar;
