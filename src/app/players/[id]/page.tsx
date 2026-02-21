'use client';

import { useParams } from 'next/navigation';
import { useDoc, useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { doc, collection } from 'firebase/firestore';
import type { Player, Match, Team } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { calculatePlayerStats } from "@/lib/stats";
import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from "@/components/ui/button";
import Link from 'next/link';
import { Trophy, Target, Award, Calendar, Shield } from 'lucide-react';

export default function PlayerProfilePage() {
    const params = useParams();
    const playerId = params.id as string;
    const { firestore: db } = useFirebase();

    const playerRef = useMemoFirebase(() => db ? doc(db, 'players', playerId) : null, [db, playerId]);
    const { data: player, isLoading: playerLoading } = useDoc<Player>(playerRef);

    const teamsCollection = useMemoFirebase(() => db ? collection(db, 'teams') : null, [db]);
    const { data: teams, isLoading: teamsLoading } = useCollection<Team>(teamsCollection);

    const matchesCollection = useMemoFirebase(() => db ? collection(db, 'matches') : null, [db]);
    const { data: matches, isLoading: matchesLoading } = useCollection<Match>(matchesCollection);

    const playerStats = useMemo(() => {
        if (!player || !teams || !matches) return null;
        const allStats = calculatePlayerStats([player], teams, matches);
        return allStats[0];
    }, [player, teams, matches]);

    const playerTeam = useMemo(() => teams?.find(t => t.id === player?.teamId), [teams, player?.teamId]);

    const recentMatches = useMemo(() => {
        if (!matches || !player) return [];
        return matches
            .filter(m => m.status === 'completed' && (m.team1PlayerIds?.includes(player.id) || m.team2PlayerIds?.includes(player.id)))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 5);
    }, [matches, player]);

    // Calculate all teams the player has played for
    const playedTeams = useMemo(() => {
        if (!matches || !player || !teams) return [];
        const teamIds = new Set<string>();
        
        // Include current team
        if (player.teamId) teamIds.add(player.teamId);

        // Scan match history for other teams
        matches.forEach(m => {
            if (m.team1PlayerIds?.includes(player.id)) teamIds.add(m.team1Id);
            if (m.team2PlayerIds?.includes(player.id)) teamIds.add(m.team2Id);
        });

        return Array.from(teamIds)
            .map(id => teams.find(t => t.id === id)?.name)
            .filter(Boolean) as string[];
    }, [matches, player, teams]);

    const recentForm = useMemo(() => {
        return recentMatches.map(m => {
            const playerTeamId = m.team1PlayerIds?.includes(playerId) ? m.team1Id : m.team2Id;
            const team = teams?.find(t => t.id === playerTeamId);
            if (!team) return 'D';
            if (m.result?.startsWith(team.name)) return 'W';
            if (m.result === 'Match is a Tie.') return 'T';
            return 'L';
        });
    }, [recentMatches, playerId, teams]);

    if (playerLoading || teamsLoading || matchesLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-48 w-full rounded-xl" />
                <div className="grid gap-6 md:grid-cols-3">
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                </div>
            </div>
        );
    }

    if (!player || !playerStats) return <div className="p-8 text-center text-muted-foreground">Player not found.</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto">
            {/* Header / Basic Info */}
            <Card className="overflow-hidden border-none shadow-sm">
                <div className="h-24 bg-gradient-to-r from-primary/10 to-primary/5 relative" />
                <CardContent className="pt-0 pb-6">
                    <div className="flex flex-col md:flex-row md:items-end gap-6 -mt-12 px-2">
                        <Avatar className="h-24 w-24 border-4 border-background bg-background shadow-lg">
                            <AvatarFallback className="text-2xl font-bold">{player.name[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-3xl font-bold font-headline">{player.name}</h1>
                                <Badge variant="secondary">{player.role}</Badge>
                                {player.isWicketKeeper && <Badge variant="outline" className="border-yellow-500 text-yellow-600">Wicket-Keeper</Badge>}
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                                <p className="text-muted-foreground text-sm">
                                    {playerTeam ? (
                                        <Link href={`/teams/${playerTeam.id}`} className="hover:underline font-medium text-primary">
                                            {playerTeam.name}
                                        </Link>
                                    ) : 'Free Agent'}
                                    <span className="mx-2 text-muted-foreground/30">•</span>
                                    <span>{player.battingStyle || 'Right-hand bat'}</span>
                                </p>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Recent:</span>
                                    <div className="flex gap-1">
                                        {recentForm.map((res, i) => (
                                            <span 
                                                key={i} 
                                                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${res === 'W' ? 'bg-green-500 shadow-sm' : res === 'L' ? 'bg-red-500 shadow-sm' : 'bg-gray-400 shadow-sm'}`}
                                                title={res === 'W' ? 'Win' : res === 'L' ? 'Loss' : 'Tie'}
                                            >
                                                {res}
                                            </span>
                                        ))}
                                        {recentForm.length === 0 && <span className="text-xs text-muted-foreground italic">No recent matches</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Quick Stats Grid */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                <Card className="bg-card border-none shadow-sm">
                    <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Matches</CardTitle>
                        <Calendar className="h-3.5 w-3.5 text-primary/60" />
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-black">{playerStats.matches}</div>
                    </CardContent>
                </Card>
                <Card className="bg-card border-none shadow-sm">
                    <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Runs</CardTitle>
                        <Target className="h-3.5 w-3.5 text-primary/60" />
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-black">{playerStats.runsScored}</div>
                    </CardContent>
                </Card>
                <Card className="bg-card border-none shadow-sm">
                    <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Wickets</CardTitle>
                        <Award className="h-3.5 w-3.5 text-primary/60" />
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-black">{playerStats.wicketsTaken}</div>
                    </CardContent>
                </Card>
                <Card className="bg-card border-none shadow-sm">
                    <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Best Score</CardTitle>
                        <Trophy className="h-3.5 w-3.5 text-primary/60" />
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-black">{playerStats.highestScore}{playerStats.notOuts > 0 ? '*' : ''}</div>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="batting" className="space-y-4">
                <TabsList className="bg-muted p-1 w-full md:w-auto">
                    <TabsTrigger value="batting" className="flex-1 md:flex-none font-semibold">Batting</TabsTrigger>
                    <TabsTrigger value="bowling" className="flex-1 md:flex-none font-semibold">Bowling</TabsTrigger>
                    <TabsTrigger value="matches" className="flex-1 md:flex-none font-semibold">Matches</TabsTrigger>
                </TabsList>

                <TabsContent value="batting">
                    <Card className="border-none shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg font-bold">Career Batting</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 sm:grid-cols-3">
                            <StatItem label="Innings" value={playerStats.inningsBatted} />
                            <StatItem label="Not Outs" value={playerStats.notOuts} />
                            <StatItem label="Average" value={playerStats.battingAverage?.toFixed(2) || '0.00'} />
                            <StatItem label="Strike Rate" value={playerStats.strikeRate?.toFixed(2) || '0.00'} />
                            <StatItem label="50s / 100s" value={`${playerStats.fifties} / ${playerStats.hundreds}`} />
                            <StatItem label="4s / 6s" value={`${playerStats.fours} / ${playerStats.sixes}`} />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="bowling">
                    <Card className="border-none shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg font-bold">Career Bowling</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 sm:grid-cols-3">
                            <StatItem label="Innings" value={playerStats.inningsBowled} />
                            <StatItem label="Overs" value={playerStats.oversBowled} />
                            <StatItem label="Runs Conceded" value={playerStats.runsConceded} />
                            <StatItem label="Economy" value={playerStats.economyRate?.toFixed(2) || '0.00'} />
                            <StatItem label="Average" value={playerStats.bowlingAverage?.toFixed(2) || '0.00'} />
                            <StatItem label="Best Figures" value={`${playerStats.bestBowlingWickets}/${playerStats.bestBowlingRuns}`} />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="matches">
                    <Card className="border-none shadow-sm overflow-hidden">
                        <CardHeader>
                            <CardTitle className="text-lg font-bold">Recent Match Logs</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50">
                                            <TableHead className="text-[10px] font-bold uppercase tracking-widest">Date</TableHead>
                                            <TableHead className="text-[10px] font-bold uppercase tracking-widest">Match</TableHead>
                                            <TableHead className="text-[10px] font-bold uppercase tracking-widest">Result</TableHead>
                                            <TableHead className="text-right text-[10px] font-bold uppercase tracking-widest">Scorecard</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {recentMatches.map(match => {
                                            const team1 = teams?.find(t => t.id === match.team1Id);
                                            const team2 = teams?.find(t => t.id === match.team2Id);
                                            return (
                                                <TableRow key={match.id} className="hover:bg-muted/30">
                                                    <TableCell className="text-xs font-medium">{new Date(match.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</TableCell>
                                                    <TableCell className="font-bold text-sm">{team1?.name} vs {team2?.name}</TableCell>
                                                    <TableCell className="text-xs text-muted-foreground truncate max-w-[150px]">{match.result || 'Completed'}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Button asChild variant="link" size="sm" className="h-auto p-0 text-primary font-bold">
                                                            <Link href={`/matches/${match.id}`}>VIEW</Link>
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                        {recentMatches.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground italic">No historical matches found for this player.</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Teams History Card */}
            <Card className="border-none shadow-sm bg-card overflow-hidden">
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                        <CardTitle className="text-lg font-black tracking-tight">Teams</CardTitle>
                        <div className="flex-1 border-b border-dotted border-muted-foreground/30 mt-1" />
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                        {playedTeams.length > 0 ? playedTeams.join(', ') : 'No official team history recorded yet.'}
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}

function StatItem({ label, value }: { label: string, value: string | number }) {
    return (
        <div className="p-4 border rounded-xl bg-muted/20">
            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1.5">{label}</p>
            <p className="text-xl font-black text-foreground">{value}</p>
        </div>
    );
}
