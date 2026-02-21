'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Shield, Users, BarChart, MoreVertical, PlayCircle, FileDown } from "lucide-react";
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
  
  const getTeamById = useMemo(() => (teamId: string) => teams.find(t => t.id === teamId), [teams]);
  
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
    <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
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

      {liveMatches.length > 0 && (
          <div className="space-y-4">
              <h2 className="text-xl md:text-2xl font-bold tracking-tight font-headline flex items-center gap-2">
                  <PlayCircle className="h-5 w-5 md:h-6 md:w-6 text-primary animate-pulse" /> Live Matches
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                  {liveMatches.map(match => {
                      const team1 = getTeamById(match.team1Id);
                      const team2 = getTeamById(match.team2Id);
                      const currentInning = match.innings[match.currentInning - 1];
                      return (
                          <Card key={match.id} className="overflow-hidden border-primary/20 bg-primary/5 shadow-md">
                              <CardHeader className="flex flex-row items-start justify-between pb-2">
                                  <div>
                                      <CardTitle className="text-base md:text-lg">{team1?.name} vs {team2?.name}</CardTitle>
                                      <p className="text-xs text-muted-foreground pt-1">
                                          Inning {match.currentInning} • {match.overs} Overs
                                      </p>
                                  </div>
                                  <AlertDialog>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 -mt-2 -mr-2">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem onClick={() => handleDownloadFile(match)}>
                                              <FileDown className="mr-2 h-4 w-4" /> Download Scorecard
                                          </DropdownMenuItem>
                                          <DropdownMenuSeparator />
                                          <AlertDialogTrigger asChild>
                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                                                Delete Match
                                            </DropdownMenuItem>
                                          </AlertDialogTrigger>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Delete match?</AlertDialogTitle>
                                            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => deleteMatch(match.id)} className="bg-destructive">Delete</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                              </CardHeader>
                              <CardContent className="pb-4 space-y-4">
                                  <div className="flex justify-between items-center">
                                      <div className="space-y-1">
                                          <p className="text-sm font-semibold text-primary">{getTeamById(currentInning.battingTeamId)?.name}</p>
                                          <p className="text-2xl font-bold font-mono">{currentInning.score}/{currentInning.wickets} <span className="text-sm font-normal text-muted-foreground">({currentInning.overs.toFixed(1)})</span></p>
                                      </div>
                                      <Button asChild size="sm">
                                          <Link href={`/matches/${match.id}`}>Score Now</Link>
                                      </Button>
                                  </div>
                              </CardContent>
                          </Card>
                      )
                  })}
              </div>
          </div>
      )}
      
      {sortedCompletedMatches.length > 0 && (
          <div className="space-y-4">
               <h2 className="text-xl md:text-2xl font-bold tracking-tight font-headline">Recent Results</h2>
               <div className="grid gap-4 sm:grid-cols-2">
                  {sortedCompletedMatches.map(match => {
                      const team1 = getTeamById(match.team1Id);
                      const team2 = getTeamById(match.team2Id);
                      const firstInning = match.innings[0];
                      const secondInning = match.innings.length > 1 ? match.innings[1] : null;
                      return (
                          <Card key={match.id} className="hover:shadow-sm transition-shadow">
                              <CardHeader className="flex flex-row items-start justify-between pb-2">
                                  <div>
                                      <CardTitle className="text-base">{team1?.name} vs {team2?.name}</CardTitle>
                                      <p className="text-[10px] md:text-xs text-muted-foreground">{new Date(match.date).toLocaleDateString()}</p>
                                  </div>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownloadFile(match)}>
                                      <FileDown className="h-4 w-4" />
                                  </Button>
                              </CardHeader>
                              <CardContent className="space-y-2 pb-4">
                                  <div className="flex justify-between items-center text-xs">
                                      <span>{getTeamById(firstInning.battingTeamId)?.name}</span>
                                      <span className="font-mono font-medium">{firstInning.score}/{firstInning.wickets} ({firstInning.overs.toFixed(1)})</span>
                                  </div>
                                  {secondInning && (
                                      <div className="flex justify-between items-center text-xs">
                                          <span>{getTeamById(secondInning.battingTeamId)?.name}</span>
                                          <span className="font-mono font-medium">{secondInning.score}/{secondInning.wickets} ({secondInning.overs.toFixed(1)})</span>
                                      </div>
                                  )}
                                  <p className="text-[10px] font-bold text-primary mt-2 uppercase tracking-tight">{match.result}</p>
                                  <Button asChild variant="outline" size="sm" className="w-full mt-2 h-8 text-xs">
                                      <Link href={`/matches/${match.id}`}>View Details</Link>
                                  </Button>
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
