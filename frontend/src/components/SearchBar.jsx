import React, { useState } from "react";
import usePlaceholderCycle from "./PlaceholderCycler.jsx";
import * as styles from "./SearchBar.module.css";              

export default function SearchBar({ onSearch, isRunning }) {
  const [value, setValue] = useState("");

  const placeholder = usePlaceholderCycle([
    "Search YouTube for a track...",
    "Find a song, then split it...",
    "Paste a title, artist, or URL hint...",
  ]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch && onSearch(value.trim());
  };

  return (
    <form className={styles.searchContainer} onSubmit={handleSubmit}>
      <input
        className={styles.searchInput}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
      />
      <button className={styles.submitButton} type="submit" disabled={isRunning || !value.trim()}>
        {isRunning ? "Searching..." : "Search"}
      </button>
    </form>
  );
}