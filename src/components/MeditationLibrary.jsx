'use client';
import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Folder, Music, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import TrackCard from './TrackCard';

// Extract the top-level section after "Root/"
function getSection(path = '') {
    const parts = String(path).split('/').filter(Boolean); // ["Root","Kids","Ages 5 and Under"]
    if (parts[0] === 'Root') return parts[1] || 'Other';
    return parts[0] || 'Other';
}

export default function MeditationLibrary({
    tracks,
    currentTrack,
    isPlaying,
    onTrackSelect,
    onPlay,
    onPause
}) {
    const [selectedSection, setSelectedSection] = useState(null); // null = All
    const [searchQuery, setSearchQuery] = useState('');

    // Sections (Kids, Packs, …) + counts
    const sections = useMemo(() => {
        const map = new Map();
        for (const t of tracks) {
            const sec = getSection(t.folder);
            map.set(sec, (map.get(sec) || 0) + 1);
        }
        return Array.from(map.entries())
            .sort((a, b) => a[0].localeCompare(b[0])); // [ [section, count], ... ]
    }, [tracks]);

    // Filtered list by section + search
    const filtered = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return tracks.filter((t) => {
            const inSection = !selectedSection || getSection(t.folder) === selectedSection;
            const inSearch =
                !q ||
                t.title.toLowerCase().includes(q) ||
                (t.artist || '').toLowerCase().includes(q) ||
                t.folder.toLowerCase().includes(q);
            return inSection && inSearch;
        });
    }, [tracks, selectedSection, searchQuery]);

    const handlePlayClick = (track) => {
        if (currentTrack?.id === track.id) onPlay();
        else onTrackSelect(track);
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

            {/* Section chips (Kids, Packs, …) */}
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
                        All Meditations ({tracks.length})
                    </Button>

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
                        onPause={() => onPause()}
                    />
                ))}
            </div>

            {/* Fun stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
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
