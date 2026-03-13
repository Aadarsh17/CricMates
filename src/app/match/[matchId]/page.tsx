"use client"

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDoc, useMemoFirebase, useFirestore, useCollection, setDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, orderBy, limit, getDocs, writeBatch } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { History, Loader2, ArrowLeftRight, ShieldCheck, CheckCircle2, Settings2, Rewind, Download, Edit2, PlusCircle, Filter, Calendar, UserCheck, MapPin, Hash, ChevronLeft, Trash2, Share2, Star, Zap, Swords, Trophy, Target, Crown, Users, UserPlus, Undo2, RotateCcw, AlertTriangle, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn, formatTeamName } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useApp } from '@/context/AppContext';
import { getExtendedInningStats, generateMatchReport } from '@/lib/report-utils';
import { calculatePlayerCVP } from '@/lib/cvp-utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, LineChart, Line } from 'recharts';
import { toPng } from 'html-to-image';

export default function MatchScoreboardPage() {
  const params = useParams();
  const matchId = params.matchId as string;
  const db = useFirestore();
  const router = useRouter();
  const { isUmpire } = useApp();
  const [isMounted, setIsMounted] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);
  const [isSharing, setIsSharing] = useState(false);
  
  const [isWicketDialogOpen, setIsWicketDialogOpen] = useState(false);
  const [isNoBallDialogOpen, setIsNoBallDialogOpen] = useState(false);
  const [isPlayerAssignmentOpen, setIsPlayerAssignmentOpen] = useState(false);
  const [isCorrectionDialogOpen, setIsCorrectionDialogOpen] = useState(false);
  const [isMatchDetailsDialogOpen, setIsMatchDetailsDialogOpen] = useState(false);
  const [isPotmDialogOpen, setIsPotmDialogOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isRepairOpen, setIsRepairOpen] = useState(false);
  
  const [assignmentForm, setAssignmentForm] = useState({ strikerId: '', nonStrikerId: '', bowlerId: '' });
  const [wicketForm, setWicketForm] = useState({ type: 'bowled', batterOutId: '', extraType: 'none', runsCompleted: 0, fielderId: 'none', successorId: '' });
  const [correctionForm, setCorrectionForm] = useState<any>({ id: '', strikerId: '', nonStrikerId: '', bowlerId: '', runs: 0, extra: 'none', isWicket: false, wicketType: 'bowled', timestamp: 0, targetInning: '', isDeclared: false });
  const [matchDateForm, setMatchDateForm] = useState('');
  const [venueForm, setVenueForm] = useState('');
  const [matchNumberForm, setMatchNumberForm] = useState('');
  const [potmId, setPotmId] = useState('');
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddTeamId, setQuickAddTeamId] = useState('');
  
  const [repairTargetId, setRepairTargetId] = useState<string>('');
  const [replacementPlayerId, setReplacementPlayerId] = useState<string>('');
  const [isRepairing, setIsRepairing] = useState(false);

  const [selectedOverFilter, setSelectedOverFilter] = useState<string>('all');

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

  useEffect(() => {
    if (match?.matchDate) setMatchDateForm(match.matchDate.substring(0, 16));
    if (match?.venue) setVenueForm(match.venue);
    if (match?.matchNumber) setMatchNumberForm(match.matchNumber);
    if (match?.potmPlayerId) setPotmId(match.potmPlayerId);
  }, [match]);

  const processDeliveriesWithLabels = (deliveries: any[] | null) => {
    if (!deliveries) return [];
    const sorted = [...deliveries].sort((a, b) => (a.timestamp - b.timestamp) || a.id.localeCompare(b.id));
    let legal = 0;
    return sorted.map(d => {
      const isLegal = d.extraType === 'none' && d.dismissalType !== 'retired';
      const ov = Math.floor(legal / 6);
      const b = (legal % 6) + 1;
      const label = isLegal ? `${ov}.${b}` : (d.dismissalType === 'retired' ? 'RET' : '---');
      if (isLegal) legal++;
      return { ...d, ballLabel: label, overIndex: ov + 1 };
    });
  };

  const inn1WithLabels = useMemo(() => processDeliveriesWithLabels(inn1Deliveries), [inn1Deliveries]);
  const inn2WithLabels = useMemo(() => processDeliveriesWithLabels(inn2Deliveries), [inn2Deliveries]);

  const stats1 = useMemo(() => {
    const batTeamId = inn1?.battingTeamId || match?.team1Id;
    const squad = batTeamId === match?.team1Id ? match?.team1SquadPlayerIds : match?.team2SquadPlayerIds;
    return getExtendedInningStats(inn1Deliveries || [], squad || []);
  }, [inn1Deliveries, inn1?.battingTeamId, match]);

  const stats2 = useMemo(() => {
    const batTeamId = inn2?.battingTeamId || (match?.team1Id === inn1?.battingTeamId ? match?.team2Id : match?.team1Id);
    const squad = batTeamId === match?.team1Id ? match?.team1SquadPlayerIds : match?.team2SquadPlayerIds;
    return getExtendedInningStats(inn2Deliveries || [], squad || []);
  }, [inn2Deliveries, inn2?.battingTeamId, inn1?.battingTeamId, match]);

  const getPlayerName = (pid: string) => {
    if (!pid || pid === 'none') return '---';
    const p = allPlayers?.find(p => p.id === pid);
    if (!p) return '---';
    return p.name;
  };

  const getTeamName = (tid: string) => {
    const t = allTeams?.find(t => t.id === tid);
    return t ? formatTeamName(t.name) : '---';
  };

  const activeInningData = useMemo(() => {
    if (!match) return null;
    return match.currentInningNumber === 1 ? inn1 : (match.currentInningNumber === 2 ? inn2 : null);
  }, [match?.currentInningNumber, inn1, inn2]);

  const currentDeliveriesWithLabels = match?.currentInningNumber === 1 ? inn1WithLabels : inn2WithLabels;

  const groupedByOver = useMemo(() => {
    if (!currentDeliveriesWithLabels) return [];
    const groups: Record<number, any[]> = {};
    currentDeliveriesWithLabels.forEach(d => {
      const overIdx = d.overIndex;
      if (!groups[overIdx]) groups[overIdx] = [];
      groups[overIdx].push(d);
    });
    return Object.entries(groups).sort((a, b) => Number(b[0]) - Number(a[0]));
  }, [currentDeliveriesWithLabels]);

  const handleShareImage = async () => {
    if (!shareCardRef.current) return;
    setIsSharing(true);
    try {
      const dataUrl = await toPng(shareCardRef.current, { cacheBust: true, pixelRatio: 2, backgroundColor: '#f8fafc' });
      const link = document.createElement('a'); link.download = `CricMates_${match?.matchNumber || 'Match'}_${Date.now()}.png`; link.href = dataUrl; link.click();
      toast({ title: "Image Ready", description: "HD Share Card saved." });
    } catch (err) { toast({ title: "Sharing Error", variant: "destructive" }); } finally { setIsSharing(false); }
  };

  const recalculateInningState = async (inningId: string) => {
    const deliveriesRef = collection(db, 'matches', matchId, 'innings', inningId, 'deliveryRecords');
    const snap = await getDocs(query(deliveriesRef, orderBy('timestamp', 'asc')));
    const deliveriesList = snap.docs.map(d => d.data()).sort((a,b) => (a.timestamp - b.timestamp) || a.id.localeCompare(b.id));
    let score = 0, wkts = 0, legal = 0, sId = '', nsId = '';
    deliveriesList.forEach((d, idx) => {
      score += (d.totalRunsOnDelivery || 0);
      if (d.isWicket && d.dismissalType !== 'retired') wkts++;
      if (d.extraType === 'none' && d.dismissalType !== 'retired') legal++;
      if (idx === deliveriesList.length - 1) {
        sId = d.strikerPlayerId; nsId = d.nonStrikerPlayerId;
        if (nsId && !d.isDeclared && (d.runsScored || 0) % 2 !== 0) [sId, nsId] = [nsId, sId];
        if (nsId && legal % 6 === 0 && d.extraType === 'none') [sId, nsId] = [nsId, sId];
        if (d.isWicket) { const outPid = d.batsmanOutPlayerId || d.strikerPlayerId; if (outPid === sId) sId = d.successorPlayerId || ''; else if (outPid === nsId) nsId = d.successorPlayerId || ''; }
      }
    });
    const updates: any = { score, wickets: wkts, oversCompleted: Math.floor(legal / 6), ballsInCurrentOver: legal % 6, strikerPlayerId: sId || '', nonStrikerPlayerId: nsId || '', isDeclaredFinished: false };
    if (legal % 6 === 0 && legal > 0) updates.currentBowlerPlayerId = '';
    await setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', inningId), updates, { merge: true });
  };

  const handleRepairMatchData = async () => {
    if (!repairTargetId || !replacementPlayerId) return;
    setIsRepairing(true);
    try {
      const batch = writeBatch(db); const innings = ['inning_1', 'inning_2'];
      for (const innId of innings) {
        const deliveriesRef = collection(db, 'matches', matchId, 'innings', innId, 'deliveryRecords');
        const snap = await getDocs(deliveriesRef);
        snap.docs.forEach(docSnap => {
          const d = docSnap.data(); const updates: any = {};
          if (d.strikerPlayerId === repairTargetId) updates.strikerPlayerId = replacementPlayerId;
          if (d.nonStrikerPlayerId === repairTargetId) updates.nonStrikerPlayerId = replacementPlayerId;
          if (d.bowlerId === repairTargetId || d.bowlerPlayerId === repairTargetId) { updates.bowlerId = replacementPlayerId; updates.bowlerPlayerId = replacementPlayerId; }
          if (d.batsmanOutPlayerId === repairTargetId) updates.batsmanOutPlayerId = replacementPlayerId;
          if (d.fielderPlayerId === repairTargetId) updates.fielderPlayerId = replacementPlayerId;
          if (d.successorPlayerId === repairTargetId) updates.successorPlayerId = replacementPlayerId;
          if (Object.keys(updates).length > 0) batch.update(docSnap.ref, updates);
        });
      }
      await batch.commit();
      const matchUpdates: any = {};
      if (match?.team1SquadPlayerIds?.includes(repairTargetId)) matchUpdates.team1SquadPlayerIds = match.team1SquadPlayerIds.map((id: string) => id === repairTargetId ? replacementPlayerId : id);
      if (match?.team2SquadPlayerIds?.includes(repairTargetId)) matchUpdates.team2SquadPlayerIds = match.team2SquadPlayerIds.map((id: string) => id === repairTargetId ? replacementPlayerId : id);
      if (match?.potmPlayerId === repairTargetId) matchUpdates.potmPlayerId = replacementPlayerId;
      if (Object.keys(matchUpdates).length > 0) await updateDocumentNonBlocking(doc(db, 'matches', matchId), matchUpdates);
      await recalculateInningState('inning_1'); await recalculateInningState('inning_2');
      toast({ title: "Repair Complete" }); setIsRepairOpen(false);
    } catch (e) { toast({ title: "Repair Failed", variant: "destructive" }); } finally { setIsRepairing(false); }
  };

  const handleFinalizeMatch = async () => {
    const s1 = stats1.total; const s2 = stats2.total; const w2 = stats2.wickets;
    const bat1Id = inn1?.battingTeamId || match?.team1Id;
    const bat2Id = inn2?.battingTeamId || (bat1Id === match?.team1Id ? match?.team2Id : match?.team1Id);
    let result = "Match Completed"; let winnerId = ""; let isTie = false;
    if (s1 > s2) { winnerId = bat1Id; result = `${getTeamName(bat1Id || '')} won by ${s1 - s2} runs`; }
    else if (s2 > s1) { winnerId = bat2Id; const wLeft = Math.max(0, (match?.team2SquadPlayerIds?.length || 11) - 1 - w2); result = `${getTeamName(bat2Id || '')} won by ${wLeft} wickets`; }
    else { isTie = true; result = "Match Tied"; }
    await setDocumentNonBlocking(doc(db, 'matches', matchId), { status: 'completed', resultDescription: result, winnerTeamId: winnerId || 'none', isTie: isTie }, { merge: true });
    toast({ title: "Match Finalized", description: result });
  };

  const handleRecordBall = async (runs: number, extra: any = 'none', isDeclared: boolean = false) => {
    if (!match || !activeInningData || !isUmpire || !activeInningData.currentBowlerPlayerId) return;
    const currentInningId = `inning_${match.currentInningNumber}`;
    const totalLegal = currentDeliveriesWithLabels?.filter(d => d.extraType === 'none' && d.dismissalType !== 'retired').length || 0;
    const newTotalLegal = totalLegal + (extra === 'none' ? 1 : 0);
    const deliveryId = doc(collection(db, 'temp')).id;
    const dData = { id: deliveryId, strikerPlayerId: activeInningData.strikerPlayerId || '', nonStrikerPlayerId: activeInningData.nonStrikerPlayerId || '', bowlerId: activeInningData.currentBowlerPlayerId || '', runsScored: runs, extraType: extra, isDeclared: isDeclared, totalRunsOnDelivery: runs + (extra !== 'none' ? 1 : 0), isWicket: false, timestamp: Date.now() };
    await setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords', deliveryId), dData, { merge: true });
    let nextS = activeInningData.strikerPlayerId, nextNS = activeInningData.nonStrikerPlayerId;
    if (nextNS) { if (!isDeclared && runs % 2 !== 0) [nextS, nextNS] = [nextNS, nextS]; if (newTotalLegal % 6 === 0 && extra === 'none') [nextS, nextNS] = [nextNS, nextS]; }
    const updates: any = { score: activeInningData.score + dData.totalRunsOnDelivery, oversCompleted: Math.floor(newTotalLegal / 6), ballsInCurrentOver: newTotalLegal % 6, strikerPlayerId: nextS || '', nonStrikerPlayerId: nextNS || '' };
    if (newTotalLegal % 6 === 0 && extra === 'none') updates.currentBowlerPlayerId = '';
    if (newTotalLegal >= match.totalOvers * 6) updates.isDeclaredFinished = true;
    await setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currentInningId), updates, { merge: true });
    setIsNoBallDialogOpen(false);
  };

  const matchCvpMap = useMemo(() => {
    if (!isMounted || !allPlayers || (!inn1Deliveries && !inn2Deliveries)) return {};
    const squads = [...(match?.team1SquadPlayerIds || []), ...(match?.team2SquadPlayerIds || [])];
    const map: Record<string, number> = {};
    const allMatchDeliveries = [...(inn1Deliveries || []), ...(inn2Deliveries || [])];
    squads.forEach(pid => {
      const p = allPlayers.find(pl => pl.id === pid); if (!p) return;
      const pStats = { id: pid, name: p.name, runs: 0, ballsFaced: 0, fours: 0, sixes: 0, wickets: 0, maidens: 0, ballsBowled: 0, runsConceded: 0, catches: 0, stumpings: 0, runOuts: 0 };
      allMatchDeliveries.forEach(d => {
        if (d.strikerPlayerId === pid) { pStats.runs += (d.runsScored || 0); if (d.extraType !== 'wide') pStats.ballsFaced++; }
        const bId = d.bowlerId || d.bowlerPlayerId; if (bId === pid) { pStats.runsConceded += (d.totalRunsOnDelivery || 0); if (d.extraType === 'none') pStats.ballsBowled++; if (d.isWicket && !['runout', 'retired'].includes(d.dismissalType || '')) pStats.wickets++; }
        if (d.fielderPlayerId === pid) { if (d.dismissalType === 'caught') pStats.catches++; if (d.dismissalType === 'stumped') pStats.stumpings++; if (d.dismissalType === 'runout') pStats.runOuts++; }
      });
      map[pid] = calculatePlayerCVP(pStats);
    });
    return map;
  }, [inn1Deliveries, inn2Deliveries, match, allPlayers, isMounted]);

  if (!isMounted || isMatchLoading) return <div className="flex flex-col items-center justify-center min-h-screen"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 max-w-lg mx-auto pb-32 relative px-1">
      <div className="fixed top-16 left-0 right-0 z-[90] bg-white text-slate-950 shadow-2xl px-6 py-4 border-b-4 border-slate-300">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/matches')} className="h-8 w-8 shrink-0"><ChevronLeft className="w-6 h-6" /></Button>
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-3"><span className="font-black uppercase text-[11px] text-slate-700 max-w-[120px] tracking-tight">{getTeamName(inn1?.battingTeamId || match?.team1Id)}</span><span className="font-black text-2xl leading-none text-slate-950">{stats1.total}/{stats1.wickets}</span><Badge variant="outline" className="text-[11px] font-black h-6 bg-slate-100 px-2">({stats1.overs})</Badge></div>
            <div className="flex items-center gap-3"><span className="font-black uppercase text-[11px] text-slate-700 max-w-[120px] tracking-tight">{getTeamName(inn2?.battingTeamId || (inn1?.battingTeamId === match?.team1Id ? match?.team2Id : match?.team1Id))}</span><span className="font-black text-2xl leading-none text-slate-950">{stats2.total}/{stats2.wickets}</span><Badge variant="outline" className="text-[11px] font-black h-6 bg-slate-100 px-2">({stats2.overs})</Badge></div>
          </div>
          <div className="text-right flex flex-col items-end gap-1">
            {match?.status === 'live' && <Badge variant="destructive" className="animate-pulse text-[10px] h-6 font-black uppercase px-3 shadow-md border-2 border-white">LIVE</Badge>}
            <button onClick={() => isUmpire && setIsMatchDetailsDialogOpen(true)} className={cn("text-[10px] font-black uppercase tracking-[0.2em]", isUmpire ? "text-primary hover:underline" : "text-slate-400")}>{match?.matchNumber || 'Match X'}</button>
          </div>
        </div>
      </div>

      <div className="pt-32">
        <Tabs defaultValue="live" className="w-full">
          <TabsList className="grid w-full grid-cols-5 h-12 bg-slate-100 p-1 rounded-xl mb-6 sticky top-[120px] z-[80] shadow-sm">
            <TabsTrigger value="live" className="font-black text-[9px] uppercase">Live</TabsTrigger>
            <TabsTrigger value="scorecard" className="font-black text-[9px] uppercase">Score</TabsTrigger>
            <TabsTrigger value="analysis" className="font-black text-[9px] uppercase">Analysis</TabsTrigger>
            <TabsTrigger value="overs" className="font-black text-[9px] uppercase">Overs</TabsTrigger>
            <TabsTrigger value="info" className="font-black text-[9px] uppercase">Info</TabsTrigger>
          </TabsList>

          <TabsContent value="live" className="space-y-6">
            {isUmpire && (
              <div className="flex flex-col gap-4">
                <Card className="bg-slate-900 border-none rounded-3xl overflow-hidden shadow-2xl">
                  <CardContent className="p-6 space-y-6">
                    <div className="flex gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="outline" className="flex-1 h-12 border-primary/20 text-primary font-black uppercase text-[9px] bg-white/5"><ShieldCheck className="w-4 h-4 mr-2" /> Match Actions</Button></DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56 rounded-xl" align="end">
                          <DropdownMenuItem className="font-bold py-3" onClick={async () => { const currId = `inning_${match?.currentInningNumber}`; const snap = await getDocs(query(collection(db, 'matches', matchId, 'innings', currId, 'deliveryRecords'), orderBy('timestamp', 'desc'), limit(1))); if(!snap.empty) { await deleteDocumentNonBlocking(snap.docs[0].ref); await recalculateInningState(currId); toast({ title: "Action Purged (Undo)" }); } }}><Undo2 className="w-4 h-4 mr-2 text-rose-500" /> Undo Action</DropdownMenuItem>
                          <DropdownMenuItem className="font-bold py-3" onClick={() => setIsPotmDialogOpen(true)}><UserCheck className="w-4 h-4 mr-2 text-amber-500" /> Declare POTM</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="font-bold py-3" onClick={handleFinalizeMatch}><ShieldCheck className="w-4 h-4 mr-2 text-emerald-500" /> Finalize Match</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button variant="outline" onClick={() => setIsPlayerAssignmentOpen(true)} className="flex-1 h-12 border-secondary/20 text-secondary font-black uppercase text-[9px] bg-white/5"><Settings2 className="w-4 h-4 mr-2" /> Assign Positions</Button>
                    </div>
                    {match?.status === 'live' && !activeInningData?.isDeclaredFinished && (
                      <div className="grid grid-cols-5 gap-2">
                        {[0, 1, 2, 3, 4, 5, 6].map(r => (<Button key={r} disabled={!activeInningData?.currentBowlerPlayerId} onClick={() => handleRecordBall(r)} className={cn("h-14 font-black text-2xl rounded-2xl", r >= 4 ? "bg-primary text-white" : "bg-white/5 text-white")}>{r === 0 ? '•' : r}</Button>))}
                        <Button disabled={!activeInningData?.currentBowlerPlayerId} onClick={() => handleRecordBall(1, 'none', true)} className="h-14 font-black text-2xl rounded-2xl bg-white/5 text-white">1D</Button>
                        <Button disabled={!activeInningData?.nonStrikerPlayerId} onClick={() => setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match?.currentInningNumber}`), { strikerPlayerId: activeInningData?.nonStrikerPlayerId || '', nonStrikerPlayerId: activeInningData?.strikerPlayerId || '' }, { merge: true })} className="bg-secondary text-white h-14 font-black rounded-2xl"><ArrowLeftRight className="w-5 h-5"/></Button>
                        <Button variant="outline" onClick={() => { setWicketForm({...wicketForm, batterOutId: activeInningData?.strikerPlayerId || '', fielderId: 'none', successorId: ''}); setIsWicketDialogOpen(true); }} className="h-14 border-red-500/30 text-red-500 font-black rounded-2xl uppercase text-[10px] bg-white/5">Wicket</Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
              <Table>
                <TableHeader className="bg-slate-50"><TableRow><TableHead className="text-[9px] font-black uppercase">Live Performance</TableHead><TableHead className="text-right text-[9px] font-black uppercase">R</TableHead><TableHead className="text-right text-[9px] font-black uppercase">B</TableHead><TableHead className="text-right text-[9px] font-black uppercase">SR</TableHead></TableRow></TableHeader>
                <TableBody>{[activeInningData?.strikerPlayerId, activeInningData?.nonStrikerPlayerId].map((pid, idx) => {
                    if (!pid || pid === 'none') return null;
                    const stats = match?.currentInningNumber === 1 ? stats1 : stats2;
                    const b = stats.batting.find((p: any) => p?.id === pid) || { runs: 0, balls: 0 };
                    const name = getPlayerName(pid);
                    return (
                      <TableRow key={pid} className={idx === 0 ? "bg-primary/5" : ""}>
                        <TableCell className="font-black text-xs uppercase py-3 truncate max-w-[140px]">{name}{idx === 0 ? '*' : ''}{name === '---' && isUmpire && (<Button variant="ghost" size="sm" onClick={() => { setRepairTargetId(pid); setIsRepairOpen(true); }} className="h-6 w-6 text-amber-500 p-0 ml-2"><RefreshCw className="w-3 h-3" /></Button>)}</TableCell>
                        <TableCell className="text-right font-black">{b.runs}</TableCell>
                        <TableCell className="text-right text-xs font-bold text-slate-500">{b.balls}</TableCell>
                        <TableCell className="text-right text-[9px] font-bold text-slate-400">{b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0'}</TableCell>
                      </TableRow>
                    );
                  })}</TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="scorecard" className="space-y-8">
            {[ {id: 1, stats: stats1, teamId: inn1?.battingTeamId || match?.team1Id, label: '1st Innings'}, {id: 2, stats: stats2, teamId: inn2?.battingTeamId || (match?.team1Id === (inn1?.battingTeamId || match?.team1Id) ? match?.team2Id : match?.team1Id), label: '2nd Innings'} ].map(inn => (
              <div key={inn.id} className="space-y-4">
                <div className="flex justify-between items-center px-2"><h2 className="text-sm font-black uppercase text-slate-900">{inn.label} - {getTeamName(inn.teamId || '')}</h2><Badge className="bg-primary text-white font-black">{inn.stats.total}/{inn.stats.wickets} ({inn.stats.overs})</Badge></div>
                <Card className="border-none shadow-lg rounded-3xl overflow-hidden bg-white">
                  <Table>
                    <TableHeader className="bg-slate-50"><TableRow><TableHead className="text-[9px] font-black uppercase">Batter</TableHead><TableHead className="text-right text-[9px] font-black uppercase">R</TableHead><TableHead className="text-right text-[9px] font-black uppercase">B</TableHead><TableHead className="text-right text-[9px] font-black uppercase">SR</TableHead></TableRow></TableHeader>
                    <TableBody>{inn.stats.batting.map((b: any) => {
                        const name = getPlayerName(b.id);
                        return (
                          <TableRow key={b.id}>
                            <TableCell className="py-3">
                              <div className="flex items-center gap-2"><p className={cn("font-black text-xs uppercase", name === '---' ? "text-amber-600" : "text-slate-900")}>{name}</p>{name === '---' && isUmpire && (<Button variant="ghost" size="sm" onClick={() => { setRepairTargetId(b.id); setIsRepairOpen(true); }} className="h-6 w-6 text-amber-500 p-0"><RefreshCw className="w-3 h-3" /></Button>)}</div>
                              <p className="text-[8px] font-bold text-slate-400 uppercase italic">{(b.dismissal || 'not out').replace('Fielder', getPlayerName(b.fielderId))}</p>
                            </TableCell>
                            <TableCell className="text-right font-black">{b.runs}</TableCell>
                            <TableCell className="text-right text-xs font-bold text-slate-500">{b.balls}</TableCell>
                            <TableCell className="text-right text-[9px] font-bold text-slate-400">{b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0'}</TableCell>
                          </TableRow>
                        );
                      })}</TableBody>
                  </Table>
                </Card>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isRepairOpen} onOpenChange={setIsRepairOpen}><DialogContent className="max-w-[95vw] sm:max-w-md rounded-3xl border-t-8 border-t-amber-500 shadow-2xl z-[200]"><DialogHeader><DialogTitle className="font-black uppercase text-xl text-amber-600 flex items-center gap-2"><AlertTriangle className="w-6 h-6" /> Repair Scorecard</DialogTitle></DialogHeader><div className="space-y-6 py-4"><div className="bg-amber-50 p-4 rounded-2xl border border-amber-100"><p className="text-[10px] font-black uppercase text-amber-600 mb-1">Target Unknown ID</p><code className="text-xs font-bold break-all">{repairTargetId}</code></div><div className="space-y-2"><Label className="text-xs font-black uppercase">Assign To Profile</Label><Select value={replacementPlayerId} onValueChange={setReplacementPlayerId}><SelectTrigger className="h-14 font-bold"><SelectValue placeholder="Pick replacement player" /></SelectTrigger><SelectContent className="z-[250] max-h-[250px]">{allPlayers?.map(p => <SelectItem key={p.id} value={p.id} className="font-bold">{p.name}</SelectItem>)}</SelectContent></Select></div></div><DialogFooter><Button onClick={handleRepairMatchData} disabled={!replacementPlayerId || isRepairing} className="w-full h-14 bg-amber-600 font-black uppercase shadow-xl">{isRepairing ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <RefreshCw className="w-5 h-5 mr-2" />} Re-map All Entries</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}