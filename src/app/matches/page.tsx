'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, FileText, Trash2, Trophy, FileDown, MoreVertical, Calendar, Info } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { useCollection, useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import type { Match, Team, Player } from "@/lib/types";
import { useAppContext } from "@/context/AppContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { downloadScorecard } from "@/lib/utils";

export default function MatchHistoryPage() {
  const { firestore: db } = useFirebase();
  const { deleteMatch } = useAppContext();
  const { toast } = useToast();

  const teamsCollection = useMemoFirebase(() => (db ? collection(db, 'teams') : null), [db]);
  const { data: teamsData } = useCollection<Team>(teamsCollection);
  const teams = teamsData || [];

  const playersCollection = useMemoFirebase(() => (db ? collection(db, 'players') : null), [db]);
  const { data: playersData } = useCollection<Player>(playersCollection);
  const players = playersData || [];

  const matchesQuery = useMemoFirebase(() => (db ? query(collection(db, 'matches'), orderBy('date', 'desc')) : null), [db]);
  const { data: matches, isLoading } = useCollection<Match>(matchesQuery);

  const getTeamName = (id: string) => teams.find(t => t.id === id)?.name || 'Unknown';

  const handleDownloadFile = (e: React.MouseEvent, match: Match) => {
    e.preventDefault();
    e.stopPropagation();
    if (!teams.length || !players.length) {
        toast({ variant: "destructive", title: "Please wait", description: "Data is still loading." });
        return;
    }
    try {
        downloadScorecard(match, teams, players);
        toast({ title: "Scorecard Downloaded", description: "HTML file saved successfully." });
    } catch (e) {
        toast({ variant: "destructive", title: "Download Failed" });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-headline">Match History</h1>
          <p className="text-sm text-muted-foreground">Results and scorecards from all your games.</p>
        </div>
        <Button asChild className="w-full sm:w-auto shadow-md">
          <Link href="/matches/new">
            <PlusCircle className="mr-2 h-4 w-4" /> New Match
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-lg" />)}
        </div>
      ) : matches && matches.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
          {matches.map(match => (
            <Card key={match.id} className="relative group hover:border-primary/40 hover:shadow-md transition-all duration-300 overflow-hidden">
              {/* Clickable Area */}
              <Link href={`/matches/${match.id}`} className="absolute inset-0 z-0">
                <span className="sr-only">View scorecard for {getTeamName(match.team1Id)} vs {getTeamName(match.team2Id)}</span>
              </Link>

              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {new Date(match.date).toLocaleDateString()}
                    <span>•</span>
                    <span>{match.overs} Overs</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                   <Badge variant={match.status === 'live' ? 'destructive' : 'secondary'} className="text-[10px] px-2 py-0 h-5">
                    {match.status.toUpperCase()}
                  </Badge>
                  
                  {/* Dropdown Menu - Needs to be higher z-index than the link */}
                  <div className="relative z-20">
                    <AlertDialog>
                      <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted" onClick={(e) => e.stopPropagation()}>
                                  <MoreVertical className="h-4 w-4" />
                              </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={(e) => handleDownloadFile(e, match)}>
                                  <FileDown className="mr-2 h-4 w-4" /> Download Scorecard
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <AlertDialogTrigger asChild>
                                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                                      <Trash2 className="mr-2 h-4 w-4" /> Delete Match
                                  </DropdownMenuItem>
                              </AlertDialogTrigger>
                          </DropdownMenuContent>
                      </DropdownMenu>
                      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete match record?</AlertDialogTitle>
                          <AlertDialogDescription>This action cannot be undone. All stats associated with this match will be removed from history.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMatch(match.id)} className="bg-destructive">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="relative z-10 pointer-events-none">
                <div className="flex justify-between items-center gap-4">
                  <div className="space-y-1 flex-1">
                    <p className="text-lg md:text-xl font-bold tracking-tight">
                      {getTeamName(match.team1Id)} <span className="text-muted-foreground font-normal text-sm mx-1">vs</span> {getTeamName(match.team2Id)}
                    </p>
                    {match.result ? (
                      <p className="text-sm font-semibold text-primary flex items-center gap-1.5">
                        <Trophy className="h-3.5 w-3.5" />
                        {match.result}
                      </p>
                    ) : (
                      <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                        <Info className="h-3.5 w-3.5" />
                        Match in Progress
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 hidden sm:block">
                    <Button variant="ghost" size="sm" className="text-primary font-bold group-hover:bg-primary/10 transition-colors">
                      SCORECARD <FileText className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-24 border-2 border-dashed rounded-xl bg-muted/10">
          <Trophy className="h-16 w-16 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="text-xl font-bold">No matches found</h3>
          <p className="text-sm text-muted-foreground mb-6">Start a new match to build your league history.</p>
          <Button asChild>
            <Link href="/matches/new"><PlusCircle className="mr-2 h-4 w-4" /> Start New Match</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
