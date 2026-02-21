'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Shield, Users, BarChart, MoreVertical, PlayCircle, FileDown, Calendar } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import type { Match, Team, Player } from "@/lib/types";
import { useMemo } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useAppContext } from "@/context/AppContext";
import { useToast } from "@/hooks/use-toast";
import { downloadScorecard } from "@/lib/utils";
import Image from "next/image";

export default function HomePage() {
  const { firestore: db } = useFirebase();
  const { deleteMatch } = useAppContext();
  const { toast } = useToast();

  const teamsCollection = useMemoFirebase(() => (db ? collection(db, 'teams') : null), [db]);
  const { data: teamsData, isLoading: teamsLoading } = useCollection<Team>(teamsCollection);
  const teams = teamsData || [];

  const playersCollection = useMemoFirebase(() => (db ? collection(db, 'players') : null), [db]);
  const { data: playersData, isLoading: playersLoading } = useCollection<Player>(playersCollection);
  const players = playersData || [];
  
  const liveMatchesQuery = useMemoFirebase(() => db ? query(collection(db, 'matches'), where('status', '==', 'live')) : null, [db]);
  const { data: liveMatchesData, isLoading: liveMatchesLoading } = useCollection<Match>(liveMatchesQuery);
  const liveMatches = liveMatchesData || [];

  const completedMatchesQuery = useMemoFirebase(() => db ? query(collection(db, 'matches'), where('status', '==', 'completed')) : null, [db]);
  const { data: completedMatchesData, isLoading: completedMatchesLoading } = useCollection<Match>(completedMatchesQuery);
  const completedMatches = completedMatchesData || [];
  
  const getTeam = (id: string) => teams.find(t => t.id === id);
  
  const sortedCompletedMatches = useMemo(() => {
    return [...completedMatches].sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
    }).slice(0, 4);
  }, [completedMatches]);

  const handleDownloadFile = (match: Match) => {
    if (!teams.length || !players.length) return;
    try {
        downloadScorecard(match, teams, players);
        toast({ title: "Scorecard Downloaded", description: "HTML file saved successfully." });
    } catch (e) {
        toast({ variant: "destructive", title: "Download Failed" });
    }
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto">
      <div className="flex flex-col items-center text-center space-y-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight font-headline text-primary">
              Welcome, Mates!
            </h1>
            <p className="text-muted-foreground text-sm md:text-base">
              Your CricMates dashboard for scores, stats, and more.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
               <Button asChild variant="outline" className="w-full sm:w-auto">
                  <Link href="/teams">
                      <Users className="mr-2 h-4 w-4" /> Manage Teams
                  </Link>
              </Button>
               <Button asChild className="w-full sm:w-auto">
                  <Link href="/matches/new">
                      <PlusCircle className="mr-2 h-4 w-4" /> New Match
                  </Link>
              </Button>
          </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/teams" className="block hover:no-underline focus:outline-none focus:ring-2 focus:ring-primary rounded-lg">
              <Card className="hover:bg-muted/50 transition-colors h-full border-primary/10">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-xs md:text-sm font-medium uppercase tracking-wider">Total Teams</CardTitle>
                      <Shield className="h-4 w-4 text-primary/60" />
                  </CardHeader>
                  <CardContent>
                      {teamsLoading ? <Skeleton className="h-8 w-12" /> : <div className="text-2xl font-bold">{teams.length}</div>}
                      <p className="text-xs text-muted-foreground">Registered league teams</p>
                  </CardContent>
              </Card>
          </Link>
          <Link href="/player-stats" className="block hover:no-underline focus:outline-none focus:ring-2 focus:ring-primary rounded-lg">
               <Card className="hover:bg-muted/50 transition-colors h-full border-primary/10">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-xs md:text-sm font-medium uppercase tracking-wider">Total Players</CardTitle>
                      <Users className="h-4 w-4 text-primary/60" />
                  </CardHeader>
                  <CardContent>
                      {playersLoading ? <Skeleton className="h-8 w-12" /> : <div className="text-2xl font-bold">{players.length}</div>}
                       <p className="text-xs text-muted-foreground">Registered athletes</p>
                  </CardContent>
              </Card>
          </Link>
          <Link href="/matches" className="block hover:no-underline focus:outline-none focus:ring-2 focus:ring-primary rounded-lg">
               <Card className="hover:bg-muted/50 transition-colors h-full border-primary/10">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-xs md:text-sm font-medium uppercase tracking-wider">Matches Played</CardTitle>
                      <BarChart className="h-4 w-4 text-primary/60" />
                  </CardHeader>
                  <CardContent>
                      {completedMatchesLoading ? <Skeleton className="h-8 w-12" /> : <div className="text-2xl font-bold">{completedMatches.length}</div>}
                       <p className="text-xs text-muted-foreground">Historical records</p>
                  </CardContent>
              </Card>
          </Link>
      </div>

      {(liveMatches.length > 0 || sortedCompletedMatches.length > 0) && (
          <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl md:text-2xl font-bold tracking-tight font-headline flex items-center gap-2">
                    <PlayCircle className="h-5 w-5 md:h-6 md:w-6 text-primary" /> Recent & Live Matches
                </h2>
                <Button asChild variant="ghost" size="sm" className="text-primary font-bold">
                  <Link href="/matches">View All</Link>
                </Button>
              </div>
              
              <div className="grid gap-4 md:grid-cols-2">
                  {[...liveMatches, ...sortedCompletedMatches].map(match => {
                      const team1 = getTeam(match.team1Id);
                      const team2 = getTeam(match.team2Id);
                      const inning1 = match.innings[0];
                      const inning2 = match.innings[1];
                      const currentInning = match.innings[match.currentInning - 1];
                      const isWinner1 = match.result?.startsWith(team1?.name || '');
                      const isWinner2 = match.result?.startsWith(team2?.name || '');

                      return (
                          <Card key={match.id} className="relative group hover:bg-muted/5 transition-colors overflow-hidden border-muted/60">
                              <Link href={`/matches/${match.id}`} className="absolute inset-0 z-0" />
                              <CardContent className="p-5 space-y-4 relative z-10">
                                  <div className="flex justify-between items-center">
                                    <div className="text-[10px] text-muted-foreground font-semibold uppercase flex items-center gap-1.5">
                                      <Calendar className="h-3 w-3" />
                                      {new Date(match.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                      <span>•</span>
                                      <span>{match.overs} Overs</span>
                                    </div>
                                    <Badge variant={match.status === 'live' ? 'destructive' : 'secondary'} className="text-[9px] h-4">
                                      {match.status.toUpperCase()}
                                    </Badge>
                                  </div>

                                  <div className="space-y-2.5">
                                    <div className={`flex items-center justify-between ${isWinner1 ? 'font-bold' : ''}`}>
                                      <div className="flex items-center gap-2.5">
                                        <div className="h-5 w-5 relative rounded-sm border bg-muted shrink-0 overflow-hidden">
                                          {team1 && <Image src={team1.logoUrl} alt="" fill className="object-cover" />}
                                        </div>
                                        <span className="text-sm sm:text-base">{team1?.name}</span>
                                      </div>
                                      <div className="text-sm sm:text-base font-mono">
                                        {inning1 ? `${inning1.score}-${inning1.wickets} (${inning1.overs.toFixed(1)})` : '-'}
                                      </div>
                                    </div>

                                    <div className={`flex items-center justify-between ${isWinner2 ? 'font-bold' : ''}`}>
                                      <div className="flex items-center gap-2.5">
                                        <div className="h-5 w-5 relative rounded-sm border bg-muted shrink-0 overflow-hidden">
                                          {team2 && <Image src={team2.logoUrl} alt="" fill className="object-cover" />}
                                        </div>
                                        <span className="text-sm sm:text-base">{team2?.name}</span>
                                      </div>
                                      <div className="text-sm sm:text-base font-mono">
                                        {inning2 ? `${inning2.score}-${inning2.wickets} (${inning2.overs.toFixed(1)})` : '-'}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="pt-1">
                                    {match.result ? (
                                      <p className="text-xs font-semibold text-primary">{match.result}</p>
                                    ) : (
                                      <p className="text-xs text-muted-foreground italic flex items-center gap-1">
                                        Currently Batting: {getTeam(currentInning.battingTeamId)?.name}
                                      </p>
                                    )}
                                  </div>
                              </CardContent>
                          </Card>
                      )
                  })}
              </div>
          </div>
      )}
      
      {!liveMatchesLoading && liveMatches.length === 0 && sortedCompletedMatches.length === 0 && (
          <div className="flex h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed bg-muted/20 p-6 text-center">
            <h3 className="text-lg font-bold">Ready to Play?</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">Start a new match to track scores and build your league history.</p>
            <Button asChild className="mt-4 shadow-md">
              <Link href="/matches/new"><PlusCircle className="mr-2 h-4 w-4" /> Start Match</Link>
            </Button>
          </div>
      )}
    </div>
  );
}
