'use client';

import { useParams } from 'next/navigation';
import { useDoc, useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import type { Player, Match, Team, DeliveryRecord } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { calculatePlayerStats } from "@/lib/stats";
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from "@/components/ui/button";
import Link from 'next/link';
import { Trophy, Target, Award, Calendar, User, ChevronRight } from 'lucide-react';

export default function PlayerProfilePage() {
    const params = useParams();
    const playerId = params.id as string;
    const { firestore: db } = useFirebase();
    const [activeTab, setActiveTab] = useState('overview');

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

    const formLogs = useMemo(() => {
        if (!matches || !playerId || !teams) return { batting: [], bowling: [] };

        const relevantMatches = matches
            .filter(m => m.status === 'completed')
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const battingForm: any[] = [];
        const bowlingForm: any[] = [];

        relevantMatches.forEach(match => {
            const opponentId = match.team1Id === player?.teamId ? match.team2Id : match.team1Id;
            const opponent = teams.find(t => t.id === opponentId);
            const oppName = opponent?.name.slice(0, 3).toUpperCase() || 'UNK';
            const format = match.overs <= 10 ? 'T10' : match.overs <= 20 ? 'T20' : 'ODI';
            const date = new Date(match.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });

            match.innings.forEach(inning => {
                if (inning.battingTeamId === player?.teamId || inning.deliveryHistory.some(d => d.strikerId === playerId)) {
                    let runs = 0, balls = 0, isOut = false;
                    let playerBatted = false;

                    inning.deliveryHistory.forEach(d => {
                        if (d.strikerId === playerId) {
                            playerBatted = true;
                            if (d.extra !== 'byes' && d.extra !== 'legbyes') runs += d.runs;
                            if (d.extra !== 'wide') balls++;
                        }
                        if (d.isWicket && d.dismissal?.batsmanOutId === playerId) {
                            isOut = true;
                            playerBatted = true;
                        }
                    });

                    if (playerBatted) {
                        battingForm.push({
                            score: `${runs}${!isOut ? '*' : ''}(${balls})`,
                            oppn: oppName,
                            format,
                            date,
                            matchId: match.id
                        });
                    }
                }

                if (inning.bowlingTeamId === player?.teamId || inning.deliveryHistory.some(d => d.bowlerId === playerId)) {
                    let wicks = 0, rConceded = 0;
                    let playerBowled = false;

                    inning.deliveryHistory.forEach(d => {
                        if (d.bowlerId === playerId) {
                            playerBowled = true;
                            let conceded = d.runs;
                            if (d.extra === 'wide' || d.extra === 'noball') conceded += 1;
                            rConceded += conceded;
                            if (d.isWicket && d.dismissal?.type !== 'Run out') wicks++;
                        }
                    });

                    if (playerBowled) {
                        bowlingForm.push({
                            wickets: `${wicks}-${rConceded}`,
                            oppn: oppName,
                            format,
                            date,
                            matchId: match.id
                        });
                    }
                }
            });
        });

        return { 
            batting: battingForm.slice(0, 5), 
            bowling: bowlingForm.slice(0, 5) 
        };
    }, [matches, playerId, teams, player?.teamId]);

    const recentMatches = useMemo(() => {
        if (!matches || !player) return [];
        return matches
            .filter(m => {
                if (m.status !== 'completed') return false;
                if (m.team1PlayerIds?.includes(player.id) || m.team2PlayerIds?.includes(player.id)) return true;
                return m.innings.some(i => i.deliveryHistory.some(d => d.strikerId === player.id || d.nonStrikerId === player.id || d.bowlerId === player.id));
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 10);
    }, [matches, player]);

    const recentFormDots = useMemo(() => {
        return recentMatches.slice(0, 5).map(m => {
            const team = teams?.find(t => t.id === (m.team1PlayerIds?.includes(playerId) ? m.team1Id : m.team2Id));
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
        <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto pb-20">
            {/* Header / Basic Info */}
            <Card className="overflow-hidden border-none shadow-sm bg-card">
                <div className="h-24 bg-gradient-to-r from-primary/10 to-primary/5 relative" />
                <CardContent className="pt-0 pb-6">
                    <div className="flex flex-col md:flex-row md:items-end gap-6 -mt-12 px-2">
                        <Avatar className="h-24 w-24 border-4 border-background bg-background shadow-lg">
                            <AvatarImage src={player.imageUrl} className="object-cover" />
                            <AvatarFallback className="text-2xl font-bold bg-muted">
                                <User className="h-10 w-10 text-muted-foreground" />
                            </AvatarFallback>
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
                                        {recentFormDots.map((res, i) => (
                                            <span 
                                                key={i} 
                                                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${res === 'W' ? 'bg-green-500 shadow-sm' : res === 'L' ? 'bg-red-500 shadow-sm' : 'bg-gray-400 shadow-sm'}`}
                                                title={res === 'W' ? 'Win' : res === 'L' ? 'Loss' : 'Tie'}
                                            >
                                                {res}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                <TabsList className="bg-muted/50 p-1 w-full md:w-auto">
                    <TabsTrigger value="overview" className="flex-1 md:flex-none font-semibold">Overview</TabsTrigger>
                    <TabsTrigger value="stats" className="flex-1 md:flex-none font-semibold">Career Stats</TabsTrigger>
                    <TabsTrigger value="matches" className="flex-1 md:flex-none font-semibold">Match Logs</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Batting Form */}
                        <Card className="shadow-sm border-muted/60 overflow-hidden">
                            <CardHeader className="py-4 px-5 border-b bg-muted/5">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-lg font-bold">Batting Form</CardTitle>
                                    <div className="flex-1 border-b border-dotted mx-4 opacity-30" />
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableHead className="px-5 h-10 text-xs font-bold uppercase text-muted-foreground">Score</TableHead>
                                            <TableHead className="h-10 text-xs font-bold uppercase text-muted-foreground text-center">Oppn.</TableHead>
                                            <TableHead className="h-10 text-xs font-bold uppercase text-muted-foreground text-center">Format</TableHead>
                                            <TableHead className="px-5 h-10 text-xs font-bold uppercase text-muted-foreground text-right">Date</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {formLogs.batting.map((log, i) => (
                                            <TableRow key={i} className="hover:bg-muted/30 border-muted/40">
                                                <TableCell className="px-5 py-3 font-bold text-sm">{log.score}</TableCell>
                                                <TableCell className="py-3 text-sm text-center text-muted-foreground">{log.oppn}</TableCell>
                                                <TableCell className="py-3 text-sm text-center text-muted-foreground">{log.format}</TableCell>
                                                <TableCell className="px-5 py-3 text-sm text-right text-muted-foreground font-medium">{log.date}</TableCell>
                                            </TableRow>
                                        ))}
                                        {formLogs.batting.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic text-xs">No batting data available</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                                <Button 
                                    variant="ghost" 
                                    className="w-full h-12 rounded-none text-sm font-bold border-t hover:bg-muted/50 group"
                                    onClick={() => setActiveTab('matches')}
                                >
                                    View all Matches <ChevronRight className="ml-1 h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                                </Button>
                            </CardContent>
                        </Card>

                        {/* Bowling Form */}
                        <Card className="shadow-sm border-muted/60 overflow-hidden">
                            <CardHeader className="py-4 px-5 border-b bg-muted/5">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-lg font-bold">Bowling Form</CardTitle>
                                    <div className="flex-1 border-b border-dotted mx-4 opacity-30" />
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent border-none">
                                            <TableHead className="px-5 h-10 text-xs font-bold uppercase text-muted-foreground">Wickets</TableHead>
                                            <TableHead className="h-10 text-xs font-bold uppercase text-muted-foreground text-center">Oppn.</TableHead>
                                            <TableHead className="h-10 text-xs font-bold uppercase text-muted-foreground text-center">Format</TableHead>
                                            <TableHead className="px-5 h-10 text-xs font-bold uppercase text-muted-foreground text-right">Date</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {formLogs.bowling.map((log, i) => (
                                            <TableRow key={i} className="hover:bg-muted/30 border-muted/40">
                                                <TableCell className="px-5 py-3 font-bold text-sm">{log.wickets}</TableCell>
                                                <TableCell className="py-3 text-sm text-center text-muted-foreground">{log.oppn}</TableCell>
                                                <TableCell className="py-3 text-sm text-center text-muted-foreground">{log.format}</TableCell>
                                                <TableCell className="px-5 py-3 text-sm text-right text-muted-foreground font-medium">{log.date}</TableCell>
                                            </TableRow>
                                        ))}
                                        {formLogs.bowling.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={4} className="h-32 text-center text-muted-foreground italic text-xs">No bowling data available</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                                <Button 
                                    variant="ghost" 
                                    className="w-full h-12 rounded-none text-sm font-bold border-t hover:bg-muted/50 group"
                                    onClick={() => setActiveTab('matches')}
                                >
                                    View all Matches <ChevronRight className="ml-1 h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                                </Button>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Quick Overview Stats */}
                    <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                        <StatSummaryCard label="Matches" value={playerStats.matches} icon={<Calendar className="h-3.5 w-3.5" />} />
                        <StatSummaryCard label="Total Runs" value={playerStats.runsScored} icon={<Target className="h-3.5 w-3.5" />} />
                        <StatSummaryCard label="Wickets" value={playerStats.wicketsTaken} icon={<Award className="h-3.5 w-3.5" />} />
                        <StatSummaryCard label="Best Score" value={`${playerStats.highestScore}${playerStats.notOuts > 0 ? '*' : ''}`} icon={<Trophy className="h-3.5 w-3.5" />} />
                    </div>
                </TabsContent>

                <TabsContent value="stats" className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2">
                        <Card className="border-muted/60 shadow-sm">
                            <CardHeader><CardTitle className="text-lg font-bold">Career Batting Summary</CardTitle></CardHeader>
                            <CardContent className="grid gap-4 sm:grid-cols-2">
                                <StatDetailItem label="Innings" value={playerStats.inningsBatted} />
                                <StatDetailItem label="Not Outs" value={playerStats.notOuts} />
                                <StatDetailItem label="Average" value={playerStats.battingAverage?.toFixed(2) || '0.00'} />
                                <StatDetailItem label="Strike Rate" value={playerStats.strikeRate?.toFixed(2) || '0.00'} />
                                <StatDetailItem label="30s / 50s / 100s" value={`${playerStats.thirties} / ${playerStats.fifties} / ${playerStats.hundreds}`} />
                                <StatDetailItem label="4s / 6s" value={`${playerStats.fours} / ${playerStats.sixes}`} />
                                <StatDetailItem label="Ducks (Reg/Gld/Dia)" value={`${playerStats.ducks - (playerStats.goldenDucks + playerStats.diamondDucks)} / ${playerStats.goldenDucks} / ${playerStats.diamondDucks}`} />
                            </CardContent>
                        </Card>

                        <Card className="border-muted/60 shadow-sm">
                            <CardHeader><CardTitle className="text-lg font-bold">Career Bowling Summary</CardTitle></CardHeader>
                            <CardContent className="grid gap-4 sm:grid-cols-2">
                                <StatDetailItem label="Innings" value={playerStats.inningsBowled} />
                                <StatDetailItem label="Overs" value={playerStats.oversBowled} />
                                <StatDetailItem label="Runs Conceded" value={playerStats.runsConceded} />
                                <StatDetailItem label="Economy" value={playerStats.economyRate?.toFixed(2) || '0.00'} />
                                <StatDetailItem label="Average" value={playerStats.bowlingAverage?.toFixed(2) || '0.00'} />
                                <StatDetailItem label="Best Figures" value={`${playerStats.bestBowlingWickets}/${playerStats.bestBowlingRuns}`} />
                                <StatDetailItem label="2W / 3W / 4W / 5W+" value={`${playerStats.twoWickets} / ${playerStats.threeWickets} / ${playerStats.fourWickets} / ${playerStats.fiveWickets}`} />
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="matches">
                    <Card className="border-muted/60 shadow-sm overflow-hidden">
                        <CardHeader>
                            <CardTitle className="text-lg font-bold">Full Match Logs</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="px-6 text-[10px] font-bold uppercase tracking-widest">Date</TableHead>
                                        <TableHead className="text-[10px] font-bold uppercase tracking-widest">Match</TableHead>
                                        <TableHead className="text-[10px] font-bold uppercase tracking-widest">Result</TableHead>
                                        <TableHead className="px-6 text-right text-[10px] font-bold uppercase tracking-widest">Scorecard</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {recentMatches.map(match => {
                                        const team1 = teams?.find(t => t.id === match.team1Id);
                                        const team2 = teams?.find(t => t.id === match.team2Id);
                                        return (
                                            <TableRow key={match.id} className="hover:bg-muted/30">
                                                <TableCell className="px-6 text-xs font-medium text-muted-foreground">{new Date(match.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</TableCell>
                                                <TableCell className="font-bold text-sm">{team1?.name} vs {team2?.name}</TableCell>
                                                <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">{match.result || 'Completed'}</TableCell>
                                                <TableCell className="px-6 text-right">
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
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

function StatSummaryCard({ label, value, icon }: { label: string, value: string | number, icon: React.ReactNode }) {
    return (
        <Card className="bg-card border-muted/60 shadow-sm">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</CardTitle>
                <div className="text-primary/60">{icon}</div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
                <div className="text-2xl font-black">{value}</div>
            </CardContent>
        </Card>
    );
}

function StatDetailItem({ label, value }: { label: string, value: string | number }) {
    return (
        <div className="p-3 border rounded-xl bg-muted/10">
            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1">{label}</p>
            <p className="text-lg font-black text-foreground">{value}</p>
        </div>
    );
}