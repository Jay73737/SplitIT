import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import WindowWrapper from "./WindowWrapper";
import SearchBar from "./SearchBar";
import ResultsWindow from "./ResultsWindow";
import DashboardView from "./DashboardView";
import useMirrorPillToOSWindow from "./useMirrorPillToOSWindow";
import { useSelection } from "./store/selection";
import "./App.css";

const messages = ["Type in a search", "Paste a link", "Drop in a file"];
const PANEL_HEIGHT = 478;  // Updated to match actual content height
const DASHBOARD_HEIGHT = 900;  // Updated to match dashboard height

export default function App() {
  useMirrorPillToOSWindow(".pill-window", 39);

  const [results, setResults] = useState([]);
  const [msgIdx, setMsgIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { selected: backendSelected, setSelected: setBackendSelected } = useSelection();

  useEffect(() => {
    const id = setInterval(
      () => setMsgIdx((i) => (i + 1) % messages.length),
      3000
    );
    return () => clearInterval(id);
  }, []);

  // Receive Enter from OS pill -> run the search
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onPillSubmit) return;
    api.onPillSubmit(async (value) => {
      await handleSearch(value || "");
    });
  }, []);

  // Open the panel as soon as a search starts (or when selected/dashboard shown)
  useEffect(() => {
    if (selected || backendSelected) {
      window.electronAPI?.resultsOpened?.(DASHBOARD_HEIGHT);
    } else if (loading || results.length > 0) {
      window.electronAPI?.resultsOpened?.(PANEL_HEIGHT);
    } else {
      window.electronAPI?.resultsClosed?.();
    }
  }, [loading, results.length, selected, backendSelected]);

  const handleAudioDrop = (audioFile) => {
    // Create a mock video object for the dashboard view
    const mockVideo = {
      id: `audio_${Date.now()}`,
      title: audioFile.name.replace(/\.[^/.]+$/, ""), // Remove file extension
      thumbnail: null, // No thumbnail for audio files
      channel: "Local File",
      duration: "", // Will be determined when loaded
      isLocalFile: true,
      file: audioFile,
      filePath: URL.createObjectURL(audioFile)
    };

    setSelected(mockVideo);
    setResults([]);
    setError(null);
  };

  const handleSearch = async (term) => {
    const q = (term || "").trim();
    if (!q) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true); // <-- this opens the panel immediately via effect
    setError(null);

    try {
      const key = process.env.REACT_APP_YT_API_KEY || "";
      const base = "https://www.googleapis.com/youtube/v3";

      const sURL = `${base}/search?part=snippet&type=video&maxResults=8&q=${encodeURIComponent(
        q
      )}${key ? `&key=${key}` : ""}`;
      const sRes = await fetch(sURL);
      const { items } = await sRes.json();

      if (!items?.length) {
        setResults([]);
        setError("No results.");
        return;
      }

      const ids = items.map((i) => i.id.videoId).join(",");
      const dURL = `${base}/videos?part=contentDetails&id=${ids}${
        key ? `&key=${key}` : ""
      }`;
      const dRes = await fetch(dURL);
      const { items: details } = await dRes.json();
      const dur = Object.fromEntries(
        (details || []).map((d) => [d.id, d.contentDetails.duration])
      );

      setResults(
        items.map((i) => ({
          id: i.id.videoId,
          title: i.snippet.title,
          thumbnail: i.snippet.thumbnails.medium.url,
          channel: i.snippet.channelTitle,
          duration: dur[i.id.videoId] ?? "",
        }))
      );
    } catch (e) {
      console.error(e);
      setError("Search failed – please try again.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const currentSelection = selected || (backendSelected ? {
    id: backendSelected.sourceUrl?.includes('youtube.com/watch?v=') 
      ? backendSelected.sourceUrl.split('v=')[1]?.split('&')[0] 
      : null,
    title: backendSelected.title,
    channel: "YouTube",
    isLocalFile: false
  } : null);

  return (
    <WindowWrapper>
      {currentSelection ? (
        <DashboardView 
          video={currentSelection} 
          onBack={() => {
            setSelected(null);
            setBackendSelected(null);
          }} 
        />
      ) : (
        <>
          {/* DOM pill stays for geometry only; hidden in Electron via CSS */}
          <SearchBar onSearch={handleSearch} onAudioDrop={handleAudioDrop} loading={loading}>
            <span key={msgIdx} className="pill-text">
              {messages[msgIdx]}
            </span>
          </SearchBar>

          {error && <div className="error-banner">{error}</div>}

          <AnimatePresence initial={false} mode="popLayout">
            {loading && results.length === 0 && (
              <motion.div
                key="loading-panel"
                className="results-window"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.18 }}
              >
                <div className="loading-center">Searching…</div>
              </motion.div>
            )}

            {!loading && results.length > 0 && (
              <ResultsWindow
                key="results"
                results={results}
                onSelect={setSelected}
              />
            )}
          </AnimatePresence>
        </>
      )}
    </WindowWrapper>
  );
}
