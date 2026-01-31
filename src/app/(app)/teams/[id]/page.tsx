'use client';

import { notFound, useParams } from "next/navigation";
import type { Team, Player, Match } from '@/lib/types';
import { useDoc, useFirebase, useMemoFirebase, useCollection } from "@/firebase";
import { doc, collection } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { useMemo } from "react";

export default function TeamDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { firestore: db } = useFirebase();

  const teamRef = useMemoFirebase(() => (db ? doc(db, 'teams', id) : null), [db, id]);
  const { data: team, isLoading: teamLoading } = useDoc<Team>(teamRef);

  const playersCollection = useMemoFirebase(() => (db ? collection(db, 'players') : null), [db]);
  const { data: playersData, isLoading: playersLoading } = useCollection<Player>(playersCollection);
  const allPlayers = playersData || [];

  const matchesCollection = useMemoFirebase(() => (db ? collection(db, 'matches') : null), [db]);
  const { data: matchesData, isLoading: matchesLoading } = useCollection<Match>(matchesCollection);
  const allMatches = matchesData || [];
  
  const teamsCollection = useMemoFirebase(() => (db ? collection(db, 'teams') : null), [db]);
  const { data: teamsData, isLoading: teamsLoading } = useCollection<Team>(teamsCollection);
  const allTeams = teamsData || [];

  const teamMatches = useMemo(() => {
    return allMatches.filter(match => match.status === 'completed' && (match.team1Id === id || match.team2Id === id))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allMatches, id]);
  
  const teamStats = useMemo(() => {
    if (!team) return null;
    const played = teamMatches.length;
    const won = teamMatches.filter(m => m.result?.startsWith(team.name)).length;
    const tied = teamMatches.filter(m => m.result === 'Match is a Tie.').length;
    const lost = played - won - tied;
    return { played, won, lost, tied };
  }, [team, teamMatches]);

  const teamPlayerIds = useMemo(() => {
    const playerIds = new Set<string>();
    teamMatches.forEach(match => {
        if (match.team1Id === id && match.team1PlayerIds) {
            match.team1PlayerIds.forEach(pid => playerIds.add(pid));
        } else if (match.team2Id === id && match.team2PlayerIds) {
            match.team2PlayerIds.forEach(pid => playerIds.add(pid));
        }
    });
    return Array.from(playerIds);
  }, [teamMatches, id]);

  const teamPlayers = useMemo(() => {
    return allPlayers.filter(player => teamPlayerIds.includes(player.id));
  }, [allPlayers, teamPlayerIds]);

  const isLoading = teamLoading || playersLoading || matchesLoading || teamsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-24 w-full" />
          <div className="grid md:grid-cols-2 gap-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
      </div>
    );
  }

  if (!team) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">{team.name}</h1>
          <p className="text-muted-foreground">
            Team overview, squad, and match history.
          </p>
        </div>
      </div>
      
      <Card>
        <CardHeader>
            <CardTitle>Team Summary</CardTitle>
        </CardHeader>
        <CardContent>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Played</p>
                    <p className="text-3xl font-bold">{teamStats?.played}</p>
                </div>
                 <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Won</p>
                    <p className="text-3xl font-bold text-primary">{teamStats?.won}</p>
                </div>
                 <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Lost</p>
                    <p className="text-3xl font-bold text-destructive">{teamStats?.lost}</p>
                </div>
                 <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Tied</p>
                    <p className="text-3xl font-bold">{teamStats?.tied}</p>
                </div>
            </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
            <CardHeader>
                <CardTitle>Squad</CardTitle>
            </CardHeader>
            <CardContent>
                {teamPlayers.length > 0 ? (
                <div className="space-y-4">
                    {teamPlayers.map(player => (
                    <Link href={`/players/${player.id}`} key={player.id} className="flex items-center gap-3 p-2 -m-2 rounded-lg hover:bg-muted/50 transition-colors">
                        <Avatar>
                            <AvatarFallback>{player.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-semibold">{player.name}</p>
                            <p className="text-sm text-muted-foreground">{player.role}</p>
                        </div>
                    </Link>
                    ))}
                </div>
                ) : (
                <p className="text-sm text-muted-foreground text-center py-10">No players have played for this team yet.</p>
                )}
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Match History</CardTitle>
            </CardHeader>
            <CardContent>
                {teamMatches.length > 0 ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Opponent</TableHead>
                                <TableHead>Result</TableHead>
                                <TableHead className="text-right"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {teamMatches.map(match => {
                                const opponent = match.team1Id === id ? allTeams.find(t=>t.id === match.team2Id) : allTeams.find(t=>t.id === match.team1Id);
                                const won = match.result?.startsWith(team.name);
                                const isTie = match.result === 'Match is a Tie.';
                                let resultColor = 'text-destructive';
                                if (won) resultColor = 'text-primary';
                                if (isTie) resultColor = 'text-muted-foreground';

                                return (
                                <TableRow key={match.id}>
                                    <TableCell className="text-sm text-muted-foreground">{format(new Date(match.date), 'dd MMM yyyy')}</TableCell>
                                    <TableCell className="font-medium">{opponent?.name}</TableCell>
                                    <TableCell className={`font-semibold ${resultColor}`}>
                                        {match.result}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button asChild size="sm" variant="outline">
                                            <Link href={`/matches/${match.id}`}>Scorecard</Link>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                ) : (
                     <p className="text-sm text-muted-foreground text-center py-10">No matches played yet.</p>
                )}
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
