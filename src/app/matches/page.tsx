
'use client';

import { useCollection, useMemoFirebase, useFirestore, useDoc, useUser } from '@/firebase';
import { collection, query, orderBy, doc, getDocs, deleteDoc } from 'firebase/firestore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Trash2, Trophy, Loader2, ChevronLeft, Hash, RotateCcw } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { useEffect, useState, useMemo } from 'react';
import { toast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { formatTeamName } from '@/lib/utils';

function MatchScoreCard({ match, teams, isUmpire, isMounted }: { match: any, teams: any[], isUmpire: boolean, isMounted: boolean }) {
  const db = useFirestore();
  const [isDeleting, setIsDeleting] = useState(false);

  const inn1Ref = useMemoFirebase(() => doc(db, 'matches', match.id, 'innings', 'inning_1'), [db, match.id]);
  const { data: inn1 } = useDoc(inn1Ref);
  const inn2Ref = useMemoFirebase(() => doc(db, 'matches', match.id, 'innings', 'inning_2'), [db, match.id]);
  const { data: inn2 } = useDoc(inn2Ref);

  const getTeam = (id: string) => (teams || []).find(t => t.id === id);

  const formatDate = (dateString: string) => {
    if (!isMounted || !dateString) return '---';
    try {
      return new Date(dateString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
      return '---';
    }
  };

  const executeDeepDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    toast({ title: "Purging History...", description: "Removing all sub-records." });
    try {
      const innings = ['inning_1', 'inning_2'];
      for (const innId of innings) {
        const delRef = collection(db, 'matches', match.id, 'innings', innId, 'deliveryRecords');
        const snap = await getDocs(delRef);
        for (const d of snap.docs) await deleteDoc(d.ref);
        await deleteDoc(doc(db, 'matches', match.id, 'innings', innId));
      }
      await deleteDoc(doc(db, 'matches', match.id));
      toast({ title: "Match Purged" });
    } catch (e) {
      toast({ title: "Deletion Error", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const renderInningRow = (innData: any, fallbackTeamId: string) => {
    const teamId = innData?.battingTeamId || fallbackTeamId;
    const team = getTeam(teamId);
    return (
      <div className="flex justify-between items-center w-full py-2 border-b border-slate-100 last:border-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Avatar className="h-8 w-8 border bg-muted shrink-0"><AvatarFallback>{team?.name?.[0] || '?'}</AvatarFallback></Avatar>
          <Link href={`/teams/${teamId}`} className="font-black text-sm text-slate-800 tracking-tight hover:text-primary truncate">{team ? formatTeamName(team.name) : 'Syncing...'}</Link>
        </div>
        <div className="flex items-baseline gap-2 shrink-0 ml-4">
          {innData ? (<><span className="font-black text-xl text-slate-900">{innData.score}/{innData.wickets}</span><span className="text-[10px] font-bold text-slate-500">({innData.oversCompleted}.{innData.ballsInCurrentOver || 0})</span></>) : (<span className="text-[10px] font-bold text-slate-300 uppercase animate-pulse">Wait...</span>)}
        </div>
      </div>
    );
  };

  const row1TeamId = inn1?.battingTeamId || match.team1Id;
  const row2TeamId = inn2?.battingTeamId || (row1TeamId === match.team1Id ? match.team2Id : match.team1Id);

  return (
    <Card className="border shadow-sm bg-white overflow-hidden border-l-4 border-l-primary rounded-xl">
      <div className="p-5">
        <div className="flex justify-between items-start mb-3">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-3">
              <span className="flex items-center gap-1 text-primary"><Hash className="w-3 h-3"/> {match.matchNumber || 'Match X'}</span>
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(match.matchDate)}</span>
            </span>
            <div className="text-sm font-black text-primary mt-1">{match.resultDescription || 'Match Record'}</div>
          </div>
          {isUmpire && (
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-destructive" disabled={isDeleting}>{isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}</Button></AlertDialogTrigger>
              <AlertDialogContent className="z-[200]">
                <AlertDialogHeader><AlertDialogTitle>Purge Records?</AlertDialogTitle><AlertDialogDescription>This will delete the match and all associated player statistics instantly.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={executeDeepDelete} className="bg-destructive">Confirm</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
        <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">{renderInningRow(inn1, row1TeamId)}{renderInningRow(inn2, row2TeamId)}</div>
        <div className="flex gap-2 mt-4">
          <Button asChild className="flex-1 bg-primary font-bold h-10 shadow-sm">
            <Link href={`/match/${match.id}`}>Scorecard</Link>
          </Button>
          {isUmpire && match.status === 'completed' && (
            <Button asChild variant="outline" className="flex-1 font-black h-10 border-primary text-primary hover:bg-primary/5 uppercase text-[9px]">
              <Link href={`/match/new?t1=${match.team1Id}&t2=${match.team2Id}&overs=${match.totalOvers}&mNum=${encodeURIComponent(match.matchNumber || '')}`}>
                <RotateCcw className="w-3 h-3 mr-1" /> Play Again
              </Link>
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function MatchHistoryPage() {
  const { isUmpire } = useApp();
  const db = useFirestore();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  const matchesQuery = useMemoFirebase(() => query(collection(db, 'matches'), orderBy('matchDate', 'desc')), [db]);
  const { data: matches, isLoading: isMatchesLoading } = useCollection(matchesQuery);
  const teamsQuery = useMemoFirebase(() => query(collection(db, 'teams')), [db]);
  const { data: rawTeams } = useCollection(teamsQuery);
  const teams = rawTeams || [];

  if (!isMounted) return null;

  const liveMatches = matches?.filter(m => m.status === 'live') || [];
  const pastMatches = matches?.filter(m => m.status === 'completed') || [];

  return (
    <div className="space-y-6 max-w-lg mx-auto pb-24 px-4">
      <div className="flex items-center gap-4"><Button variant="ghost" size="icon" onClick={() => router.push('/')} className="rounded-full"><ChevronLeft className="w-6 h-6" /></Button><h1 className="text-3xl font-black font-headline tracking-tight text-slate-900 uppercase">Match History</h1></div>
      <Tabs defaultValue="past" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6 h-12 bg-slate-100 p-1 rounded-xl"><TabsTrigger value="live" className="font-bold">Live</TabsTrigger><TabsTrigger value="past" className="font-bold">Completed</TabsTrigger></TabsList>
        <TabsContent value="live" className="space-y-4">{isMatchesLoading ? <Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" /> : liveMatches.map(m => <MatchScoreCard key={m.id} match={m} teams={teams} isUmpire={isUmpire} isMounted={isMounted} />)}</TabsContent>
        <TabsContent value="past" className="space-y-4">{isMatchesLoading ? <Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" /> : pastMatches.map(m => <MatchScoreCard key={m.id} match={m} teams={teams} isUmpire={isUmpire} isMounted={isMounted} />)}</TabsContent>
      </Tabs>
    </div>
  );
}
