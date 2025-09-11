'use client';
import { useMemo, useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Folder, Music, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import TrackCard from './TrackCard';
import { useLikes } from '@/features/likes/LikesProvider';
import { useSession } from "@/app/_providers/SessionProvider";

function getSection(path = '') {
  const parts = String(path).split('/').filter(Boolean);
  if (parts[0] === 'Root') return parts[1] || 'Other';
  return parts[0] || 'Other';
}

export default function MeditationLibrary({
  tracks,
  currentTrack,
  isPlaying,
  onTrackSelect,
  onPlay,
  onPause,
  onVisibleIdsChange,       // (ids: string[])
  onViewKeyChange,          // (key: string) -> "all" | "liked" | `section:${name}`
}) {
  const { user } = useSession();
  const [searchQuery, setSearchQuery] = useState('');
  const { likedSet } = useLikes();
  const likedCount = likedSet.size;

  // null = All, 'liked' = liked tab, or a real section name
  const [selectedSection, setSelectedSection] = useState(null);

  // View key the parent can use to label/switch queue source
  const viewKey = useMemo(() => {
    if (selectedSection === null) return 'all';
    if (selectedSection === 'liked') return 'liked';
    return `section:${selectedSection}`;
  }, [selectedSection]);

  useEffect(() => {
    onViewKeyChange?.(viewKey);
  }, [viewKey]); // depend only on viewKey to avoid loops

  const sections = useMemo(() => {
    const map = new Map();
    for (const t of tracks) {
      const sec = getSection(t.folder);
      map.set(sec, (map.get(sec) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [tracks]);

  // Helpers for sorting
  function extractNumber(s = "") {
    const m = String(s).match(/\d+/);
    return m ? Number(m[0]) : null;
  }

  function buildSortKey(title = "") {
    const parts = title.split("-").map((s) => s.trim());

    if (parts.length >= 2) {
      // e.g. "Headspace - Basics 3 - Day 1"
      const second = parts[1] || "";
      const third = parts[2] || "";
      const n = extractNumber(third); // 1 from "Day 1"
      return {
        group: second.toLowerCase(),
        orderNum: n ?? Number.POSITIVE_INFINITY,
        orderText: third.toLowerCase(),
        fallback: title.toLowerCase(),
      };
    }

    // No hyphens: e.g. "Alone Time 5min"
    const m = title.match(/^(.*?)(?:\s+(\d+)\s*min)?$/i);
    const base = (m?.[1] || title).trim();
    const minutes = m?.[2] ? Number(m[2]) : Number.POSITIVE_INFINITY;

    return {
      group: base.toLowerCase(),
      orderNum: minutes,
      orderText: "",
      fallback: title.toLowerCase(),
    };
  }

  // Visible list (All / Liked / Section + Search), sorted consistently
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return tracks
      .filter((t) => {
        const inSection =
          !selectedSection ||
          (selectedSection === "liked"
            ? likedSet.has(t.id)
            : getSection(t.folder) === selectedSection);

        const inSearch =
          !q ||
          t.title.toLowerCase().includes(q) ||
          (t.artist || "").toLowerCase().includes(q) ||
          t.folder.toLowerCase().includes(q);

        return inSection && inSearch;
      })
      .sort((a, b) => {
        const A = buildSortKey(a.title);
        const B = buildSortKey(b.title);

        // 1) group compare (program/pack OR base title)
        const g = A.group.localeCompare(B.group, undefined, {
          sensitivity: "base",
          numeric: true,
        });
        if (g !== 0) return g;

        // 2) numeric order if present (Day number / minutes)
        if (A.orderNum !== B.orderNum) return A.orderNum - B.orderNum;

        // 3) text fallback (e.g. "Day one" vs "Day two")
        const tcmp = A.orderText.localeCompare(B.orderText, undefined, {
          sensitivity: "base",
          numeric: true,
        });
        if (tcmp !== 0) return tcmp;

        // 4) final fallback: full title
        return A.fallback.localeCompare(B.fallback, undefined, {
          sensitivity: "base",
          numeric: true,
        });
      });
  }, [tracks, selectedSection, searchQuery, likedSet]);

  // Tell parent the *ordered* visible IDs whenever it changes
  useEffect(() => {
    onVisibleIdsChange?.(filtered.map((t) => t.id));
  }, [filtered]);

  const handlePlayClick = (track) => {
    if (currentTrack?.id === track.id) onPlay?.();
    else onTrackSelect?.(track);
  };

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search meditations, artists, or collections…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-secondary/50 border-border/30 focus:bg-secondary/70 transition-smooth"
        />
      </div>

      {/* Section chips */}
      <div className="mb-2">
        <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
          <Folder className="w-5 h-5 text-primary" />
          Sections
        </h2>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={selectedSection === null ? 'default' : 'secondary'}
            onClick={() => setSelectedSection(null)}
            className={`${selectedSection === null ? 'gradient-primary shadow-glow' : 'hover:bg-secondary/70'} transition-smooth`}
          >
            All ({tracks.length})
          </Button>

          {!!user && (
            <Button
              variant={selectedSection === 'liked' ? 'default' : 'secondary'}
              onClick={() => setSelectedSection('liked')}
              className={`${selectedSection === 'liked' ? 'gradient-primary shadow-glow' : 'hover:bg-secondary/70'} transition-smooth`}
            >
              Liked ({likedCount})
            </Button>
          )}

          {sections.map(([sec, count]) => (
            <Button
              key={sec}
              variant={selectedSection === sec ? 'default' : 'secondary'}
              onClick={() => setSelectedSection(sec)}
              className={`${selectedSection === sec ? 'gradient-primary shadow-glow' : 'hover:bg-secondary/70'} transition-smooth`}
            >
              {sec} ({count})
            </Button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="grid gap-3 pt-2">
        {filtered.map((t) => (
          <TrackCard
            key={t.id}
            track={t}
            isCurrentTrack={currentTrack?.id === t.id}
            isPlaying={isPlaying}
            onPlay={() => handlePlayClick(t)}
            onPause={() => onPause?.()}
          />
        ))}
      </div>

      {/* Fun stats */}
      <div className="grid grid-cols-2 md-grid-cols-4 gap-4 mt-4">
        <Card className="p-4 gradient-card text-center">
          <div className="text-2xl font-bold text-primary-glow text-glow">{filtered.length}</div>
          <div className="text-sm text-muted-foreground">Tracks</div>
        </Card>
        <Card className="p-4 gradient-card text-center">
          <div className="text-2xl font-bold text-primary-glow text-glow">{sections.length}</div>
          <div className="text-sm text-muted-foreground">Sections</div>
        </Card>
        <Card className="p-4 gradient-card text-center">
          <div className="text-2xl font-bold text-primary-glow text-glow">
            <Music className="inline w-6 h-6" />
          </div>
          <div className="text-sm text-muted-foreground">Good Vibes</div>
        </Card>
        <Card className="p-4 gradient-card text-center">
          <div className="text-2xl font-bold text-primary-glow text-glow">∞</div>
          <div className="text-sm text-muted-foreground">Calm Energy</div>
        </Card>
      </div>
    </div>
  );
}
