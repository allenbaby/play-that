'use client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Play, Pause, Heart } from 'lucide-react';
import { useLikes } from '@/features/likes/LikesProvider';
import { useSession } from "@/app/_providers/SessionProvider";

export default function TrackCard({
  track,
  isPlaying,
  isCurrentTrack,
  onPlay,
  onPause
}) {
  const { user } = useSession();               
  const { likedSet, toggleLike } = useLikes();  
  const liked = likedSet.has(track.id); // Check if the current track is liked by the user
  return (
    <Card
      className={[
        // Card should NOT overflow-hidden if it uses ring
        'w-full p-0 rounded-xl border bg-card transition-smooth',
        isCurrentTrack
          ? 'ring-2 ring-primary ring-offset-2 ring-offset-background shadow-glow'
          : 'hover:border-border/60'
      ].join(' ')}
    >
      
      <div className="p-4 overflow-hidden">
        <div className="flex sm:flex-row sm:items-center gap-3">
          {/* Left: play + text */}
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <Button
              variant={isCurrentTrack && isPlaying ? 'default' : 'secondary'}
              size="sm"
              onClick={isCurrentTrack && isPlaying ? onPause : onPlay}
              className={[
                'w-10 h-10 rounded-full flex-shrink-0',
                isCurrentTrack && isPlaying
                  ? 'gradient-primary shadow-glow'
                  : 'hover:gradient-primary hover:shadow-glow transition-smooth'
              ].join(' ')}
            >
              {isCurrentTrack && isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </Button>

            <div className="min-w-0 max-w-full flex-1">
              <div className="font-semibold text-foreground break-words sm:truncate line-clamp-2 sm:line-clamp-1">
                {track.title}
              </div>
              <p className="text-xs text-muted-foreground/70 break-words sm:truncate">
                {track.folder}
              </p>
            </div>
          </div>

          {!!user && (
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={liked}
              onClick={(e) => { e.stopPropagation(); toggleLike({ trackId: track.id, like: !liked }); }}
              className="hover:bg-secondary/50 shrink-0"
            >
              <span className="relative inline-block w-4 h-4">
                {/* outline heart */}
                <Heart className={`absolute inset-0 w-4 h-4 transition-opacity duration-150 ${liked ? 'opacity-0' : 'opacity-100 text-muted-foreground'}`} />
                {/* filled heart */}
                <Heart className={`absolute inset-0 w-4 h-4 transition-opacity duration-150 ${liked ? 'opacity-100 text-accent' : 'opacity-0'}`} style={{ fill: 'currentColor' }} />
              </span>
            </Button>
          )}
        </div>

        {/* Progress */}
        {isCurrentTrack && (
          <div className="mt-3">
            <div className="h-1 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-gradient-primary animate-pulse rounded-full w-2/3" />
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
