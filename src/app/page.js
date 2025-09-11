'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import MeditationLibrary from '../components/MeditationLibrary';
import AudioPlayer from '../components/AudioPlayer';
import HeaderAuth from '@/components/HeaderAuth';
import LikesProvider, { useLikes } from '@/features/likes/LikesProvider';
import Image from 'next/image';
import StreakBadge from '@/components/StreakBadge';
import { useSession } from '@/app/_providers/SessionProvider';

const FOLDER_ID = '1_Wy5TIxZGPt42t5G3jhF7nMWdvQ3GsUf';
const AUDIO_EXT_RE = /\.(mp3|wav|m4a|ogg|flac|aac)$/i;

function idsEqual(a, b) {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function BrowsePageClient() {
  // raw drive items
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  // visible state from Library (changes with tabs/search)
  const [visibleIds, setVisibleIds] = useState([]); // ordered, current view
  const [viewKey, setViewKey] = useState('all');    // "all" | "liked" | "section:<name>"

  // captured playback queue (snapshot taken when user presses Play)
  const [queueIds, setQueueIds] = useState([]);     // ordered IDs for the active queue
  const [queueKey, setQueueKey] = useState(null);   // label where queue came from

  // player state
  const [currentId, setCurrentId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const { user } = useSession();
  const fetchedRef = useRef(false);
  const bootstrappedRef = useRef(false);

  // 1) Load items once
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/drive-list?folderId=${encodeURIComponent(FOLDER_ID)}`,
          { cache: 'no-store' }
        );
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

  // 2) Base catalog (normalize only)
  const catalog = useMemo(() => {
    const filtered = items.filter((it) => {
      const isAudio =
        it?.mimeType?.startsWith('audio/') || AUDIO_EXT_RE.test(it?.name || '');
      const hasUrl = Boolean(it?.playUrl);
      return isAudio && hasUrl;
    });

    return filtered.map((it) => {
      const segs = (it.path || '').split('/').filter(Boolean);
      const parentFolder = segs.length >= 2 ? segs[segs.length - 2] : 'Root';
      return {
        id: String(it.id),
        title: (it.name || '')
          .replace(/\(\s*\d+\s*min\s*\)/gi, '')
          .replace(AUDIO_EXT_RE, '')
          .trim(),
        artist: parentFolder,
        url: it.playUrl,
        folder: it.path,
        mimeType: it.mimeType,
      };
    });
  }, [items]);

  // 3) id -> track lookup, for faster lookups
  const byId = useMemo(() => {
    const m = new Map();
    catalog.forEach((t) => m.set(t.id, t));
    return m;
  }, [catalog]);

  // 4) Current track comes from the catalog so it keeps playing across tab changes
  const currentTrack = currentId ? byId.get(currentId) : null;

  // 5) Build the actual queue list from the *captured* queueIds
  const queueList = useMemo(
    () => queueIds.map((id) => byId.get(String(id))).filter(Boolean),
    [queueIds, byId]
  );

  const queueIndex = useMemo(() => {
    if (!currentId) return -1;
    return queueIds.indexOf(currentId);
  }, [queueIds, currentId]);

  // 6) Select a track from the Library:
  //    - capture the *current* visible list as the new queue
  //    - set the queue's source
  //    - set current & start playing
  const selectTrack = useCallback(
    (t) => {
      const id = String(t?.id);
      if (!byId.has(id)) return;

      // capture queue snapshot FROM the page the user clicked on
      const vis = Array.from(new Set(visibleIds.map(String)));
      const includes = vis.includes(id);
      const newQueue = includes ? vis : [id, ...vis.filter((x) => x !== id)];

      setQueueIds((prev) => (idsEqual(prev, newQueue) ? prev : newQueue));
      setQueueKey(viewKey);

      if (currentId !== id) setCurrentId(id);
      setIsPlaying(true);
    },
    [byId, visibleIds, viewKey, currentId]
  );

  // 7) Prev/Next walk the *captured* queue, regardless of tab changes
  const next = useCallback(() => {
    if (!queueIds.length || !currentId) return;
    const i = queueIndex >= 0 ? queueIndex : 0;
    const nextIndex = (i + 1) % queueIds.length;
    setCurrentId(queueIds[nextIndex]);
    setIsPlaying(true);
  }, [queueIds, currentId, queueIndex]);

  const prev = useCallback(() => {
    if (!queueIds.length || !currentId) return;
    const i = queueIndex >= 0 ? queueIndex : 0;
    const prevIndex = (i - 1 + queueIds.length) % queueIds.length;
    setCurrentId(queueIds[prevIndex]);
    setIsPlaying(true);
  }, [queueIds, currentId, queueIndex]);

  // 8) Stable callbacks from Library to parent
  const handleVisibleIdsChange = useCallback((ids) => {
    const clean = Array.from(new Set((ids || []).map((id) => String(id))));
    setVisibleIds((prev) => (idsEqual(prev, clean) ? prev : clean));
  }, []);

  const handleViewKeyChange = useCallback((key) => {
    setViewKey((prev) => (prev === key ? prev : key));
  }, []);

  // 9) 🔰 One-time default: when All tab first reports its list, pick #1 and capture queue
  useEffect(() => {
    if (bootstrappedRef.current) return;
    if (viewKey !== 'all') return;                 // only bootstrap from All
    if (currentId) return;                         // user already selected something
    if (!visibleIds.length) return;                // nothing to seed yet

    setQueueIds(visibleIds);
    setQueueKey('all');
    setCurrentId(visibleIds[0]);                   // show player with first track
    setIsPlaying(false);                           // don't auto-play
    bootstrappedRef.current = true;
  }, [visibleIds, viewKey, currentId]);

  return (
    <main className="max-w-4xl mx-auto p-6 pb-40">
      <header className="mb-4 flex items-center gap-2 sm:gap-3">
        {/* Left: banner that can shrink */}
        <div className="min-w-0 flex-1">
          <Image
            src="/banner.png"
            alt="Play That! Logo"
            width={320}
            height={80}
            sizes="(max-width: 480px) 150px, (max-width: 640px) 200px, 320px"
            className="block h-auto w-[150px] xs:w-[180px] sm:w-[200px] md:w-[320px] max-w-full"
            priority
          />
        </div>

        {/* Right: compact auth cluster that never overflows */}
        <div className="flex-shrink-0">
          <HeaderAuth />
        </div>
      </header>


      {loading && <p>Loading…</p>}
      {err && <p className="text-red-600">{err}</p>}

      {!loading && !err && (
        <>
          {!!user && <StreakBadge />}

          <MeditationLibrary
            tracks={catalog}
            currentTrack={currentTrack}
            isPlaying={!!currentTrack && isPlaying}
            onTrackSelect={selectTrack}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onVisibleIdsChange={handleVisibleIdsChange}
            onViewKeyChange={handleViewKeyChange}
          />

          {/* Optional: show queue source for debugging */}
          {/* <div className="mt-2 text-xs text-muted-foreground">
            Queue source: {queueKey ?? '—'} ({queueIds.length} items)
          </div> */}
        </>
      )}

      <AudioPlayer
        track={currentTrack}
        isPlaying={!!currentTrack && isPlaying}
        onTogglePlay={() => setIsPlaying((p) => !p)}
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
