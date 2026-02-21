'use client';

import { useParams } from 'next/navigation';
import { useDoc, useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import type { Team, Player } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { AddPlayerDialog } from "@/components/players/add-player-dialog";
import { useAppContext } from "@/context/AppContext";
import Image from 'next/image';
import { User, MoreVertical } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import Link from 'next/link';

export default function TeamDetailPage() {
    const params = useParams();
    const teamId = params.id as string;
    const { firestore: db } = useFirebase();
    const { addPlayer, deletePlayer } = useAppContext();

    const teamRef = useMemoFirebase(() => db ? doc(db, 'teams', teamId) : null, [db, teamId]);
    const { data: team, isLoading: teamLoading } = useDoc<Team>(teamRef);

    const playersQuery = useMemoFirebase(() => db ? query(collection(db, 'players'), where('teamId', '==', teamId)) : null, [db, teamId]);
    const { data: players, isLoading: playersLoading } = useCollection<Player>(playersQuery);

    if (teamLoading) return <Skeleton className="h-[400px] w-full" />;
    if (!team) return <div className="p-8 text-center text-muted-foreground">Team not found.</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <Card className="overflow-hidden border-primary/20">
                <div className="h-32 bg-primary/10 relative">
                    <div className="absolute -bottom-12 left-6">
                        <Image 
                            src={team.logoUrl} 
                            alt={team.name} 
                            width={100} 
                            height={100} 
                            className="rounded-full border-4 border-background bg-background shadow-md"
                            data-ai-hint={team.imageHint}
                        />
                    </div>
                </div>
                <CardContent className="pt-16 pb-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold font-headline">{team.name}</h1>
                            <p className="text-muted-foreground">Registered League Member</p>
                        </div>
                        <div className="flex gap-2">
                             <AddPlayerDialog onPlayerAdd={(data) => addPlayer({ ...data, teamId })} />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-3">
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>Squad Members</CardTitle>
                        <CardDescription>All players registered to {team.name}.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {playersLoading ? (
                            <Skeleton className="h-64 w-full" />
                        ) : players && players.length > 0 ? (
                            <div className="grid gap-4 sm:grid-cols-2">
                                {players.map(player => (
                                    <div key={player.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <Avatar>
                                                <AvatarFallback>{player.name[0]}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <Link href={`/players/${player.id}`} className="font-semibold text-sm hover:underline hover:text-primary">
                                                    {player.name}
                                                </Link>
                                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{player.role}</p>
                                            </div>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                                    <MoreVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onSelect={() => deletePlayer(player.id)} className="text-destructive">Remove Player</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 border-2 border-dashed rounded-lg">
                                <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                <p className="text-sm text-muted-foreground">No players in this squad yet.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    <Card className="border-primary/10">
                        <CardHeader>
                            <CardTitle className="text-lg">Team Records</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center border-b pb-2">
                                <span className="text-sm text-muted-foreground">Played</span>
                                <span className="font-bold">{team.matchesPlayed}</span>
                            </div>
                            <div className="flex justify-between items-center border-b pb-2">
                                <span className="text-sm text-muted-foreground">Wins</span>
                                <span className="font-bold text-primary">{team.matchesWon}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Losses</span>
                                <span className="font-bold">{team.matchesLost}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
