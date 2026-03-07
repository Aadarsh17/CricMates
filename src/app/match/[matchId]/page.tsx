
"use client"

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useMemoFirebase, useFirestore, useCollection, updateDocumentNonBlocking, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Trash2, Loader2, Zap, PlayCircle, History, ChevronRight, List, Undo2, ArrowLeftRight, ShieldCheck, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, AreaChart, Area, BarChart as ReBarChart, Bar } from "recharts";
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useApp } from '@/context/AppContext';
import { getExtendedInningStats } from '@/lib/report-utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export default function MatchScoreboardPage() {
  const params = useParams();
  const matchId = params.matchId as string;
  const db = useFirestore();
  const { isUmpire } = useApp();
  const [isMounted, setIsMounted] = useState(false);
  const [isWicketDialogOpen, setIsWicketDialogOpen] = useState(false);
  const [isPlayerAssignmentOpen, setIsPlayerAssignmentOpen] = useState(false);
  const liveRef = useRef<HTMLDivElement>(null);
  const scorecardRef = useRef<HTMLDivElement>(null);
  const analyticsRef = useRef<HTMLDivElement>(null);
  const oversRef = useRef<HTMLDivElement>(null);

  const [wicketForm, setWicketForm] = useState({ type: 'bowled', batterOutId: '', fielderId: 'none' });
  const [assignmentForm, setAssignmentForm] = useState({ strikerId: '', nonStrikerId: '', bowlerId: '' });

  useEffect(() => { setIsMounted(true); }, []);

  const matchRef = useMemoFirebase(() => doc(db, 'matches', matchId), [db, matchId]);
  const { data: match, isLoading: isMatchLoading } = useDoc(matchRef);
  const inn1Ref = useMemoFirebase(() => doc(db, 'matches', matchId, 'innings', 'inning_1'), [db, matchId]);
  const { data: inn1 } = useDoc(inn1Ref);
  const inn2Ref = useMemoFirebase(() => doc(db, 'matches', matchId, 'innings', 'inning_2'), [db, matchId]);
  const { data: inn2 } = useDoc(inn2Ref);

  const inn1DeliveriesQuery = useMemoFirebase(() => query(collection(db, 'matches', matchId, 'innings', 'inning_1', 'deliveryRecords'), orderBy('timestamp', 'asc')), [db, matchId]);
  const { data: inn1Deliveries } = useCollection(inn1DeliveriesQuery);
  const inn2DeliveriesQuery = useMemoFirebase(() => query(collection(db, 'matches', matchId, 'innings', 'inning_2', 'deliveryRecords'), orderBy('timestamp', 'asc')), [db, matchId]);
  const { data: inn2Deliveries } = useCollection(inn2DeliveriesQuery);

  const allPlayersQuery = useMemoFirebase(() => query(collection(db, 'players'), orderBy('name', 'asc')), [db]);
  const { data: allPlayers } = useCollection(allPlayersQuery);
  const allTeamsQuery = useMemoFirebase(() => query(collection(db, 'teams')), [db]);
  const { data: allTeams } = useCollection(allTeamsQuery);

  const stats1 = useMemo(() => getExtendedInningStats(inn1Deliveries || []), [inn1Deliveries]);
  const stats2 = useMemo(() => getExtendedInningStats(inn2Deliveries || []), [inn2Deliveries]);

  const activeInningData = useMemo(() => {
    if (!match) return null;
    return match.currentInningNumber === 1 ? inn1 : (match.currentInningNumber === 2 ? inn2 : null);
  }, [match?.currentInningNumber, inn1, inn2]);

  const currentStats = match?.currentInningNumber === 1 ? stats1 : stats2;
  const currentDeliveries = match?.currentInningNumber === 1 ? inn1Deliveries : inn2Deliveries;

  const getPlayerName = (pid: string) => allPlayers?.find(p => p.id === pid)?.name || '---';
  const getTeamName = (tid: string) => allTeams?.find(t => t.id === tid)?.name || '---';

  const recalculateInningState = async (inningId: string) => {
    const deliveriesRef = collection(db, 'matches', matchId, 'innings', inningId, 'deliveryRecords');
    const snap = await getDocs(query(deliveriesRef, orderBy('timestamp', 'asc')));
    const deliveries = snap.docs.map(d => d.data());
    let score = 0, wkts = 0, legal = 0;
    deliveries.forEach(d => { score += d.totalRunsOnDelivery; if (d.isWicket && d.dismissalType !== 'retired') wkts++; if (d.extraType === 'none' || d.extraType === 'bye' || d.extraType === 'legbye') legal++; });
    const last = deliveries[deliveries.length - 1];
    const updates: any = { score, wickets: wkts, oversCompleted: Math.floor(legal / 6), ballsInCurrentOver: legal % 6 };
    if (last) { updates.strikerPlayerId = last.strikerPlayerId; updates.nonStrikerPlayerId = last.nonStrikerPlayerId; updates.currentBowlerPlayerId = last.bowlerId; }
    updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', inningId), updates);
  };

  const handleRecordBall = async (runs: number, extra: 'none' | 'wide' | 'noball' | 'bye' | 'legbye' = 'none') => {
    if (!match || !activeInningData || !isUmpire || !activeInningData.currentBowlerPlayerId) {
      if (!activeInningData?.currentBowlerPlayerId) { setAssignmentForm({ strikerId: activeInningData?.strikerPlayerId || '', nonStrikerId: activeInningData?.nonStrikerPlayerId || '', bowlerId: '' }); setIsPlayerAssignmentOpen(true); }
      return;
    }
    const currentInningId = `inning_${match.currentInningNumber}`;
    const isLegal = extra === 'none' || extra === 'bye' || extra === 'legbye';
    const totalLegal = (currentDeliveries?.filter(d => d.extraType === 'none' || d.extraType === 'bye' || d.extraType === 'legbye').length || 0) + (isLegal ? 1 : 0);
    
    if (totalLegal > match.totalOvers * 6) { toast({ title: "Over Limit Reached" }); return; }

    let bR = runs, eR = 0;
    if (extra === 'wide') { eR = runs + 1; bR = 0; } else if (extra === 'noball') { eR = 1; bR = runs; } else if (extra === 'bye' || extra === 'legbye') { eR = runs; bR = 0; }
    
    const deliveryId = doc(collection(db, 'temp')).id;
    const dData = { id: deliveryId, overNumber: Math.floor((totalLegal - 1) / 6), ballNumberInOver: ((totalLegal - 1) % 6) + 1, strikerPlayerId: activeInningData.strikerPlayerId, nonStrikerPlayerId: activeInningData.nonStrikerPlayerId || 'none', bowlerId: activeInningData.currentBowlerPlayerId, runsScored: bR, extraRuns: eR, extraType: extra, totalRunsOnDelivery: bR + eR, isWicket: false, timestamp: Date.now() };
    setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords', deliveryId), dData, { merge: true });

    let nextS = activeInningData.strikerPlayerId, nextNS = activeInningData.nonStrikerPlayerId;
    if (runs % 2 !== 0) [nextS, nextNS] = [nextNS, nextS];
    if (totalLegal % 6 === 0 && isLegal) [nextS, nextNS] = [nextNS, nextS];

    const updates: any = { score: activeInningData.score + bR + eR, oversCompleted: Math.floor(totalLegal / 6), ballsInCurrentOver: totalLegal % 6, strikerPlayerId: nextS, nonStrikerPlayerId: nextNS };
    if (totalLegal % 6 === 0 && isLegal) updates.currentBowlerPlayerId = '';
    if (totalLegal >= match.totalOvers * 6) updates.isDeclaredFinished = true;
    updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currentInningId), updates);
  };

  const handleSwap = () => {
    if (!isUmpire || !activeInningData) return;
    updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match.currentInningNumber}`), { 
      strikerPlayerId: activeInningData.nonStrikerPlayerId,
      nonStrikerPlayerId: activeInningData.strikerPlayerId 
    });
    toast({ title: "Striker Swapped" });
  };

  if (!isMounted || isMatchLoading) return <div className="flex flex-col items-center justify-center min-h-screen"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 max-w-lg mx-auto pb-32 px-4 relative">
      <div className="fixed top-16 left-0 right-0 z-[90] bg-slate-950 text-white shadow-2xl px-6 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3"><span className="font-black uppercase">{getTeamName(match?.team1Id).substring(0,3)}</span><span className="font-black text-primary">{inn1?.score}/{inn1?.wickets}</span></div>
            <div className="flex items-center gap-3"><span className="font-black uppercase">{getTeamName(match?.team2Id).substring(0,3)}</span><span className="font-black text-secondary">{inn2?.score}/{inn2?.wickets}</span></div>
          </div>
          <div className="text-right">
            <Badge variant="destructive" className="animate-pulse text-[8px] h-4">{match?.status === 'completed' ? 'FINAL' : 'LIVE'}</Badge>
            <p className="text-[10px] font-bold text-slate-500 uppercase">{activeInningData?.oversCompleted}.{activeInningData?.ballsInCurrentOver} / {match?.totalOvers} OV</p>
          </div>
        </div>
      </div>

      <div className="pt-24 space-y-6">
        {isUmpire && !activeInningData?.isDeclaredFinished && match?.status !== 'completed' && (
          <Card className="bg-slate-950 border-none rounded-3xl overflow-hidden">
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-4 gap-2">
                {[0, 1, 2, 3, 4, 6].map(r => (
                  <Button key={r} onClick={() => handleRecordBall(r)} className={cn("h-14 font-black text-2xl rounded-2xl", r >= 4 ? "bg-primary text-white" : "bg-white/10 text-white")}>{r || '•'}</Button>
                ))}
                <Button onClick={handleSwap} className="bg-secondary text-white h-14 font-black rounded-2xl flex flex-col items-center justify-center"><ArrowLeftRight className="w-5 h-5"/><span className="text-[8px] uppercase">Swap</span></Button>
                <Button variant="outline" onClick={() => { setWicketForm({...wicketForm, batterOutId: activeInningData?.strikerPlayerId || ''}); setIsWicketDialogOpen(true); }} className="h-14 border-red-500/50 text-red-500 font-black rounded-2xl uppercase text-[10px]">Wicket</Button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Button variant="outline" onClick={() => handleRecordBall(0, 'wide')} className="h-12 text-amber-500 uppercase text-[10px]">Wide</Button>
                <Button variant="outline" onClick={() => handleRecordBall(0, 'noball')} className="h-12 text-amber-500 uppercase text-[10px]">No Ball</Button>
                <Button variant="outline" onClick={() => { if(confirm('Undo last ball?')) { const currentInningId = `inning_${match.currentInningNumber}`; getDocs(query(collection(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords'), orderBy('timestamp', 'desc'), limit(1))).then(s => { if(!s.empty) { deleteDocumentNonBlocking(s.docs[0].ref); recalculateInningState(currentInningId); } }); } }} className="h-12 text-slate-400 uppercase text-[10px]">Undo</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-4">
          {[
            { id: activeInningData?.strikerPlayerId, label: 'Striker', active: true },
            { id: activeInningData?.nonStrikerPlayerId, label: 'Non-Striker', active: false }
          ].map((batter, i) => {
            const stats = currentStats.batting.find(b => b.id === batter.id);
            return (
              <Card key={i} className={cn("border-2 rounded-2xl", batter.active ? "border-primary bg-primary/5" : "opacity-70")}>
                <CardContent className="p-4 flex justify-between items-center">
                  <div className="min-w-0"><p className="text-[10px] font-black uppercase text-slate-400">{batter.label}</p><p className="font-black text-lg uppercase truncate">{getPlayerName(batter.id || '')}</p></div>
                  <div className="flex gap-4 text-right">
                    <div><p className="text-xl font-black">{stats?.runs || 0}</p><p className="text-[8px] text-slate-400">R</p></div>
                    <div><p className="text-xl font-black">{stats?.balls || 0}</p><p className="text-[8px] text-slate-400">B</p></div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div ref={oversRef} className="space-y-4">
          <h2 className="text-xl font-black uppercase flex items-center gap-2 px-2"><History className="w-5 h-5 text-primary" /> Ball Log</h2>
          {['inning_1', 'inning_2'].map(innId => {
            const deliveries = innId === 'inning_1' ? inn1Deliveries : inn2Deliveries;
            return (
              <div key={innId} className="space-y-2">
                <p className="text-[10px] font-black uppercase text-slate-400 px-2">{innId.replace('_', ' ')}</p>
                <Card className="border-none shadow-lg overflow-hidden bg-white rounded-2xl">
                  {deliveries?.slice().reverse().map(d => (
                    <div key={d.id} className="flex items-center justify-between p-4 border-b last:border-none">
                      <div className="flex items-center gap-4"><span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-1 rounded">{d.overNumber}.{d.ballNumberInOver}</span><div><p className="font-black text-xs uppercase">{getPlayerName(d.strikerPlayerId)}</p><p className="text-[8px] text-slate-400 italic">b {getPlayerName(d.bowlerId)}</p></div></div>
                      <Badge className={cn("h-8 w-8 rounded-lg flex items-center justify-center font-black p-0", d.isWicket ? "bg-red-500" : d.runsScored >= 4 ? "bg-primary" : "bg-slate-50 text-slate-600")}>{d.isWicket ? "W" : d.totalRunsOnDelivery}</Badge>
                    </div>
                  ))}
                </Card>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={isPlayerAssignmentOpen} onOpenChange={setIsPlayerAssignmentOpen}>
        <DialogContent className="max-w-[90vw] rounded-3xl">
          <DialogHeader><DialogTitle className="font-black uppercase">Assign New Bowler</DialogTitle><DialogDescription className="text-xs">Active batters are filtered out.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <Select value={assignmentForm.bowlerId} onValueChange={(v) => setAssignmentForm({...assignmentForm, bowlerId: v})}>
              <SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Select Bowler" /></SelectTrigger>
              <SelectContent>
                {allPlayers?.filter(p => (match?.team1Id === activeInningData?.bowlingTeamId ? match?.team1SquadPlayerIds : match?.team2SquadPlayerIds)?.includes(p.id) && p.id !== activeInningData?.strikerPlayerId && p.id !== activeInningData?.nonStrikerPlayerId).map(p => (<SelectItem key={p.id} value={p.id} className="font-bold">{p.name}</SelectItem>))}
              </SelectContent>
            </Select>
            <Button variant="outline" className="w-full text-[10px] font-black uppercase h-10" onClick={() => recalculateInningState(`inning_${match?.currentInningNumber}`)}><RefreshCw className="w-3 h-3 mr-2" /> Force Sync Score</Button>
          </div>
          <DialogFooter><Button onClick={() => { updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match?.currentInningNumber}`), { currentBowlerPlayerId: assignmentForm.bowlerId }); setIsPlayerAssignmentOpen(false); }} className="w-full h-14 bg-primary text-white font-black uppercase rounded-2xl shadow-lg">Start Over</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
