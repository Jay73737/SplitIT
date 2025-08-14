import React, { useState } from "react";
import styles from "./Dashboard.module.css";

export default function Dashboard({ info, onSplit }) {
  const [model, setModel] = useState("htdemucs");
  const [stems, setStems] = useState({
    vocals: true,
    drums: false,
    bass: false,
    other: false,
  });

  const toggleStem = (name) => {
    setStems((s) => ({ ...s, [name]: !s[name] }));
  };

  const handleSplit = () => {
    const chosen = Object.keys(stems).filter((k) => stems[k]);
    onSplit({ model, stems: chosen });
  };

  return (
    <div className={styles.dashboard}>
      <h2>{info.title}</h2>
      <div style={{ marginBottom: 8 }}>
        <label>
          Model:{" "}
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            <option value="htdemucs">Demucs</option>
            <option value="spleeter">Spleeter</option>
            <option value="openunmix">OpenUnmix</option>
          </select>
        </label>
      </div>
      <div style={{ marginBottom: 8 }}>
        {Object.keys(stems).map((name) => (
          <label key={name} style={{ marginRight: 8 }}>
            <input
              type="checkbox"
              checked={stems[name]}
              onChange={() => toggleStem(name)}
            />
            {name}
          </label>
        ))}
      </div>
      <button
        onClick={handleSplit}
        style={{
          background: "linear-gradient(90deg,#ff00a1,#2a00ff)",
          color: "white",
          border: "none",
          borderRadius: 16,
        }}
      >
        Split Audio
      </button>
    </div>
  );
}
