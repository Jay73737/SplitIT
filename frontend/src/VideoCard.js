import "./App.css";

function formatDuration(iso) {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return "";
  const h = parseInt(match[1] || 0, 10);
  const m = parseInt(match[2] || 0, 10);
  const s = parseInt(match[3] || 0, 10);
  const parts = [];
  if (h) parts.push(h);
  parts.push(h ? String(m).padStart(2, "0") : m);
  parts.push(String(s).padStart(2, "0"));
  return parts.join(":");
}

function VideoCard({ video, onSelect }) {
  const handleClick = () => {
    if (onSelect) onSelect(video);
  };

  return (
    <div
      className="video-card"
      onClick={handleClick}
      style={{ WebkitAppRegion: "no-drag" }}
    >
      <img src={video.thumbnail} alt="thumbnail" className="thumbnail" />
      <div className="video-title">{video.title}</div>
      <div className="video-meta">
        <span>{formatDuration(video.duration)}</span>
        <span className="yt-badge">YT</span>
      </div>
    </div>
  );
}

export default VideoCard;
