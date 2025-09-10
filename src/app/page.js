'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import MeditationLibrary from '../components/MeditationLibrary';
import AudioPlayer from '../components/AudioPlayer';
import HeaderAuth from '@/components/HeaderAuth';
import LikesProvider, { useLikes } from '@/features/likes/LikesProvider';
import Image from "next/image";

const FOLDER_ID = '1_Wy5TIxZGPt42t5G3jhF7nMWdvQ3GsUf';

/** Inner client page that consumes the Likes context */
function BrowsePageClient() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const [tracks, setTracks] = useState([]);
  const [current, setCurrent] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // ---- Likes context (one favorites fetch for entire page) ----
  const { likedSet, toggleLike } = useLikes();

  // DEV double-mount guard (React StrictMode)
  const fetchedRef = useRef(false);

  // load list (no durations at all) - one call, guarded in dev
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

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
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  const idx = useMemo(
    () => (current ? tracks.findIndex((t) => t.id === current.id) : -1),
    [tracks, current]
  );

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

  // Optional: public like counts for all tracks on the page (batch once)
  // const ids = useMemo(() => tracks.map(t => t.id), [tracks]);
  // const { data: counts } = useLikeCounts(ids); // Map<trackId, count>

  return (
    <main className="max-w-4xl mx-auto p-6 pb-40">
      <header className="mb-4 flex items-center justify-between">
        <Image
          src="/banner.png"
          alt="Play That! Logo"
          width={320}
          height={80}
          priority
        />
        <HeaderAuth />
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

          // NEW: likes – pass the liked set + toggler
          likedSet={likedSet}                           // Set<string>
          onToggleLike={(trackId, next) => toggleLike({ trackId, like: next })}

        // If you want to show counts inside the library:
        // getLikeCount={(trackId) => counts?.get(trackId) ?? 0}
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

/** Page: attach LikesProvider once, then render the inner page */
export default function Page() {
  return (
    <LikesProvider>
      <BrowsePageClient />
    </LikesProvider>
  );
}
