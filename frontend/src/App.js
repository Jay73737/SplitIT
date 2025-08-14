import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import WindowWrapper from "./WindowWrapper";
import SearchBar from "./SearchBar";
import ResultsWindow from "./ResultsWindow";
import DashboardView from "./DashboardView";
import "./App.css";

// Rotating helper messages for the search bar
const messages = ["Type in a search", "Paste a link", "Drop in a file"];
const PANEL_HEIGHT = 478;
const DASHBOARD_HEIGHT = 1200;

export default function App() {
  const [results, setResults] = useState([]);
  const [msgIdx, setMsgIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Cycle through helper messages every 3 seconds
  useEffect(() => {
    const id = setInterval(
      () => setMsgIdx((i) => (i + 1) % messages.length),
      3000
    );
    return () => clearInterval(id);
  }, []);

  // Notify Electron main process to resize the window depending on state
  useEffect(() => {
    if (selected) {
      window.electronAPI?.resultsOpened(DASHBOARD_HEIGHT);
    } else if (results.length > 0) {
      window.electronAPI?.resultsOpened(PANEL_HEIGHT);
    } else {
      window.electronAPI?.resultsClosed();
    }
  }, [results.length, selected]);

  // Perform a YouTube search and set results
  const handleSearch = async (term) => {
    const q = term.trim();
    if (!q) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const key = process.env.REACT_APP_YT_API_KEY || "";
      const base = "https://www.googleapis.com/youtube/v3";

      const sURL = `${base}/search?part=snippet&type=video&maxResults=8&q=${encodeURIComponent(
        q
      )}${key ? `&key=${key}` : ""}`;
      const { items } = await (await fetch(sURL)).json();
      if (!items?.length) {
        setResults([]);
        return;
      }
      const ids = items.map((i) => i.id.videoId).join(",");
      const dURL = `${base}/videos?part=contentDetails&id=${ids}${
        key ? `&key=${key}` : ""
      }`;
      const { items: details } = await (await fetch(dURL)).json();
      const dur = Object.fromEntries(
        details.map((d) => [d.id, d.contentDetails.duration])
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
    } finally {
      setLoading(false);
    }
  };

  return (
    // The outer wrapper ensures that children are positioned relative to it
    <WindowWrapper>
      {selected ? (
        <DashboardView video={selected} onBack={() => setSelected(null)} />
      ) : (
        <>
          <SearchBar onSearch={handleSearch} loading={loading}>
            <span key={msgIdx} className="pill-text">
              {messages[msgIdx]}
            </span>
          </SearchBar>
          {error && <div className="error-banner">{error}</div>}
          <AnimatePresence initial={false}>
            {results.length > 0 && !loading && (
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
