import React, { useState } from "react";
import { CustomCard as GlassContainer } from "@tsamantanis/react-glassmorphism";
import "@tsamantanis/react-glassmorphism/dist/index.css";
import SearchBar from "./components/SearchBar.jsx";
import SearchResults from "./components/SearchResults.jsx";

export default function App() {
  const [results, setResults] = useState([]);

  const handleSearch = async (q) => {
    if (!q) return;
    const API_KEY = process.env.REACT_APP_YOUTUBE_API_KEY;
    if (!API_KEY) {
      console.error("YouTube API key is missing. Please set REACT_APP_YOUTUBE_API_KEY in your environment.");
      return;
    }
    const url =
      "https://www.googleapis.com/youtube/v3/search" +
      `?part=snippet&type=video&maxResults=8&q=${encodeURIComponent(q)}` +
      `&key=${API_KEY}`;

    try {
      const r = await fetch(url);
      const js = await r.json();
      const items = (js.items ?? []).map((i) => ({
        id: i.id.videoId,
        title: i.snippet.title,
        thumb: i.snippet.thumbnails.medium.url,
        channel: i.snippet.channelTitle,
      }));
      setResults(items);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      <GlassContainer
        effectColor="#FFFFFF"
        blur={20}
        borderRadius={36}
        color="rgba(255,255,255,0.08)"
        style={{ width: "100%", display: "flex", justifyContent: "center" }}
      >
        <SearchBar onSearch={handleSearch} />
      </GlassContainer>
      <SearchResults items={results} />
    </>
  );
}