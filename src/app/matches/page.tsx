'use client';

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Trash2, FileDown, MoreVertical, Calendar, Info, Share2, Trophy } from "lucide-react";
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

  const handleShare = (e: React.MouseEvent, matchId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/share/match/${matchId}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link Copied", description: "Share the link with your mates!" });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 max-w-4xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 px-1">
        <div className="space-y-1">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight font-headline">Match History</h1>
          <p className="text-sm sm:text-base text-muted-foreground font-medium">Tournament records and detailed reports.</p>
        </div>
        <Button asChild className="w-full sm:w-auto shadow-xl shadow-primary/20 rounded-full h-11 px-6">
          <Link href="/matches/new">
            <PlusCircle className="mr-2 h-5 w-5" /> New Match
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-6">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 w-full rounded-3xl" />)}
        </div>
      ) : matches && matches.length > 0 ? (
        <div className="grid gap-6">
          {matches.map(match => {
            const team1 = getTeam(match.team1Id);
            const team2 = getTeam(match.team2Id);
            const inning1 = match.innings[0];
            const inning2 = match.innings[1];
            const isWinner1 = match.result?.startsWith(team1?.name || '');
            const isWinner2 = match.result?.startsWith(team2?.name || '');

            return (
              <Card key={match.id} className="relative overflow-hidden group hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500 border-muted/60 rounded-3xl">
                <Link href={`/matches/${match.id}`} className="absolute inset-0 z-0" />
                
                <CardContent className="p-0 relative z-10">
                  {/* Top Bar */}
                  <div className="px-6 py-4 flex justify-between items-center bg-muted/10 border-b border-muted/50">
                    <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                            {new Date(match.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            <span className="mx-2 text-muted-foreground/30">•</span>
                            {match.overs} Over Match
                        </span>
                    </div>
                    <div className="flex items-center gap-2 relative z-20">
                      <Badge variant={match.status === 'live' ? 'destructive' : 'secondary'} className="text-[10px] font-black uppercase px-2.5 h-5 shadow-sm">
                        {match.status}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted rounded-full" onClick={(e) => e.stopPropagation()}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52 rounded-xl mt-1">
                          <DropdownMenuItem onClick={(e) => handleDownloadFile(e, match)} className="rounded-lg">
                            <FileDown className="mr-2 h-4 w-4" /> Download Report
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => handleShare(e, match.id)} className="rounded-lg">
                            <Share2 className="mr-2 h-4 w-4" /> Copy Public Link
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive font-semibold rounded-lg">
                                <Trash2 className="mr-2 h-4 w-4" /> Delete Record
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent onClick={(e) => e.stopPropagation()} className="rounded-3xl">
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete match record?</AlertDialogTitle>
                                <AlertDialogDescription>This action cannot be undone and will remove all stats.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMatch(match.id)} className="bg-destructive rounded-full">Delete Permanently</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Main Score Area */}
                  <div className="p-6 md:p-8 space-y-6">
                    {/* Team 1 */}
                    <div className={`flex items-center justify-between group/team ${isWinner1 ? 'text-primary' : ''}`}>
                      <div className="flex items-center gap-4">
                        <div className={`h-12 w-12 relative rounded-xl overflow-hidden border-2 bg-muted shrink-0 transition-transform group-hover/team:scale-105 shadow-sm ${isWinner1 ? 'border-primary/30' : 'border-muted'}`}>
                          {team1 && <Image src={team1.logoUrl} alt="" fill className="object-cover" />}
                        </div>
                        <span className={`text-lg sm:text-xl font-black ${isWinner1 ? '' : 'text-foreground/80'}`}>{team1?.name}</span>
                      </div>
                      <div className="text-right">
                        <div className={`text-2xl sm:text-3xl font-black font-mono leading-none ${isWinner1 ? 'text-primary' : 'text-foreground'}`}>
                          {inning1 ? `${inning1.score}/${inning1.wickets}` : 'Yet to bat'}
                        </div>
                        {inning1 && <div className="text-[11px] text-muted-foreground font-bold font-mono mt-1.5 uppercase tracking-wider">({inning1.overs.toFixed(1)} Ov)</div>}
                      </div>
                    </div>

                    {/* Team 2 */}
                    <div className={`flex items-center justify-between group/team ${isWinner2 ? 'text-primary' : ''}`}>
                      <div className="flex items-center gap-4">
                        <div className={`h-12 w-12 relative rounded-xl overflow-hidden border-2 bg-muted shrink-0 transition-transform group-hover/team:scale-105 shadow-sm ${isWinner2 ? 'border-primary/30' : 'border-muted'}`}>
                          {team2 && <Image src={team2.logoUrl} alt="" fill className="object-cover" />}
                        </div>
                        <span className={`text-lg sm:text-xl font-black ${isWinner2 ? '' : 'text-foreground/80'}`}>{team2?.name}</span>
                      </div>
                      <div className="text-right">
                        <div className={`text-2xl sm:text-3xl font-black font-mono leading-none ${isWinner2 ? 'text-primary' : 'text-foreground'}`}>
                          {inning2 ? `${inning2.score}/${inning2.wickets}` : match.status === 'live' ? 'Batting' : 'Yet to bat'}
                        </div>
                        {inning2 && <div className="text-[11px] text-muted-foreground font-bold font-mono mt-1.5 uppercase tracking-wider">({inning2.overs.toFixed(1)} Ov)</div>}
                      </div>
                    </div>
                  </div>

                  {/* Result Message */}
                  <div className="px-6 py-4 border-t border-muted/50 bg-primary/[0.03] flex items-center justify-between">
                    {match.result ? (
                      <div className="flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-primary" />
                        <span className="text-sm font-black text-primary uppercase tracking-tight">{match.result}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span className="h-2 w-2 bg-destructive rounded-full animate-pulse" />
                        <span className="text-xs font-bold uppercase tracking-widest italic">Match in Progress</span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-4 relative z-20">
                        <Link href={`/matches/${match.id}`} className="text-xs font-black text-primary hover:underline underline-offset-4 decoration-2">
                            FULL SCORECARD
                        </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-32 border-2 border-dashed rounded-[2rem] bg-muted/10 animate-in zoom-in duration-500">
          <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
            <BarChart className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="text-2xl font-bold">No history found</h3>
          <p className="text-sm text-muted-foreground mb-8 max-w-xs mx-auto">Complete matches to build your tournament records and see them here.</p>
          <Button asChild className="shadow-xl shadow-primary/20 rounded-full px-10 h-12">
            <Link href="/matches/new"><PlusCircle className="mr-2 h-5 w-5" /> Start First Match</Link>
          </Button>
        </div>
      )}
    </div>
  );
}