import React, { useMemo, useState } from "react";
import SearchBar from "./components/SearchBar.jsx";
import SearchResults from "./components/SearchResults.jsx";
import StemCard from "./components/StemCard.jsx";

export default function App() {
  // Source: either an uploaded file or a selected YouTube video
  const [file, setFile] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);

  // YouTube search state
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Split params
  const [model, setModel] = useState("htdemucs");
  const [instruments, setInstruments] = useState("vocals,drums,bass,other");
  const [shifts, setShifts] = useState(1);
  const [overlap, setOverlap] = useState(0.5);
  const [device, setDevice] = useState("cuda:0");

  // Job lifecycle
  const [jobId, setJobId] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [stems, setStems] = useState([]);

  const apiBase = useMemo(() => {
    const fromQuery = new URLSearchParams(window.location.search).get("api");
    if (fromQuery) return fromQuery;
    const envBase = process.env.REACT_APP_API_BASE;
    if (envBase) return envBase;
    if (window.location.protocol === "file:") return "http://127.0.0.1:8000";
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }, []);

  const handleSearch = async (query) => {
    if (!query) return;
    setError("");
    setIsSearching(true);
    setSearchResults([]);
    try {
      const res = await fetch(`${apiBase}/api/youtube/search?q=${encodeURIComponent(query)}&limit=8`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Search failed (${res.status})`);
      }
      const data = await res.json();
      setSearchResults(data.items || []);
    } catch (err) {
      setError(err.message || "YouTube search failed");
    } finally {
      setIsSearching(false);
    }
  };

  const handleVideoSelect = (video) => {
    setSelectedVideo(video);
    setFile(null); // selecting a video clears any uploaded file
  };

  const handleFilePick = (picked) => {
    setFile(picked);
    setSelectedVideo(null); // uploading clears any selected video
  };

  const pollJob = async (createdJobId) => {
    while (true) {
      const res = await fetch(`${apiBase}/api/jobs/${createdJobId}`);
      if (!res.ok) {
        setStatus("failed");
        setError("Could not fetch job status");
        return;
      }
      const data = await res.json();
      setStatus(data.status);
      if (data.status === "completed") {
        setDownloadUrl(`${apiBase}${data.download_url}`);
        try {
          const stemsRes = await fetch(`${apiBase}/api/jobs/${createdJobId}/stems`);
          if (stemsRes.ok) {
            const stemsData = await stemsRes.json();
            setStems(stemsData.stems || []);
          }
        } catch {
          // playback is optional - don't fail the job over it
        }
        return;
      }
      if (data.status === "failed") {
        setError(data.error || "Job failed");
        return;
      }
      await new Promise((r) => setTimeout(r, 2500));
    }
  };

  const submitJob = async (event) => {
    event.preventDefault();
    setError("");
    setDownloadUrl("");
    setStems([]);

    if (!file && !selectedVideo) {
      setError("Pick a file or select a YouTube result first.");
      return;
    }

    try {
      let res;
      if (selectedVideo) {
        setStatus("queued");
        const body = new FormData();
        body.append("video_id", selectedVideo.id);
        body.append("model", model);
        body.append("instruments", instruments);
        body.append("shifts", String(shifts));
        body.append("overlap", String(overlap));
        body.append("device", device);
        res = await fetch(`${apiBase}/api/youtube/jobs`, { method: "POST", body });
      } else {
        setStatus("uploading");
        const body = new FormData();
        body.append("file", file);
        body.append("model", model);
        body.append("instruments", instruments);
        body.append("shifts", String(shifts));
        body.append("overlap", String(overlap));
        body.append("device", device);
        res = await fetch(`${apiBase}/api/jobs`, { method: "POST", body });
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to create job");
      }

      const data = await res.json();
      setJobId(data.job_id);
      setStatus("queued");
      await pollJob(data.job_id);
    } catch (err) {
      setStatus("failed");
      setError(err.message || "Unexpected error");
    }
  };

  const isRunning = ["uploading", "queued", "running", "downloading"].includes(status);

  return (
    <main className="page-shell">
      <section className="hero-card">
        <h1>SplitIT</h1>
        <p>Search YouTube or upload a track. Pick stems. Get a ZIP.</p>

        <div style={{ marginTop: 18 }}>
          <SearchBar onSearch={handleSearch} isRunning={isSearching} />
        </div>

        {searchResults.length > 0 && (
          <SearchResults
            items={searchResults}
            selectedId={selectedVideo?.id}
            onSelect={handleVideoSelect}
          />
        )}

        <form className="split-form" onSubmit={submitJob}>
          <label>
            Or upload a file
            <input
              type="file"
              accept="audio/*,.wav,.mp3,.flac,.m4a"
              onChange={(e) => handleFilePick(e.target.files?.[0] || null)}
            />
          </label>

          {selectedVideo && (
            <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.85rem" }}>
              Source: <strong style={{ color: "var(--text)" }}>{selectedVideo.title}</strong>
            </p>
          )}

          <label>
            Model
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              <option value="htdemucs">htdemucs</option>
              <option value="htdemucs_ft">htdemucs_ft</option>
              <option value="mdx_extra">mdx_extra</option>
              <option value="htdemucs_6s">htdemucs_6s</option>
              <option value="combo">combo</option>
            </select>
          </label>

          <label>
            Instruments (comma-separated)
            <input
              type="text"
              value={instruments}
              onChange={(e) => setInstruments(e.target.value)}
            />
          </label>

          <div className="inline-grid">
            <label>
              Shifts
              <input
                type="number"
                min="1"
                max="20"
                value={shifts}
                onChange={(e) => setShifts(Number(e.target.value || 1))}
              />
            </label>

            <label>
              Overlap
              <input
                type="number"
                min="0"
                max="0.95"
                step="0.05"
                value={overlap}
                onChange={(e) => setOverlap(Number(e.target.value || 0.5))}
              />
            </label>
          </div>

          <label>
            Device
            <input
              type="text"
              value={device}
              onChange={(e) => setDevice(e.target.value)}
              placeholder="cuda:0 or cpu"
            />
          </label>

          <button type="submit" disabled={isRunning}>
            {status === "uploading" ? "Uploading…"
              : status === "downloading" ? "Downloading…"
              : status === "queued" ? "Queued…"
              : status === "running" ? "Splitting…"
              : "Start Split"}
          </button>
        </form>

        <div className="status-box">
          <p>
            Status: <span className={`status-pill ${status}`}>{status}</span>
          </p>
          {jobId ? <p>Job ID: {jobId}</p> : null}
          {error ? <p className="error-text">Error: {error}</p> : null}
          {downloadUrl ? (
            <a className="download-link" href={downloadUrl} target="_blank" rel="noreferrer">
              Download All as ZIP
            </a>
          ) : null}
        </div>

        {stems.length > 0 && (
          <div className="stem-grid">
            {stems.map((stem) => (
              <StemCard
                key={stem.name}
                stem={stem}
                streamUrl={`${apiBase}${stem.url}`}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
