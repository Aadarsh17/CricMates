
'use client';

import { useCollection, useMemoFirebase, useFirestore, useDoc, useUser } from '@/firebase';
import { collection, query, orderBy, doc, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Trash2, Trophy, Loader2 } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { useEffect, useState } from 'react';
import { toast } from '@/hooks/use-toast';

function MatchScoreCard({ match, teams, isUmpire, isMounted }: { match: any, teams: any[], isUmpire: boolean, isMounted: boolean }) {
  const db = useFirestore();
  const [isDeleting, setIsDeleting] = useState(false);

  const inn1Ref = useMemoFirebase(() => doc(db, 'matches', match.id, 'innings', 'inning_1'), [db, match.id]);
  const { data: inn1 } = useDoc(inn1Ref);
  const inn2Ref = useMemoFirebase(() => doc(db, 'matches', match.id, 'innings', 'inning_2'), [db, match.id]);
  const { data: inn2 } = useDoc(inn2Ref);

  const getTeam = (id: string) => teams.find(t => t.id === id);
  const getAbbr = (name: string) => (name || 'UNK').substring(0, 3).toUpperCase();

  const formatDate = (dateString: string) => {
    if (!isMounted || !dateString) return '---';
    return new Date(dateString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  /**
   * ROBUST SEQUENTIAL DEEP DELETE
   * Purges all ball-by-ball records before removing the match.
   */
  const executeDeepDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    toast({ title: "Purging History...", description: "Removing all sub-records for this match." });

    try {
      const innings = ['inning_1', 'inning_2'];
      
      for (const innId of innings) {
        const deliveriesRef = collection(db, 'matches', match.id, 'innings', innId, 'deliveryRecords');
        const deliveriesSnapshot = await getDocs(deliveriesRef);
        
        // Delete all delivery records sequentially to ensure completion
        for (const docSnapshot of deliveriesSnapshot.docs) {
          await deleteDoc(docSnapshot.ref);
        }
        
        // Delete the inning document itself
        await deleteDoc(doc(db, 'matches', match.id, 'innings', innId));
      }

      // Finally delete the match metadata
      await deleteDoc(doc(db, 'matches', match.id));
      
      toast({ title: "Match Deleted", description: "History has been permanently updated." });
    } catch (e: any) {
      console.error("Purge Failed:", e);
      toast({ title: "Deletion Error", description: "Failed to remove all records.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const renderInningRow = (inning: any) => {
    if (!inning) return null;
    const team = getTeam(inning.battingTeamId);
    return (
      <div className="flex justify-between items-center w-full py-2">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 border bg-muted"><AvatarFallback>{getAbbr(team?.name || '')[0]}</AvatarFallback></Avatar>
          <span className="font-black text-lg text-slate-800 tracking-tight">{getAbbr(team?.name || '')}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-black text-2xl text-slate-900">{inning.score}/{inning.wickets}</span>
          <span className="text-sm font-bold text-slate-500">({inning.oversCompleted}.{inning.ballsInCurrentOver || 0})</span>
        </div>
      </div>
    );
  };

  return (
    <Card className="border shadow-sm bg-white overflow-hidden group relative border-l-4 border-l-primary rounded-xl">
      <div className="p-5">
        <div className="flex justify-between items-start mb-3">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(match.matchDate)}</span>
            <div className="text-xs font-black text-primary mt-1">{match.resultDescription}</div>
          </div>
          {isUmpire && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-destructive" disabled={isDeleting}>
                  {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Match Permanently?</AlertDialogTitle><AlertDialogDescription>This will purge the match and <strong>ALL associated history records</strong>. Global rankings will update instantly.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={executeDeepDelete} className="bg-destructive">Confirm Purge</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        <div className="space-y-1 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
          {renderInningRow(inn1)}
          {renderInningRow(inn2)}
        </div>

        <div className="flex gap-2 mt-4">
          <Button asChild className="flex-1 bg-primary font-bold h-10 shadow-sm"><Link href={`/match/${match.id}`}>Scorecard</Link></Button>
          {match.status === 'completed' && (
            <Button asChild variant="outline" className="flex-1 border-secondary text-secondary font-black uppercase text-[10px] h-10"><Link href={`/match/new?t1=${match.team1Id}&t2=${match.team2Id}&overs=${match.totalOvers}`}>Play Again</Link></Button>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function MatchHistoryPage() {
  const { isUmpire } = useApp();
  const db = useFirestore();
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  const matchesQuery = useMemoFirebase(() => query(collection(db, 'matches'), orderBy('matchDate', 'desc')), [db]);
  const { data: matches, isLoading: isMatchesLoading } = useCollection(matchesQuery);

  const teamsQuery = useMemoFirebase(() => query(collection(db, 'teams')), [db]);
  const { data: teams = [] } = useCollection(teamsQuery);

  const liveMatches = matches?.filter(m => m.status === 'live') || [];
  const pastMatches = matches?.filter(m => m.status === 'completed') || [];

  if (!isMounted) return null;

  return (
    <div className="space-y-6 max-w-lg mx-auto pb-24">
      <h1 className="text-3xl font-black font-headline tracking-tight text-slate-900">Match History</h1>
      <Tabs defaultValue="past" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6 h-12 bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="live" className="font-bold data-[state=active]:bg-white data-[state=active]:text-primary rounded-lg">Live</TabsTrigger>
          <TabsTrigger value="past" className="font-bold data-[state=active]:bg-white rounded-lg">Completed</TabsTrigger>
        </TabsList>
        <TabsContent value="live" className="space-y-4">
          {isMatchesLoading ? (
             <div className="py-20 text-center animate-pulse font-black uppercase text-[10px] text-slate-400 tracking-widest">Loading Live Matches...</div>
          ) : liveMatches.length > 0 ? (
            liveMatches.map(match => <MatchScoreCard key={match.id} match={match} teams={teams} isUmpire={isUmpire} isMounted={isMounted} />)
          ) : (
            <div className="py-20 text-center border-2 border-dashed rounded-2xl bg-slate-50/50">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No live matches at the moment</p>
            </div>
          )}
        </TabsContent>
        <TabsContent value="past" className="space-y-4">
          {isMatchesLoading ? (
             <div className="py-20 text-center animate-pulse font-black uppercase text-[10px] text-slate-400 tracking-widest">Syncing History...</div>
          ) : pastMatches.length > 0 ? (
            pastMatches.map(match => <MatchScoreCard key={match.id} match={match} teams={teams} isUmpire={isUmpire} isMounted={isMounted} />)
          ) : (
            <div className="py-20 text-center border-2 border-dashed rounded-2xl bg-slate-50/50">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No completed matches found</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
