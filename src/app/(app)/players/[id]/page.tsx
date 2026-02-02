'use client';

import { useParams, notFound } from 'next/navigation';
import { AggregatedPlayerStats, calculatePlayerStats } from '@/lib/stats';
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useCollection, useDoc, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import type { Match, Player, Team } from '@/lib/types';

const StatRow = ({ label, value }: { label: string; value: string | number | null | undefined }) => (
    <TableRow>
        <TableCell className="font-medium text-muted-foreground">{label}</TableCell>
        <TableCell className="text-right font-bold">{value ?? '-'}</TableCell>
    </TableRow>
);

const BattingSummary = ({ stats }: { stats: AggregatedPlayerStats }) => (
    <Card>
        <CardHeader>
            <CardTitle>Batting Career Summary</CardTitle>
        </CardHeader>
        <CardContent>
            <Table>
                <TableBody>
                    <StatRow label="Matches" value={stats.matches} />
                    <StatRow label="Innings" value={stats.inningsBatted} />
                    <StatRow label="Not Outs" value={stats.notOuts} />
                    <StatRow label="Runs" value={stats.runsScored} />
                    <StatRow label="Balls" value={stats.ballsFaced} />
                    <StatRow label="Highest" value={stats.highestScore} />
                    <StatRow label="Average" value={stats.battingAverage?.toFixed(2)} />
                    <StatRow label="Strike Rate" value={stats.strikeRate?.toFixed(2)} />
                    <StatRow label="100s" value={stats.hundreds} />
                    <StatRow label="50s" value={stats.fifties} />
                    <StatRow label="4s" value={stats.fours} />
                    <StatRow label="6s" value={stats.sixes} />
                    <StatRow label="Ducks" value={stats.ducks} />
                </TableBody>
            </Table>
        </CardContent>
    </Card>
);

const BowlingSummary = ({ stats }: { stats: AggregatedPlayerStats }) => (
    <Card>
        <CardHeader>
            <CardTitle>Bowling Career Summary</CardTitle>
        </CardHeader>
        <CardContent>
            <Table>
                <TableBody>
                    <StatRow label="Matches" value={stats.matches} />
                    <StatRow label="Innings" value={stats.inningsBowled} />
                    <StatRow label="Overs" value={stats.oversBowled} />
                    <StatRow label="Balls" value={stats.ballsBowled} />
                    <StatRow label="Maidens" value={stats.maidens} />
                    <StatRow label="Runs" value={stats.runsConceded} />
                    <StatRow label="Wickets" value={stats.wicketsTaken} />
                    <StatRow label="BBI" value={`${stats.bestBowlingWickets}/${stats.bestBowlingRuns}`} />
                    <StatRow label="Average" value={stats.bowlingAverage?.toFixed(2)} />
                    <StatRow label="Economy" value={stats.economyRate?.toFixed(2)} />
                    <StatRow label="Strike Rate" value={stats.bowlingStrikeRate?.toFixed(2)} />
                    <StatRow label="4w" value={stats.fourWickets} />
                    <StatRow label="5w" value={stats.fiveWickets} />
                </TableBody>
            </Table>
        </CardContent>
    </Card>
);

export default function PlayerProfilePage() {
    const params = useParams();
    const playerId = params.id as string;
    const { firestore: db } = useFirebase();

    const playerRef = useMemoFirebase(() => db ? doc(db, 'players', playerId) : null, [db, playerId]);
    const { data: player, isLoading: playerLoading } = useDoc<Player>(playerRef);
    
    const teamsCollection = useMemoFirebase(() => (db ? collection(db, 'teams') : null), [db]);
    const { data: teamsData, isLoading: teamsLoading } = useCollection<Team>(teamsCollection);
    const teams = teamsData || [];

    const matchesQuery = useMemoFirebase(() => db ? query(collection(db, 'matches'), where('status', '==', 'completed')) : null, [db]);
    const { data: matchesData, isLoading: matchesLoading } = useCollection<Match>(matchesQuery);
    const matches = matchesData || [];

    const playerStats = useMemo(() => {
        if (!player) return null;
        return calculatePlayerStats([player], teams, matches)[0];
    }, [player, teams, matches]);

    const teamsPlayedFor = useMemo(() => {
        if (!player || !matches || !teams) return [];
        const teamIds = new Set<string>();
        matches.forEach(match => {
            if (match.team1PlayerIds?.includes(playerId)) {
                teamIds.add(match.team1Id);
            } else if (match.team2PlayerIds?.includes(playerId)) {
                teamIds.add(match.team2Id);
            }
        });
        return Array.from(teamIds)
            .map(id => teams.find(t => t.id === id)?.name)
            .filter(Boolean) as string[];
    }, [player, matches, teams, playerId]);

    if (playerLoading || teamsLoading || matchesLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-12 w-1/2" />
                <div className="grid md:grid-cols-2 gap-6">
                    <Card><CardHeader><Skeleton className="h-8 w-3/4" /></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>
                    <Card><CardHeader><Skeleton className="h-8 w-3/4" /></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>
                </div>
            </div>
        )
    }

    if (!player || !playerStats) {
        notFound();
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div>
                <h1 className="text-4xl font-bold tracking-tight font-headline">{player.name}</h1>
            </div>
            
            <Card>
                <CardContent className="p-4 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                        <p className="text-muted-foreground">Role</p>
                        <p className="font-semibold">{player.role}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Batting Style</p>
                        <p className="font-semibold">{player.battingStyle || 'Right-hand bat'}</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground">Bowling Style</p>
                        <p className="font-semibold">{player.bowlingStyle || 'N/A'}</p>
                    </div>
                </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
                <BattingSummary stats={playerStats} />
                <BowlingSummary stats={playerStats} />
            </div>

            {teamsPlayedFor.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-lg font-bold uppercase tracking-tight">Teams</h3>
                    <Card className="bg-muted/30">
                        <CardContent className="p-4">
                            <p className="text-sm md:text-base text-foreground leading-relaxed">
                                {teamsPlayedFor.join(', ')}
                            </p>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
