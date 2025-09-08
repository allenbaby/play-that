'use client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Play, Pause, MoreVertical } from 'lucide-react';

export default function TrackCard({
  track,
  isPlaying,
  isCurrentTrack,
  onPlay,
  onPause
}) {
  const fmt = (s) => {
    if (!s) return '';
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return `${m}:${r.toString().padStart(2, '0')}`;
  };

  return (
    <Card className={`p-4 transition-smooth hover:shadow-soft group cursor-pointer ${
      isCurrentTrack ? 'ring-2 ring-primary shadow-glow bg-gradient-card' : 'gradient-card hover:bg-card'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Button
            variant={isCurrentTrack && isPlaying ? 'default' : 'secondary'}
            size="sm"
            onClick={isPlaying && isCurrentTrack ? onPause : onPlay}
            className={`w-10 h-10 rounded-full flex-shrink-0 ${
              isCurrentTrack && isPlaying
                ? 'gradient-primary shadow-glow'
                : 'hover:gradient-primary hover:shadow-glow transition-smooth'
            }`}
          >
            {isCurrentTrack && isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </Button>

          <div className="min-w-0">
            <div className="font-semibold text-foreground truncate">{track.title}</div>
            <p className="text-xs text-muted-foreground/70">
              {track.folder} • {fmt(track.duration)}
            </p>
          </div>
        </div>

        <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-smooth hover:bg-secondary/50">
          <MoreVertical className="w-4 h-4" />
        </Button>
      </div>

      {isCurrentTrack && (
        <div className="mt-3">
          <div className="h-1 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-gradient-primary animate-pulse rounded-full w-2/3"></div>
          </div>
        </div>
      )}
    </Card>
  );
}
