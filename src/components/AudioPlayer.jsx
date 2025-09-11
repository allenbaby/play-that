'use client';
import { useEffect, useRef, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, SkipBack, SkipForward, Volume2, Heart } from 'lucide-react';
import { useLikes } from '@/features/likes/LikesProvider';
import { useSession } from "@/app/_providers/SessionProvider";
import { mutate } from 'swr';

function yyyymmddInZone(tz) {
    // "YYYY-MM-DD" in the provided IANA timezone
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: tz || Intl.DateTimeFormat().resolvedOptions().timeZone,
        year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
}
function streakKey(userId, tz) {
    return `streak:${userId}:${yyyymmddInZone(tz)}`;
}

export default function AudioPlayer({
    track,
    isPlaying,
    onTogglePlay,
    onNext,
    onPrev,
    onEnded,          // parent "next" logic still honored; we call it after check-in
    // userTimeZone,   // (optional) if you later want to pass profile IANA tz, uncomment prop and usage
}) {
    const audioRef = useRef(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(0.8);
    const inFlightRef = useRef(false); // prevents double POSTs within a session

    const { user } = useSession();
    const { likedSet, toggleLike } = useLikes();
    const liked = likedSet.has(track?.id);

    // Determine the IANA timezone for localStorage keying (server remains authoritative).
    const deviceTz = useMemo(
        () => (typeof window !== 'undefined'
            ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
            : 'UTC'),
        []
    );
    const userTzForKey = deviceTz; // or prefer a passed-in userTimeZone if you add that prop

    // load new track
    useEffect(() => {
        const a = audioRef.current;
        if (!a || !track) return;
        a.src = track.url;
        a.load();
        setCurrentTime(0);
        setDuration(0);
        if (isPlaying) a.play().catch(() => { });
    }, [track]); // eslint-disable-line react-hooks/exhaustive-deps

    // play/pause from parent
    useEffect(() => {
        const a = audioRef.current;
        if (!a) return;
        if (isPlaying) a.play().catch(() => { });
        else a.pause();
    }, [isPlaying]);

    // volume
    useEffect(() => {
        if (audioRef.current) audioRef.current.volume = volume;
    }, [volume]);

    const onTime = () => {
        const a = audioRef.current;
        if (!a) return;
        setCurrentTime(a.currentTime || 0);
    };

    const onMeta = () => {
        const a = audioRef.current;
        if (!a) return;
        const d = isFinite(a.duration) ? a.duration : 0;
        setDuration(d);
    };

    const seek = (vals) => {
        const a = audioRef.current;
        if (!a || !duration) return;
        const pct = (vals?.[0] ?? 0) / 100;
        const t = pct * duration;
        a.currentTime = t;
        setCurrentTime(t);
    };

    const fmt = (s) => {
        if (!isFinite(s) || s <= 0) return '0:00';
        const m = Math.floor(s / 60);
        const r = Math.floor(s % 60);
        return `${m}:${r.toString().padStart(2, '0')}`;
    };

    // ⬇️ On natural end: do streak check-in once per (user, local-day), then call parent's onEnded
    const handleEnded = async () => {
        try {
            if (user?.id) {
                const key = streakKey(user.id, userTzForKey);

                // already checked-in today? skip network
                if (!localStorage.getItem(key) && !inFlightRef.current) {
                    inFlightRef.current = true;

                    const res = await fetch('/api/streak', { method: 'POST' });
                    if (res.ok) {
                        const json = await res.json(); // { ok: true, streak: { current_streak, longest_streak, last_checkin } }
                        const s = json?.streak || {};

                        // mark done for today so refreshes don't refire
                        localStorage.setItem(key, '1');

                        // update the SWR cache used by <StreakBadge/> without refetch
                        mutate(
                            '/api/streak',
                            (prev) => ({
                                current: s.current_streak ?? prev?.current ?? 0,
                                longest: s.longest_streak ?? prev?.longest ?? 0,
                                lastCheckin: s.last_checkin ?? prev?.lastCheckin ?? null,
                            }),
                            false
                        );
                    }
                }
            }
        } catch {
            // ignore; idempotent + non-blocking
        } finally {
            inFlightRef.current = false;
            // Always proceed with parent-provided end handler (e.g., queue next track)
            onEnded?.();
        }
    };


    if (!track) {
        return (
            <div className="fixed bottom-0 left-0 right-0 bg-gradient-player border-t border-border/30 p-4 backdrop-blur-xl">
                <div className="max-w-4xl mx-auto text-center text-muted-foreground">
                    Select a meditation to begin your journey
                </div>
            </div>
        );
    }

    const progressPct = duration ? (currentTime / duration) * 100 : 0;

    return (
        <>
            <audio
                ref={audioRef}
                onTimeUpdate={onTime}
                onLoadedMetadata={onMeta}
                onEnded={handleEnded}            // 👈 streak check-in + then parent's onEnded
                preload="metadata"
            />

            <div className="fixed bottom-0 left-0 right-0 bg-gradient-player border-t border-border/30 p-4 backdrop-blur-xl">
                <div className="max-w-4xl mx-auto">
                    <div className="flex items-center justify-between gap-4">
                        {/* meta */}
                        <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-lg text-foreground truncate">{track.title}</h3>
                            {track.artist && <p className="text-muted-foreground text-sm truncate">{track.artist}</p>}
                            <p className="text-xs text-muted-foreground/70">{track.folder}</p>
                        </div>

                        {/* controls */}
                        <div className="flex items-center gap-4">
                            <div className="hidden sm:flex items-center gap-2">
                                <Volume2 className="w-4 h-4 text-muted-foreground" />
                                <Slider
                                    value={[volume * 100]}
                                    onValueChange={(v) => setVolume(v[0] / 100)}
                                    max={100}
                                    className="w-20"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={onPrev}
                                    className="hover:bg-secondary/50 shrink-0"
                                >
                                    <SkipBack className="w-4 h-4" />
                                </Button>

                                <Button
                                    aria-pressed={isPlaying}
                                    variant="default"
                                    size="sm"
                                    onClick={onTogglePlay}
                                    className="gradient-primary shadow-glow rounded-full w-10 h-10 p-0 grid place-items-center leading-none shrink-0"
                                >
                                    {/* fixed 16×16 stage with stacked icons */}
                                    <span className="relative inline-block w-4 h-4">
                                        <Pause
                                            className={`absolute inset-0 w-4 h-4 transition-opacity duration-150 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}
                                        />
                                        <Play
                                            className={`absolute inset-0 w-4 h-4 transition-opacity duration-150 ${isPlaying ? 'opacity-0' : 'opacity-100'}`}
                                        />
                                    </span>
                                </Button>

                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={onNext}
                                    className="hover:bg-secondary/50 shrink-0"
                                >
                                    <SkipForward className="w-4 h-4" />
                                </Button>
                            </div>

                            {!!user && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => { e.stopPropagation(); toggleLike({ trackId: track.id, like: !liked }); }}
                                    className="hover:bg-secondary/50 shrink-0"
                                >
                                    <span className="relative inline-block w-4 h-4">
                                        <Heart
                                            className={`absolute inset-0 w-4 h-4 transition-opacity duration-150 ${liked ? 'opacity-0' : 'opacity-100 text-muted-foreground'}`}
                                        />
                                        <Heart
                                            className={`absolute inset-0 w-4 h-4 transition-opacity duration-150 ${liked ? 'opacity-100 fill-accent text-accent' : 'opacity-0'}`}
                                        />
                                    </span>
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* progress */}
                    <div className="mt-3 flex items-center gap-3">
                        <span className="text-xs tabular-nums text-muted-foreground">{fmt(currentTime)}</span>
                        <Slider value={[progressPct]} max={100} step={1} onValueChange={seek} className="flex-1" />
                        <span className="text-xs tabular-nums text-muted-foreground">{fmt(duration)}</span>
                    </div>
                </div>
            </div>
        </>
    );
}
