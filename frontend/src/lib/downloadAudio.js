export const API_BASE = process.env.REACT_APP_API_BASE ?? "http://localhost:5050";

async function readError(response, fallbackMessage) {
  try {
    const data = await response.clone().json();
    const detail = data?.detail ?? data?.error ?? data?.message;
    if (detail) return detail;
  } catch (err) {
    /* ignore JSON parse errors */
  }

  try {
    const text = await response.text();
    if (text) return text;
  } catch (err) {
    /* ignore body read errors */
  }

  return fallbackMessage;
}

/** Ask backend to download audio, then fetch the bytes and give back a Blob + object URL */
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
    const message = await readError(metaRes, "download-audio failed");
    throw new Error(message);
  }

  const meta = await metaRes.json();

  const audioRes = await fetch(`${API_BASE}${meta.streamUrl}`, { signal });
  if (!audioRes.ok) {
    const message = await readError(audioRes, "audio fetch failed");
    throw new Error(message);
  }

  const blob = await audioRes.blob();
  const objectUrl = URL.createObjectURL(blob);
  return { objectUrl, blob, mime: meta.mime, id: meta.id };
}
