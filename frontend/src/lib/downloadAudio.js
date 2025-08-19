export const API_BASE = process.env.REACT_APP_API_BASE ?? "http://localhost:5050";

/** Ask backend to download audio, then fetch the bytes and give a Blob URL */
export async function downloadAudioBlob(
  sourceUrl,
  format = "mp3",
  signal
) {
  const metaRes = await fetch(`${API_BASE}/api/download-audio`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceUrl, format }),
    signal,
  });
  
  if (!metaRes.ok) {
    const errorText = await metaRes.text();
    throw new Error(`download-audio failed: ${errorText}`);
  }
  
  const meta = await metaRes.json();

  const audioRes = await fetch(`${API_BASE}${meta.streamUrl}`, { signal });
  if (!audioRes.ok) {
    const errorText = await audioRes.text();
    throw new Error(`audio fetch failed: ${errorText}`);
  }
  
  const blob = await audioRes.blob();
  const objectUrl = URL.createObjectURL(blob);
  return { objectUrl, mime: meta.mime, id: meta.id };
}