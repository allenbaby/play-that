'use client';

import { useEffect, useMemo, useState } from 'react';
import MeditationLibrary from '../components/MeditationLibrary';
import AudioPlayer from '../components/AudioPlayer';

// Set your Drive folder ID here
const FOLDER_ID = '1_Wy5TIxZGPt42t5G3jhF7nMWdvQ3GsUf';

export default function Page() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [tracks, setTracks] = useState([]);
  const [current, setCurrent] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // load list (no durations at all)
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/drive-list?folderId=${encodeURIComponent(FOLDER_ID)}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setItems(data.items || []);
      } catch (e) {
        setErr(e.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // map items -> Track model (NO duration here)
  useEffect(() => {
    const mapped = items.map((it) => ({
      id: it.id,
      title: it.name.replace(/\(\d+min\)/gi, '').replace(/\.(mp3|wav|m4a|ogg|flac|aac)$/i, '').trim(),
      artist: it.path.split('/').slice(-1)[0] || 'Root',
      url: it.playUrl,
      folder: it.path,
      mimeType: it.mimeType,
    }));
    setTracks(mapped);
    if (!current && mapped.length) setCurrent(mapped[0]);
  }, [items]);

  const idx = useMemo(() => (current ? tracks.findIndex((t) => t.id === current.id) : -1), [tracks, current]);

  const selectTrack = (t) => { setCurrent(t); setIsPlaying(true); };
  const togglePlay = () => setIsPlaying((p) => !p);
  const next = () => {
    if (!tracks.length) return;
    const n = idx === -1 ? tracks[0] : tracks[(idx + 1) % tracks.length];
    setCurrent(n); setIsPlaying(true);
  };
  const prev = () => {
    if (!tracks.length) return;
    const p = idx === -1 ? tracks[0] : tracks[(idx - 1 + tracks.length) % tracks.length];
    setCurrent(p); setIsPlaying(true);
  };

  return (
    <main className="max-w-4xl mx-auto p-6 pb-40">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Meditation Library</h1>
        <p className="text-muted-foreground">Click a track to play. The player appears at the bottom.</p>
      </header>

      {loading && <p>Loading…</p>}
      {err && <p className="text-red-600">{err}</p>}
      {!loading && !err && (
        <MeditationLibrary
          tracks={tracks}
          currentTrack={current}
          isPlaying={isPlaying}
          onTrackSelect={selectTrack}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
      )}

      <AudioPlayer
        track={current}
        isPlaying={isPlaying}
        onTogglePlay={togglePlay}
        onNext={next}
        onPrev={prev}
        onEnded={next}
      />
    </main>
  );
}
