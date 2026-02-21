'use client';

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Trash2, FileDown, MoreVertical, Calendar, Info } from "lucide-react";
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
import Image from "next/image";

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

  const getTeam = (id: string) => teams.find(t => t.id === id);

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
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto">
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
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 w-full rounded-lg" />)}
        </div>
      ) : matches && matches.length > 0 ? (
        <div className="grid gap-4">
          {matches.map(match => {
            const team1 = getTeam(match.team1Id);
            const team2 = getTeam(match.team2Id);
            const inning1 = match.innings[0];
            const inning2 = match.innings[1];
            
            const isWinner1 = match.result?.startsWith(team1?.name || '');
            const isWinner2 = match.result?.startsWith(team2?.name || '');

            return (
              <Card key={match.id} className="relative group hover:bg-muted/5 transition-colors overflow-hidden border-muted/60">
                {/* Main Link Overlay - z-0 to stay behind interaction buttons but cover the card area */}
                <Link href={`/matches/${match.id}`} className="absolute inset-0 z-0" />
                
                <CardContent className="p-4 sm:p-6 space-y-4 relative z-10 pointer-events-none">
                  <div className="flex justify-between items-start relative z-20 pointer-events-auto">
                    <div className="text-[11px] sm:text-xs text-muted-foreground font-medium uppercase tracking-tight flex items-center gap-2">
                      <Calendar className="h-3 w-3" />
                      {new Date(match.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      <span>•</span>
                      <span>{match.overs} Over Match</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={match.status === 'live' ? 'destructive' : 'secondary'} className="text-[9px] px-1.5 py-0 h-4">
                        {match.status.toUpperCase()}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-muted" onClick={(e) => e.stopPropagation()}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={(e) => handleDownloadFile(e, match)}>
                            <FileDown className="mr-2 h-4 w-4" /> Download Scorecard
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" /> Delete Match
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
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
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {/* Team 1 Row */}
                    <div className={`flex items-center justify-between ${isWinner1 ? 'font-bold' : ''}`}>
                      <div className="flex items-center gap-3">
                        <div className="h-6 w-6 relative rounded-sm overflow-hidden border bg-muted shrink-0">
                          {team1 && <Image src={team1.logoUrl} alt="" fill className="object-cover" />}
                        </div>
                        <span className="text-base sm:text-lg">{team1?.name}</span>
                      </div>
                      <div className="text-base sm:text-lg font-mono">
                        {inning1 ? `${inning1.score}-${inning1.wickets} (${inning1.overs.toFixed(1)})` : '-'}
                      </div>
                    </div>

                    {/* Team 2 Row */}
                    <div className={`flex items-center justify-between ${isWinner2 ? 'font-bold' : ''}`}>
                      <div className="flex items-center gap-3">
                        <div className="h-6 w-6 relative rounded-sm overflow-hidden border bg-muted shrink-0">
                          {team2 && <Image src={team2.logoUrl} alt="" fill className="object-cover" />}
                        </div>
                        <span className="text-base sm:text-lg">{team2?.name}</span>
                      </div>
                      <div className="text-base sm:text-lg font-mono">
                        {inning2 ? `${inning2.score}-${inning2.wickets} (${inning2.overs.toFixed(1)})` : '-'}
                      </div>
                    </div>
                  </div>

                  <div className="pt-1">
                    {match.result ? (
                      <p className="text-sm font-medium text-primary">
                        {match.result}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5 italic">
                        <Info className="h-3.5 w-3.5" /> Match in Progress
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t flex items-center gap-4 text-xs font-semibold text-primary relative z-20 pointer-events-auto">
                    <Link href={`/matches/${match.id}`} className="hover:underline">
                      {match.status === 'live' ? 'Live Score' : 'Scorecard'}
                    </Link>
                    <span className="text-muted-foreground/30 font-normal">|</span>
                    <span className="hover:underline cursor-pointer" onClick={(e) => handleDownloadFile(e, match)}>
                      Download Report
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-24 border-2 border-dashed rounded-xl bg-muted/10">
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
