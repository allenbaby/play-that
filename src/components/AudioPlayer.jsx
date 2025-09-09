'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, SkipBack, SkipForward, Volume2, Heart } from 'lucide-react';

export default function AudioPlayer({
    track,
    isPlaying,
    onTogglePlay,
    onNext,
    onPrev,
    onEnded,
    onDuration // (id:number, seconds:number) -> void
}) {
    const audioRef = useRef(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);          // ← real duration from metadata
    const [volume, setVolume] = useState(0.8);
    const [isFavorite, setIsFavorite] = useState(false);

    // load new track
    useEffect(() => {
        const a = audioRef.current;
        if (!a || !track) return;
        a.src = track.url;
        a.load();
        setCurrentTime(0);
        setDuration(0);
        if (isPlaying) a.play().catch(() => { });
    }, [track]);

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
        // notify page so list can show the real duration for this track
        if (track && d) onDuration?.(track.id, Math.round(d));
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
                onLoadedMetadata={onMeta}     // ← capture real duration here
                onEnded={onEnded}
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
                                            className={`absolute inset-0 w-4 h-4 transition-opacity duration-150 ${isPlaying ? 'opacity-100' : 'opacity-0'
                                                }`}
                                        />
                                        <Play
                                            className={`absolute inset-0 w-4 h-4 transition-opacity duration-150 ${isPlaying ? 'opacity-0' : 'opacity-100'
                                                }`}
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

                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsFavorite((f) => !f)}
                                className="hover:bg-secondary/50 shrink-0"
                            >
                                <span className="relative inline-block w-4 h-4">
                                    <Heart
                                        className={`absolute inset-0 w-4 h-4 transition-opacity duration-150 ${isFavorite ? 'opacity-0' : 'opacity-100 text-muted-foreground'
                                            }`}
                                    />
                                    <Heart
                                        className={`absolute inset-0 w-4 h-4 transition-opacity duration-150 ${isFavorite ? 'opacity-100 fill-accent text-accent' : 'opacity-0'
                                            }`}
                                    />
                                </span>
                            </Button>
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
