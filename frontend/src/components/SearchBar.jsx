import React, { useState } from "react";
import usePlaceholderCycle from "./PlaceholderCycler.jsx";
import * as styles from "./SearchBar.module.css";              

export default function SearchBar({ onSearch }) {
  const [value, setValue] = useState("");

  
  const placeholder = usePlaceholderCycle([
    "Drop in a file…",
    "Paste a URL…",
    "Type and search…",
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
    </form>
  );
}