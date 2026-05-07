import React, { useMemo, useState } from "react";

export default function App() {
  const [file, setFile] = useState(null);
  const [model, setModel] = useState("htdemucs");
  const [instruments, setInstruments] = useState("vocals,drums,bass,other");
  const [shifts, setShifts] = useState(1);
  const [overlap, setOverlap] = useState(0.5);
  const [device, setDevice] = useState("cuda:0");
  const [jobId, setJobId] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");

  const apiBase = useMemo(() => {
    const fromQuery = new URLSearchParams(window.location.search).get("api");
    if (fromQuery) return fromQuery;
    const envBase = process.env.REACT_APP_API_BASE;
    if (envBase) return envBase;
    if (window.location.protocol === "file:") return "http://127.0.0.1:8000";
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }, []);

  const pollJob = async (createdJobId) => {
    let keepPolling = true;

    while (keepPolling) {
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
        keepPolling = false;
      } else if (data.status === "failed") {
        setError(data.error || "Job failed");
        keepPolling = false;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }
    }
  };

  const submitJob = async (event) => {
    event.preventDefault();
    setError("");
    setDownloadUrl("");
    setStatus("uploading");

    if (!file) {
      setError("Choose an audio file first.");
      setStatus("idle");
      return;
    }

    const body = new FormData();
    body.append("file", file);
    body.append("model", model);
    body.append("instruments", instruments);
    body.append("shifts", String(shifts));
    body.append("overlap", String(overlap));
    body.append("device", device);

    try {
      const res = await fetch(`${apiBase}/api/jobs`, {
        method: "POST",
        body,
      });

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

  return (
    <main className="page-shell">
      <section className="hero-card">
        <h1>SplitIT Web</h1>
        <p>
          Upload a track, run Demucs on the server, and download stems as a ZIP.
        </p>

        <form className="split-form" onSubmit={submitJob}>
          <label>
            Audio File
            <input
              type="file"
              accept="audio/*,.wav,.mp3,.flac,.m4a"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>

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

          <button type="submit">Start Split</button>
        </form>

        <div className="status-box">
          <p>Status: {status}</p>
          {jobId ? <p>Job ID: {jobId}</p> : null}
          {error ? <p className="error-text">Error: {error}</p> : null}
          {downloadUrl ? (
            <a href={downloadUrl} target="_blank" rel="noreferrer">
              Download Stems ZIP
            </a>
          ) : null}
        </div>
      </section>
    </main>
  );
}