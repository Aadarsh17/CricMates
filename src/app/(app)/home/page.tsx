'use client';

import { useAppContext } from "@/context/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Shield, Users, BarChart, PlayCircle, MoreVertical } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import type { Match, Team, Player } from "@/lib/types";
import { useMemo } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function HomePage() {
  const { firestore: db } = useFirebase();
  const { deleteMatch } = useAppContext();

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
  
  const loading = teamsLoading || playersLoading || liveMatchesLoading || completedMatchesLoading;


  if (loading) {
    return (
      <div className="space-y-4 md:space-y-6">
        <div className="flex flex-col items-center space-y-4">
            <div className="flex flex-col items-center space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
            <div className="flex gap-2">
                 <Skeleton className="h-10 w-36" />
                 <Skeleton className="h-10 w-36" />
            </div>
        </div>
        <div className="grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Teams</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <Skeleton className="h-7 w-12" />
                <Skeleton className="h-3 w-24 mt-1" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Players</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <Skeleton className="h-7 w-12" />
                <Skeleton className="h-3 w-24 mt-1" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Matches Completed</CardTitle>
                <BarChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <Skeleton className="h-7 w-12" />
                <Skeleton className="h-3 w-24 mt-1" />
            </CardContent>
          </Card>
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4 md:space-y-6">
          <div className="flex flex-col items-center text-center space-y-4">
              <div>
                <h1 className="text-3xl font-bold tracking-tight font-headline">
                  Welcome, Mates!
                </h1>
                <p className="text-muted-foreground">
                  Your CricMates dashboard for scores, stats, and more.
                </p>
              </div>
              <div className="flex items-center gap-2">
                   <Button asChild variant="outline">
                      <Link href="/teams">
                          <Users className="mr-2" /> Manage Teams
                      </Link>
                  </Button>
                   <Button asChild>
                      <Link href="/matches/new">
                          <PlusCircle className="mr-2" /> New Match
                      </Link>
                  </Button>
              </div>
          </div>

          <div className="grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Link href="/teams" className="block hover:no-underline">
                  <Card className="hover:bg-muted/50 transition-colors h-full">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Total Teams</CardTitle>
                          <Shield className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                          <div className="text-2xl font-bold">{teams.length}</div>
                          <p className="text-xs text-muted-foreground">
                              {teams.length === 1 ? 'team in the league' : 'teams in the league'}
                          </p>
                      </CardContent>
                  </Card>
              </Link>
              <Link href="/player-stats" className="block hover:no-underline">
                   <Card className="hover:bg-muted/50 transition-colors h-full">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Total Players</CardTitle>
                          <Users className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                          <div className="text-2xl font-bold">{players.length}</div>
                           <p className="text-xs text-muted-foreground">
                              {players.length === 1 ? 'player registered' : 'players registered'}
                          </p>
                      </CardContent>
                  </Card>
              </Link>
              <Link href="/matches" className="block hover:no-underline">
                   <Card className="hover:bg-muted/50 transition-colors h-full">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                          <CardTitle className="text-sm font-medium">Matches Completed</CardTitle>
                          <BarChart className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                          <div className="text-2xl font-bold">{completedMatches.length}</div>
                           <p className="text-xs text-muted-foreground">
                              {completedMatches.length === 1 ? 'game played' : 'games played'} so far
                          </p>
                      </CardContent>
                  </Card>
              </Link>
          </div>
          
          {liveMatches.length > 0 && (
              <div>
                   <h2 className="text-2xl font-bold tracking-tight font-headline mb-4">Live Matches</h2>
                   <div className="grid gap-4 md:gap-6 md:grid-cols-2">
                      {liveMatches.map(match => {
                          const team1 = getTeamById(match.team1Id);
                          const team2 = getTeamById(match.team2Id);
                          const currentInning = match.innings[match.currentInning - 1];
                          return (
                              <Card key={match.id}>
                                  <CardHeader className="flex flex-row items-start justify-between">
                                      <div>
                                          <CardTitle>{team1?.name || 'Team 1'} vs {team2?.name || 'Team 2'}</CardTitle>
                                          <p className="text-sm text-muted-foreground pt-1">
                                              {currentInning.score}/{currentInning.wickets} ({currentInning.overs.toFixed(1)} overs)
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
                                              <AlertDialogTrigger asChild>
                                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive-foreground focus:bg-destructive">
                                                    Delete
                                                </DropdownMenuItem>
                                              </AlertDialogTrigger>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    This action cannot be undone. This will permanently delete this match.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => deleteMatch(match.id)}>Delete</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                  </CardHeader>
                                  <CardContent>
                                      <Button asChild className="w-full">
                                          <Link href={`/matches/${match.id}`}>
                                              <PlayCircle className="mr-2" /> Go to Match
                                          </Link>
                                      </Button>
                                  </CardContent>
                              </Card>
                          )
                      })}
                   </div>
              </div>
          )}
          
           {liveMatches.length === 0 && (
            <div className="flex h-full flex-1 items-center justify-center rounded-lg border-2 border-dashed shadow-sm py-24">
              <div className="flex flex-col items-center gap-2 text-center">
                <h3 className="text-2xl font-bold tracking-tight">No Live Matches</h3>
                <p className="text-sm text-muted-foreground">
                  Start a new match to see live scoring here.
                </p>
                <Button asChild className="mt-4">
                  <Link href="/matches/new">
                    <PlusCircle className="mr-2" /> Start New Match
                  </Link>
                </Button>
              </div>
            </div>
          )}
      </div>
    </>
  );
}
