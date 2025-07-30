import React from "react";

export default function Results({ results, onSelect }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
      {results.map((r) => (
        <div key={r.id} className="card" onClick={() => onSelect(r)}>
          <img
            src={r.thumbnail}
            alt="thumb"
            style={{ width: "100%", borderRadius: 4 }}
          />
          <div>{r.title}</div>
          <small>{r.duration}</small>
        </div>
      ))}
    </div>
  );
}
