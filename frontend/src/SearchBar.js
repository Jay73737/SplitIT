import { useState } from "react";
import "./App.css";

function SearchBar({ onSearch, loading, children }) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const trimmed = value.trim();
      if (trimmed) onSearch(trimmed);
    }
  };

  return (
    <div className="pill-wrapper" style={{ WebkitAppRegion: "drag" }}>
      <div className="pill-window">
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
