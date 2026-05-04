import React, { useState, useRef, useEffect } from "react";
import SearchBar from "./components/SearchBar.jsx";
import SearchResults from "./components/SearchResults.jsx";

const MODEL_STEMS = {
  htdemucs:    ["vocals", "drums", "bass", "other"],
  htdemucs_ft: ["vocals", "drums", "bass", "other"],
  htdemucs_6s: ["vocals", "drums", "bass", "other", "guitar", "piano"],
  mdx:         ["vocals", "drums", "bass", "other"],
  mdx_extra:   ["vocals", "drums", "bass", "other"],
};
const MODEL_OPTIONS = Object.keys(MODEL_STEMS);
const MODEL_LABELS = {
  htdemucs_ft: "htdemucs_ft ★ Best quality",
  htdemucs:    "htdemucs — Good, faster than ft",
  htdemucs_6s: "htdemucs_6s — Adds guitar & piano stems",
  mdx_extra:   "mdx_extra — Alternative, slower",
  mdx:         "mdx — Base MDX, lower quality",
};
const MODEL_HINTS = {
  htdemucs_ft: "Recommended for most tracks. Best overall quality.",
  htdemucs:    "Good quality but not as refined as htdemucs_ft.",
  htdemucs_6s: "Use this only if you need guitar or piano separated. Slower.",
  mdx_extra:   "Alternative architecture. Comparable quality, but noticeably slower.",
  mdx:         "Base MDX model. Lower quality than htdemucs_ft or mdx_extra.",
};

function mapStemFiles(payload) {
  return (payload.files || []).map((path) => {
    const stemName = path.split("/").pop()?.replace(/\.wav$/i, "") || "stem";
    return {
      id: `${payload.job_id}-${stemName}`,
      name: stemName,
      url: path,
      model: payload.model,
    };
  });
}

/** Poll /api/job/:id until done, calling onProgress(pct) and returning final result. */
async function pollJob(jobId, onProgress, intervalMs = 800, maxWaitMs = 8 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const timer = setInterval(async () => {
      try {
        if (Date.now() - startedAt > maxWaitMs) {
          clearInterval(timer);
          return reject(new Error("Split timed out. If you are using YouTube, check that your SSH tunnel is connected and try again."));
        }
        const res = await fetch(`/api/job/${jobId}`);
        const data = await res.json();
        if (!res.ok) { clearInterval(timer); return reject(new Error(data.detail || "Job failed")); }
        onProgress(data.pct ?? 0);
        if (data.done) {
          clearInterval(timer);
          if (data.error) return reject(new Error(data.error));
          resolve(data.result);
        }
      } catch (err) {
        clearInterval(timer);
        reject(err);
      }
    }, intervalMs);
  });
}

export default function App() {
  const [results, setResults] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [model, setModel] = useState("htdemucs_ft");
  const [selectedStems, setSelectedStems] = useState(MODEL_STEMS["htdemucs_ft"]);

  const handleModelChange = (newModel) => {
    setModel(newModel);
    // Reset selections to all stems available for the new model
    setSelectedStems(MODEL_STEMS[newModel] || []);
  };
  const [downloads, setDownloads] = useState([]);
  const [status, setStatus] = useState("Search YouTube, pick a track, and split stems on the server.");
  const [ytBlocked, setYtBlocked] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [tunnelUp, setTunnelUp] = useState(null); // null=unknown, true=up, false=down

  useEffect(() => {
    const check = () =>
      fetch("/api/status")
        .then((r) => r.json())
        .then((d) => setTunnelUp(d.tunnel ?? false))
        .catch(() => setTunnelUp(false));
    check();
    const id = setInterval(check, 10000);
    return () => clearInterval(id);
  }, []);

  const toggleStem = (stem) => {
    setSelectedStems((current) => {
      if (current.includes(stem)) {
        return current.length === 1 ? current : current.filter((item) => item !== stem);
      }
      return [...current, stem];
    });
  };

  const handleSearch = async (query) => {
    if (!query) {
      setStatus("Enter a search term first.");
      return;
    }

    try {
      setIsSearching(true);
      setSelectedVideo(null);
      setDownloads([]);
      setStatus(`Searching YouTube for \"${query}\"...`);

      const response = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}`);

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail || "Search failed.");
      }

      const items = payload.items || [];
      setResults(items);
      setStatus(items.length ? "Pick a result to start splitting." : "No YouTube matches were found.");
    } catch (err) {
      console.error(err);
      setStatus(err.message || "Search failed.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelect = (item) => {
    setSelectedVideo(item);
    setUploadedFile(null);
    setDownloads([]);
    setYtBlocked(false);
    setStatus(`Ready to split ${item.title}.`);
  };

  const handleUploadChange = (event) => {
    const file = event.target.files?.[0] || null;
    setUploadedFile(file);
    setSelectedVideo(null);
    setDownloads([]);
    if (file) {
      setStatus(`Ready to split ${file.name}.`);
    }
  };

  const handleYoutubeSplit = async () => {
    if (!selectedVideo) {
      setStatus("Choose a YouTube result before starting the split.");
      return;
    }

    try {
      setIsRunning(true);
      setProgress(0);
      setDownloads([]);
      setStatus(`Downloading and splitting ${selectedVideo.title}. This can take a few minutes.`);

      const formData = new FormData();
      formData.append("video_id", selectedVideo.id);
      formData.append("model", model);
      formData.append("stems", selectedStems.join(","));

      const response = await fetch("/api/youtube/split", { method: "POST", body: formData });
      const { job_id } = await response.json();
      if (!response.ok || !job_id) throw new Error("Failed to start job.");

      const payload = await pollJob(job_id, (pct) => setProgress(pct));
      setYtBlocked(false);
      setProgress(100);
      setDownloads(mapStemFiles(payload));
      setStatus(`Finished splitting ${selectedVideo.title}.`);
    } catch (err) {
      console.error(err);
      if (err.message && err.message.toLowerCase().includes("youtube blocked")) {
        setYtBlocked(true);
        setStatus(`YouTube download is currently unavailable. You can still upload the file directly.`);
      } else {
        setStatus(err.message || "YouTube split failed.");
      }
    } finally {
      setIsRunning(false);
    }
  };

  const handleUploadSplit = async () => {
    if (!uploadedFile) {
      setStatus("Choose a local audio file before starting the split.");
      return;
    }

    try {
      setIsRunning(true);
      setProgress(0);
      setDownloads([]);
      setStatus(`Uploading and splitting ${uploadedFile.name}. This can take a few minutes.`);

      const formData = new FormData();
      formData.append("file", uploadedFile);
      formData.append("model", model);
      formData.append("stems", selectedStems.join(","));

      const response = await fetch("/api/split", { method: "POST", body: formData });
      const { job_id } = await response.json();
      if (!response.ok || !job_id) throw new Error("Failed to start job.");

      const payload = await pollJob(job_id, (pct) => setProgress(pct));
      setProgress(100);
      setDownloads(mapStemFiles(payload));
      setStatus(`Finished splitting ${uploadedFile.name}.`);
    } catch (err) {
      console.error(err);
      setStatus(err.message || "Split failed.");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <main className="app-shell">
      <section className="hero-copy">
        <span className="eyebrow">SplitIT Web Studio</span>
        <h1>Search a track, then split clean stems in the browser.</h1>
        <p>{status}</p>
        {tunnelUp !== null && (
          <p className={tunnelUp ? "tunnel-badge tunnel-up" : "tunnel-badge tunnel-down"}>
            {tunnelUp ? "SSH tunnel ✓ connected" : "SSH tunnel ✗ disconnected — YouTube splitting unavailable"}
          </p>
        )}
      </section>

      <div className="search-glass">
        <SearchBar onSearch={handleSearch} isRunning={isSearching} />
      </div>
      <SearchResults items={results} selectedId={selectedVideo?.id} onSelect={handleSelect} />

      <section className="control-panel">
        <div className="source-card">
          <div className="panel-label">Selected Source</div>
          {selectedVideo ? (
            <>
              <img className="source-thumb" src={selectedVideo.thumb} alt={selectedVideo.title} />
              <h2>{selectedVideo.title}</h2>
              <p>{selectedVideo.channel}</p>
              {ytBlocked ? (
                <div className="yt-blocked-notice">
                  <strong>YouTube download unavailable</strong>
                  <span>YouTube is blocking downloads from this server. You can fix this by running one command on your PC to tunnel traffic through it, or download the track yourself and use the local upload option below.</span>
                </div>
              ) : null}
              <button className="primary-action" type="button" onClick={handleYoutubeSplit} disabled={isRunning || ytBlocked}>
                {isRunning ? "Processing..." : "Download and Split from YouTube"}
              </button>
              {isRunning && (
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${progress}%` }} />
                  <span className="progress-label">{Math.round(progress)}%</span>
                </div>
              )}
            </>
          ) : (
            <div className="empty-card">Pick a YouTube result above or use the local upload option.</div>
          )}
        </div>

        <div className="split-card">
          <div className="panel-label">Split Settings</div>
          <label className="stack-field">
            <span>Model</span>
            <select value={model} onChange={(e) => handleModelChange(e.target.value)}>
              {MODEL_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {MODEL_LABELS[option] || option}
                </option>
              ))}
            </select>
          </label>
          {MODEL_HINTS[model] && (
            <p className="model-hint">{MODEL_HINTS[model]}</p>
          )}

          <div className="stack-field">
            <span>Stems</span>
            <div className="stem-grid">
              {(MODEL_STEMS[model] || []).map((stem) => (
                <label key={stem} className="stem-pill">
                  <input
                    type="checkbox"
                    checked={selectedStems.includes(stem)}
                    onChange={() => toggleStem(stem)}
                  />
                  <span>{stem}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="upload-block">
            <div className="panel-label">Local Upload</div>
            <label className="upload-picker">
              <span>{uploadedFile ? uploadedFile.name : "Choose an audio file"}</span>
              <input type="file" accept="audio/*" onChange={handleUploadChange} />
            </label>
            <button className="secondary-action" type="button" onClick={handleUploadSplit} disabled={isRunning || !uploadedFile}>
              {isRunning ? "Processing..." : "Upload and Split"}
            </button>
            {isRunning && (
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
                <span className="progress-label">{Math.round(progress)}%</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {downloads.length ? (
        <section className="downloads-panel">
          <div className="panel-heading">
            <span className="eyebrow">Ready</span>
            <h2>Stem Downloads</h2>
          </div>
          <div className="downloads-grid">
            {downloads.map((item) => (
              <article key={item.id} className="download-card">
                <div className="download-stem">{item.name}</div>
                <div className="download-model">Model: {item.model}</div>
                <a href={item.url} target="_blank" rel="noreferrer">
                  Open WAV
                </a>
                <a href={item.url} download>
                  Download WAV
                </a>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}