import { useEffect, useState } from "react";
import WavesurferPlayer from "@wavesurfer/react";

export default function WaveformPlayer({ url, height = 96, onWaveformReady, onPlayStateChange }) {
  const [ws, setWs] = useState(null);
  const [ready, setReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  useEffect(() => {
    setReady(false);
    setIsPlaying(false);
  }, [url]);

  return (
    <div className={`w-full ${isPlaying ? 'waveform-playing' : ''}`} style={{ position: 'relative' }}>
      <WavesurferPlayer
        url={url ?? undefined}
        height={120}
        barWidth={3}
        barGap={1}
        barRadius={2}
        cursorWidth={2}
        normalize={false}
        interact={true}
        autoCenter={false}
        autoScroll={false}
        hideScrollbar={true}
        waveColor="rgba(59, 130, 246, 0.4)"
        progressColor="rgba(236, 72, 153, 0.8)"
        onReady={(instance) => {
          setWs(instance);
          setReady(true);
          // Zoom out to show full audio track
          instance.zoom(0.5);
          onWaveformReady?.(instance);
        }}
        onPlay={() => {
          setIsPlaying(true);
          onPlayStateChange?.(true);
        }}
        onPause={() => {
          setIsPlaying(false);
          onPlayStateChange?.(false);
        }}
        onError={(e) => console.error("WaveSurfer error:", e)}
      />
      {/* Play controls moved to main transport controls */}
    </div>
  );
}
