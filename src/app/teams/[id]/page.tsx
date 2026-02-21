'use client';

import { useParams } from 'next/navigation';
import { useDoc, useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import type { Team, Player, Match } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { AddPlayerDialog } from "@/components/players/add-player-dialog";
import { useAppContext } from "@/context/AppContext";
import Image from 'next/image';
import { User, MoreVertical } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import Link from 'next/link';
import { useMemo } from 'react';

export default function TeamDetailPage() {
    const params = useParams();
    const teamId = params.id as string;
    const { firestore: db } = useFirebase();
    const { addPlayer, deletePlayer } = useAppContext();

    const teamRef = useMemoFirebase(() => db ? doc(db, 'teams', teamId) : null, [db, teamId]);
    const { data: team, isLoading: teamLoading } = useDoc<Team>(teamRef);

    const playersCollection = useMemoFirebase(() => db ? collection(db, 'players') : null, [db]);
    const { data: allPlayers, isLoading: playersLoading } = useCollection<Player>(playersCollection);

    const matchesQuery = useMemoFirebase(() => db ? query(collection(db, 'matches'), orderBy('date', 'desc')) : null, [db]);
    const { data: matches, isLoading: matchesLoading } = useCollection<Match>(matchesQuery);

    // Robust Player Detection: Find players by teamId OR by participation in matches
    const players = useMemo(() => {
        if (!allPlayers || !teamId || !matches) return [];
        
        const participantIds = new Set<string>();
        
        // 1. Add players who have this teamId explicitly
        allPlayers.forEach(p => {
            if (p.teamId === teamId) participantIds.add(p.id);
        });

        // 2. Scan match history for this team
        matches.forEach(m => {
            if (m.team1Id === teamId || m.team2Id === teamId) {
                // Check squads
                if (m.team1Id === teamId) m.team1PlayerIds?.forEach(id => participantIds.add(id));
                if (m.team2Id === teamId) m.team2PlayerIds?.forEach(id => participantIds.add(id));
                
                // Check delivery history (for edge cases)
                m.innings.forEach(inn => {
                    if (inn.battingTeamId === teamId) {
                        inn.deliveryHistory.forEach(d => {
                            participantIds.add(d.strikerId);
                            if (d.nonStrikerId) participantIds.add(d.nonStrikerId);
                        });
                    }
                    if (inn.bowlingTeamId === teamId) {
                        inn.deliveryHistory.forEach(d => {
                            participantIds.add(d.bowlerId);
                        });
                    }
                });
            }
        });

        return allPlayers.filter(p => participantIds.has(p.id));
    }, [allPlayers, teamId, matches]);

    const stats = useMemo(() => {
        if (!matches || !team) return { played: 0, wins: 0, losses: 0, ties: 0 };
        
        const teamMatches = matches.filter(m => 
            m.status === 'completed' && (m.team1Id === team.id || m.team2Id === team.id)
        );

        let wins = 0;
        let losses = 0;
        let ties = 0;

        teamMatches.forEach(m => {
            if (m.result?.startsWith(team.name)) wins++;
            else if (m.result === 'Match is a Tie.') ties++;
            else if (m.result) losses++;
        });

        return {
            played: teamMatches.length,
            wins,
            losses,
            ties
        };
    }, [matches, team]);

    if (teamLoading) return <Skeleton className="h-[400px] w-full rounded-2xl" />;
    if (!team) return <div className="p-12 text-center text-muted-foreground bg-muted/10 rounded-2xl border-2 border-dashed">Team not found.</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto pb-10">
            <Card className="overflow-hidden border-none shadow-md">
                <div className="h-32 bg-gradient-to-r from-primary/20 to-primary/5 relative">
                    <div className="absolute -bottom-12 left-6">
                        <div className="h-24 w-24 relative rounded-full border-4 border-background bg-background shadow-lg overflow-hidden">
                            <Image 
                                src={team.logoUrl} 
                                alt={team.name} 
                                fill
                                className="object-cover"
                                data-ai-hint={team.imageHint}
                            />
                        </div>
                    </div>
                </div>
                <CardContent className="pt-16 pb-6 px-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-black tracking-tight font-headline">{team.name}</h1>
                            <p className="text-sm text-muted-foreground font-medium">Registered League Member</p>
                        </div>
                        <div className="flex gap-2">
                             <AddPlayerDialog onPlayerAdd={(data) => addPlayer({ ...data, teamId })} />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-3">
                <Card className="md:col-span-2 border-muted/60 shadow-sm rounded-2xl">
                    <CardHeader className="pb-3 border-b border-muted/50 bg-muted/5">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-lg font-bold">Squad Members</CardTitle>
                                <CardDescription className="text-xs font-medium">Total registered & participants: {players.length}</CardDescription>
                            </div>
                            <User className="h-5 w-5 text-muted-foreground/50" />
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                        {playersLoading || matchesLoading ? (
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Skeleton className="h-16 w-full" />
                                <Skeleton className="h-16 w-full" />
                            </div>
                        ) : players && players.length > 0 ? (
                            <div className="grid gap-4 sm:grid-cols-2">
                                {players.map(player => (
                                    <div key={player.id} className="flex items-center justify-between p-3 border border-muted/60 rounded-xl hover:bg-muted/30 hover:border-primary/20 transition-all group">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-10 w-10 border group-hover:border-primary/20 transition-colors">
                                                <AvatarImage src={player.imageUrl} className="object-cover" />
                                                <AvatarFallback className="bg-muted">
                                                    <User className="h-5 w-5 text-muted-foreground" />
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0">
                                                <Link href={`/players/${player.id}`} className="font-bold text-sm hover:text-primary truncate block">
                                                    {player.name}
                                                </Link>
                                                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">{player.role}</p>
                                            </div>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="rounded-xl">
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/players/${player.id}`}>View Profile</Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onSelect={() => deletePlayer(player.id)} className="text-destructive font-semibold">Remove Player</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-16 border-2 border-dashed rounded-2xl bg-muted/5">
                                <div className="h-12 w-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                                    <User className="h-6 w-6 text-muted-foreground" />
                                </div>
                                <p className="text-sm font-bold">No players in this squad yet.</p>
                                <p className="text-xs text-muted-foreground mt-1">Start by adding players to represent {team.name}.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    <Card className="border-primary/10 shadow-sm rounded-2xl overflow-hidden">
                        <CardHeader className="bg-primary/5 pb-4 border-b border-primary/10">
                            <CardTitle className="text-base font-black uppercase tracking-tight">Team Records</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="flex justify-between items-center border-b border-muted/50 pb-3">
                                <span className="text-sm font-medium text-muted-foreground">Matches Played</span>
                                <span className="font-black text-lg">{stats.played}</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-muted/50 pb-3">
                                <span className="text-sm font-medium text-muted-foreground">Matches Won</span>
                                <span className="font-black text-lg text-primary">{stats.wins}</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-muted/50 pb-3">
                                <span className="text-sm font-medium text-muted-foreground">Matches Lost</span>
                                <span className="font-black text-lg text-destructive">{stats.losses}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-muted-foreground">Tied / No Result</span>
                                <span className="font-black text-lg">{stats.ties}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
