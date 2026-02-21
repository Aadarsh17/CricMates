'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, FileText, Trash2, Trophy, FileDown, MoreVertical } from "lucide-react";
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

  const handleDownloadFile = (match: Match) => {
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">Match History</h1>
          <p className="text-muted-foreground">View results and scorecards from all your games.</p>
        </div>
        <Button asChild>
          <Link href="/matches/new">
            <PlusCircle className="mr-2 h-4 w-4" /> New Match
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-lg" />)}
        </div>
      ) : matches && matches.length > 0 ? (
        <div className="grid gap-4">
          {matches.map(match => (
            <Card key={match.id} className="hover:border-primary/20 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {new Date(match.date).toLocaleDateString()} • {match.overs} Overs
                </CardTitle>
                <div className="flex items-center gap-2">
                   <Badge variant={match.status === 'live' ? 'destructive' : 'secondary'}>
                    {match.status.toUpperCase()}
                  </Badge>
                  <AlertDialog>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
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
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete Match
                                </DropdownMenuItem>
                            </AlertDialogTrigger>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete match record?</AlertDialogTitle>
                        <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMatch(match.id)} className="bg-destructive">Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <div className="space-y-1">
                    <p className="text-lg font-bold">
                      {getTeamName(match.team1Id)} vs {getTeamName(match.team2Id)}
                    </p>
                    <p className="text-sm font-semibold text-primary flex items-center gap-2">
                      {match.result || 'In Progress'}
                    </p>
                  </div>
                  <Button asChild variant="outline">
                    <Link href={`/matches/${match.id}`}>
                      <FileText className="mr-2 h-4 w-4" /> {match.status === 'live' ? 'Scoring' : 'Scorecard'}
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 border-2 border-dashed rounded-lg">
          <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-bold">No matches found</h3>
          <p className="text-muted-foreground">Start a new match to see history here.</p>
        </div>
      )}
    </div>
  );
}
