
"use client"

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDoc, useMemoFirebase, useFirestore, useCollection, updateDocumentNonBlocking, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { History, Loader2, ArrowLeftRight, ShieldCheck, CheckCircle2, Settings2, Rewind, Download, Edit2, PlusCircle, Filter, Unlock, Calendar, UserCheck, MapPin, Hash, ChevronLeft, Trash2, Share2, Star, Zap, Swords, Trophy, Target, Shield, Crown, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn, formatTeamName } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useApp } from '@/context/AppContext';
import { getExtendedInningStats, generateMatchReport } from '@/lib/report-utils';
import { calculatePlayerCVP } from '@/lib/cvp-utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts';
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
  
  const [assignmentForm, setAssignmentForm] = useState({ strikerId: '', nonStrikerId: '', bowlerId: '' });
  const [wicketForm, setWicketForm] = useState({ type: 'bowled', batterOutId: '', extraType: 'none', runsCompleted: 0, fielderId: 'none', successorId: '' });
  const [correctionForm, setCorrectionForm] = useState<any>({ id: '', strikerId: '', nonStrikerId: '', bowlerId: '', runs: 0, extra: 'none', isWicket: false, wicketType: 'bowled', timestamp: 0, targetInning: '' });
  const [matchDateForm, setMatchDateForm] = useState('');
  const [venueForm, setVenueForm] = useState('');
  const [matchNumberForm, setMatchNumberForm] = useState('');
  const [potmId, setPotmId] = useState('');

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

  // Squad selection must match the team batting in that inning
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
    const p = allPlayers?.find(p => p.id === pid);
    if (!p) return '---';
    const isC = pid === match?.team1CaptainId || pid === match?.team2CaptainId;
    const isVC = pid === match?.team1ViceCaptainId || pid === match?.team2ViceCaptainId;
    const isWK = pid === match?.team1WicketKeeperId || pid === match?.team2WicketKeeperId;
    return `${p.name}${isC ? ' (C)' : isVC ? ' (VC)' : ''}${isWK ? ' (WK)' : ''}`;
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
    toast({ title: "Generating HD Card...", description: "Optimizing for broadcast quality." });

    try {
      const dataUrl = await toPng(shareCardRef.current, { 
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#f8fafc',
        skipFonts: false,
      });
      
      const link = document.createElement('a');
      link.download = `CricMates_${match?.matchNumber || 'Match'}_${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      
      toast({ title: "Image Ready", description: "HD Share Card saved to gallery." });
    } catch (err: any) {
      console.error('Share Image Error:', err);
      toast({ 
        title: "Sharing Error", 
        description: "Failed to generate HD image. Try again or check your connection.",
        variant: "destructive" 
      });
    } finally {
      setIsSharing(false);
    }
  };

  const recalculateInningState = async (inningId: string) => {
    const deliveriesRef = collection(db, 'matches', matchId, 'innings', inningId, 'deliveryRecords');
    const snap = await getDocs(query(deliveriesRef, orderBy('timestamp', 'asc')));
    const deliveriesList = snap.docs.map(d => d.data()).sort((a,b) => (a.timestamp - b.timestamp) || a.id.localeCompare(b.id));
    
    let score = 0, wkts = 0, legal = 0;
    let sId = '', nsId = '';

    deliveriesList.forEach((d, idx) => {
      score += (d.totalRunsOnDelivery || 0);
      const isRetirement = d.dismissalType === 'retired';
      if (d.isWicket && !isRetirement) wkts++;
      if (d.extraType === 'none' && !isRetirement) legal++;

      if (idx === deliveriesList.length - 1) {
        sId = d.strikerPlayerId;
        nsId = d.nonStrikerPlayerId;
        const runs = d.runsScored || 0;
        const isLegal = d.extraType === 'none' && !isRetirement;
        
        if (runs % 2 !== 0) [sId, nsId] = [nsId, sId];
        if (legal % 6 === 0 && isLegal) [sId, nsId] = [nsId, sId];
        
        if (d.isWicket) {
          const outPid = d.batsmanOutPlayerId || d.strikerPlayerId;
          const successor = d.successorPlayerId || '';
          if (outPid === sId) sId = successor;
          else if (outPid === nsId) nsId = successor;
        }
      }
    });
    
    const updates: any = { 
      score, wickets: wkts, oversCompleted: Math.floor(legal / 6), ballsInCurrentOver: legal % 6,
      strikerPlayerId: sId || '',
      nonStrikerPlayerId: nsId || ''
    };
    if (legal % 6 === 0 && legal > 0) updates.currentBowlerPlayerId = '';

    await setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', inningId), updates, { merge: true });
  };

  const handleFinalizeMatch = async () => {
    const s1 = stats1.total;
    const s2 = stats2.total;
    const w2 = stats2.wickets;
    const bat1Id = inn1?.battingTeamId || match?.team1Id;
    const bat2Id = inn2?.battingTeamId || (bat1Id === match?.team1Id ? match?.team2Id : match?.team1Id);
    
    let result = "Match Completed";
    let winnerId = "";
    let isTie = false;

    if (s1 > s2) {
      winnerId = bat1Id;
      const winnerName = getTeamName(bat1Id || '');
      result = `${winnerName} won by ${s1 - s2} runs`;
    } else if (s2 > s1) {
      winnerId = bat2Id;
      const winnerName = getTeamName(bat2Id || '');
      const winningTeamSquad = winnerId === match?.team1Id ? match?.team1SquadPlayerIds : match?.team2SquadPlayerIds;
      const squadSize = winningTeamSquad?.length || 11;
      const maxWicketsPossible = squadSize - 1;
      const wicketsLeft = Math.max(0, maxWicketsPossible - w2);
      result = `${winnerName} won by ${wicketsLeft} wicket${wicketsLeft !== 1 ? 's' : ''}`;
    } else {
      isTie = true;
      result = "Match Tied";
    }
    
    try {
      await setDocumentNonBlocking(doc(db, 'matches', matchId), { 
        status: 'completed',
        resultDescription: result,
        winnerTeamId: winnerId || 'none',
        isTie: isTie
      }, { merge: true });
      toast({ title: "Match Finalized", description: result });
    } catch (e) {
      toast({ title: "Error", description: "Failed to finalize match.", variant: "destructive" });
    }
  };

  const handleRecordBall = async (runs: number, extra: any = 'none') => {
    if (!match || !activeInningData || !isUmpire || !activeInningData.currentBowlerPlayerId) {
      toast({ title: "Officiating Error", description: "Assign bowler before recording balls.", variant: "destructive" });
      return;
    }
    const currentInningId = `inning_${match.currentInningNumber}`;
    const isLegal = extra === 'none';
    const totalLegalCount = (currentDeliveriesWithLabels?.filter(d => d.extraType === 'none' && d.dismissalType !== 'retired').length || 0);
    const newTotalLegal = totalLegalCount + (isLegal ? 1 : 0);
    
    const deliveryId = doc(collection(db, 'temp')).id;
    const dData = { 
      id: deliveryId, 
      strikerPlayerId: activeInningData.strikerPlayerId || '', 
      nonStrikerPlayerId: activeInningData.nonStrikerPlayerId || '',
      bowlerId: activeInningData.currentBowlerPlayerId || '', 
      runsScored: runs, 
      extraType: extra, 
      totalRunsOnDelivery: runs + (extra !== 'none' ? 1 : 0), 
      isWicket: false, 
      timestamp: Date.now() 
    };
    
    await setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords', deliveryId), dData, { merge: true });

    let nextS = activeInningData.strikerPlayerId, nextNS = activeInningData.nonStrikerPlayerId;
    if (runs % 2 !== 0) [nextS, nextNS] = [nextNS, nextS];
    if (newTotalLegal % 6 === 0 && isLegal) [nextS, nextNS] = [nextNS, nextS];

    const updates: any = { 
      score: activeInningData.score + dData.totalRunsOnDelivery, 
      oversCompleted: Math.floor(newTotalLegal / 6), 
      ballsInCurrentOver: newTotalLegal % 6, 
      strikerPlayerId: nextS || '', 
      nonStrikerPlayerId: nextNS || '' 
    };
    
    if (newTotalLegal % 6 === 0 && isLegal) updates.currentBowlerPlayerId = '';
    if (newTotalLegal >= match.totalOvers * 6) updates.isDeclaredFinished = true;

    await setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currentInningId), updates, { merge: true });
    setIsNoBallDialogOpen(false);
  };

  const handleManualCorrection = async () => {
    if (!correctionForm.strikerId || !correctionForm.bowlerId || !correctionForm.targetInning) return;
    
    const deliveryId = correctionForm.id || doc(collection(db, 'temp')).id;
    const runs = Number(correctionForm.runs) || 0;
    const extra = correctionForm.extra || 'none';
    const isWicket = !!correctionForm.isWicket;

    const dData: any = {
      id: deliveryId,
      strikerPlayerId: correctionForm.strikerId || '',
      nonStrikerPlayerId: correctionForm.nonStrikerId || '',
      bowlerId: correctionForm.bowlerId || '',
      runsScored: runs,
      extraType: extra,
      totalRunsOnDelivery: runs + (extra !== 'none' ? 1 : 0),
      isWicket: isWicket,
      dismissalType: isWicket ? (correctionForm.wicketType || 'bowled') : '',
      batsmanOutPlayerId: isWicket ? (correctionForm.batterOutId || correctionForm.strikerId) : '',
      timestamp: correctionForm.timestamp || Date.now()
    };

    await setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', correctionForm.targetInning, 'deliveryRecords', deliveryId), dData, { merge: true });
    await recalculateInningState(correctionForm.targetInning);
    setIsCorrectionDialogOpen(false);
    toast({ title: correctionForm.id ? "Delivery Updated" : "Delivery Inserted" });
  };

  const matchCvpMap = useMemo(() => {
    if (!isMounted || !allPlayers || (!inn1Deliveries && !inn2Deliveries)) return {};
    const squads = [...(match?.team1SquadPlayerIds || []), ...(match?.team2SquadPlayerIds || [])];
    const map: Record<string, number> = {};
    const allMatchDeliveries = [...(inn1Deliveries || []), ...(inn2Deliveries || [])];

    squads.forEach(pid => {
      const p = allPlayers.find(pl => pl.id === pid);
      if (!p) return;
      const pStats = { id: pid, name: p.name, runs: 0, ballsFaced: 0, fours: 0, sixes: 0, wickets: 0, maidens: 0, ballsBowled: 0, runsConceded: 0, catches: 0, stumpings: 0, runOuts: 0 };
      allMatchDeliveries.forEach(d => {
        if (d.strikerPlayerId === pid) { pStats.runs += (d.runsScored || 0); if (d.extraType !== 'wide') pStats.ballsFaced++; if (d.runsScored === 4) pStats.fours++; if (d.runsScored === 6) pStats.sixes++; }
        const bId = d.bowlerId || d.bowlerPlayerId;
        if (bId === pid) { pStats.runsConceded += (d.totalRunsOnDelivery || 0); if (d.extraType === 'none' && d.dismissalType !== 'retired') pStats.ballsBowled++; if (d.isWicket && !['runout', 'retired'].includes(d.dismissalType || '')) pStats.wickets++; }
        if (d.fielderPlayerId === pid) { if (d.dismissalType === 'caught') pStats.catches++; if (d.dismissalType === 'stumped') pStats.stumpings++; if (d.dismissalType === 'runout') pStats.runOuts++; }
      });
      map[pid] = calculatePlayerCVP(pStats);
    });
    return map;
  }, [inn1Deliveries, inn2Deliveries, match, allPlayers, isMounted]);

  const manhattanData = useMemo(() => {
    const maxOvers = match?.totalOvers || 6;
    const data: any[] = [];
    for (let i = 1; i <= maxOvers; i++) {
      const r1 = inn1WithLabels.filter(d => d.overIndex === i).reduce((acc, d) => acc + (d.totalRunsOnDelivery || 0), 0);
      const r2 = inn2WithLabels.filter(d => d.overIndex === i).reduce((acc, d) => acc + (d.totalRunsOnDelivery || 0), 0);
      data.push({ over: `Ov ${i}`, team1: r1, team2: (inn2Deliveries && inn2Deliveries.length > 0) ? r2 : null });
    }
    return data;
  }, [inn1WithLabels, inn2WithLabels, match?.totalOvers, inn2Deliveries]);

  const wormData = useMemo(() => {
    const data: any[] = [];
    const maxOvers = match?.totalOvers || 6;
    for (let i = 0; i <= maxOvers; i++) {
      const d1 = inn1WithLabels.filter(d => d.overIndex <= i);
      const d2 = inn2WithLabels.filter(d => d.overIndex <= i);
      const score1 = d1.reduce((acc, d) => acc + (d.totalRunsOnDelivery || 0), 0);
      const score2 = d2.reduce((acc, d) => acc + (d.totalRunsOnDelivery || 0), 0);
      const w1 = d1.filter(d => d.isWicket && d.dismissalType !== 'retired' && d.overIndex === i && d.extraType === 'none').length > 0;
      const w2 = d2.filter(d => d.isWicket && d.dismissalType !== 'retired' && d.overIndex === i && d.extraType === 'none').length > 0;
      data.push({ over: i, team1: score1, team2: (inn2Deliveries && inn2Deliveries.length > 0) ? score2 : null, w1: w1 ? score1 : null, w2: w2 ? score2 : null });
    }
    return data;
  }, [inn1WithLabels, inn2WithLabels, match?.totalOvers, inn2Deliveries]);

  if (!isMounted || isMatchLoading) return <div className="flex flex-col items-center justify-center min-h-screen"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;

  const row1TeamId = inn1?.battingTeamId || match?.team1Id;
  const row2TeamId = inn2?.battingTeamId || (row1TeamId === match?.team1Id ? match?.team2Id : match?.team1Id);

  return (
    <div className="space-y-6 max-w-lg mx-auto pb-32 relative px-1">
      <div className="fixed top-16 left-0 right-0 z-[90] bg-white text-slate-950 shadow-2xl px-6 py-4 border-b-4 border-slate-300">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/matches')} className="text-slate-950 hover:bg-slate-100 h-8 w-8 shrink-0"><ChevronLeft className="w-6 h-6" /></Button>
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-3">
              <span className="font-black uppercase text-[11px] text-slate-700 max-w-[120px] tracking-tight">{getTeamName(row1TeamId)}</span>
              <span className="font-black text-2xl leading-none text-slate-950">{stats1.total}/{stats1.wickets}</span>
              <Badge variant="outline" className="text-[11px] font-black border-slate-400 h-6 text-slate-950 bg-slate-100 px-2">({stats1.overs})</Badge>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-black uppercase text-[11px] text-slate-700 max-w-[120px] tracking-tight">{getTeamName(row2TeamId)}</span>
              <span className="font-black text-2xl leading-none text-slate-950">{stats2.total}/{stats2.wickets}</span>
              <Badge variant="outline" className="text-[11px] font-black border-slate-400 h-6 text-slate-950 bg-slate-100 px-2">({stats2.overs})</Badge>
            </div>
          </div>
          <div className="text-right flex flex-col items-end gap-1">
            {match?.status === 'live' && <Badge variant="destructive" className="animate-pulse text-[10px] h-6 font-black uppercase px-3 shadow-md border-2 border-white">LIVE</Badge>}
            <button onClick={() => isUmpire && setIsMatchDetailsDialogOpen(true)} className={cn("text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-1", isUmpire ? "text-primary hover:underline" : "text-slate-400")}>
              {match?.matchNumber || 'Match X'} {isUmpire && <Edit2 className="w-2 h-2" />}
            </button>
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
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="flex-1 h-12 border-primary/20 text-primary font-black uppercase text-[9px] bg-white/5"><ShieldCheck className="w-4 h-4 mr-2" /> Match Actions</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56 rounded-xl" align="end">
                          <DropdownMenuItem className="font-bold py-3" onClick={async () => {
                            await setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match?.currentInningNumber}`), { isDeclaredFinished: true }, { merge: true });
                            toast({ title: "Innings Declared Finished" });
                          }}><CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500" /> Finish Innings</DropdownMenuItem>
                          <DropdownMenuItem className="font-bold py-3" onClick={() => setIsPotmDialogOpen(true)}><UserCheck className="w-4 h-4 mr-2 text-amber-500" /> Declare POTM</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="font-bold py-3" onClick={async () => { await setDocumentNonBlocking(doc(db, 'matches', matchId), { currentInningNumber: 1 }, { merge: true }); toast({ title: "Scoring Inning 1" }); }}><Rewind className="w-4 h-4 mr-2 text-amber-500" /> Score Inning 1</DropdownMenuItem>
                          <DropdownMenuItem className="font-bold py-3" onClick={async () => { await setDocumentNonBlocking(doc(db, 'matches', matchId), { currentInningNumber: 2 }, { merge: true }); toast({ title: "Score Inning 2" }); }}><Rewind className="w-4 h-4 mr-2 text-primary" /> Score Inning 2</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="font-bold py-3" onClick={handleFinalizeMatch}><ShieldCheck className="w-4 h-4 mr-2 text-emerald-500" /> Finalize Match</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button variant="outline" onClick={() => setIsPlayerAssignmentOpen(true)} className="flex-1 h-12 border-secondary/20 text-secondary font-black uppercase text-[9px] bg-white/5"><Settings2 className="w-4 h-4 mr-2" /> Assign</Button>
                    </div>
                    {match?.status === 'live' && !activeInningData?.isDeclaredFinished && (
                      <>
                        <div className="grid grid-cols-4 gap-2">
                          {[0, 1, 2, 3, 4, 6].map(r => (
                            <Button key={r} disabled={!activeInningData?.currentBowlerPlayerId} onClick={() => handleRecordBall(r)} className={cn("h-14 font-black text-2xl rounded-2xl", r >= 4 ? "bg-primary text-white" : "bg-white/5 text-white")}>{r || '•'}</Button>
                          ))}
                          <Button onClick={() => setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match?.currentInningNumber}`), { strikerPlayerId: activeInningData?.nonStrikerPlayerId || '', nonStrikerPlayerId: activeInningData?.strikerPlayerId || '' }, { merge: true })} className="bg-secondary text-white h-14 font-black rounded-2xl"><ArrowLeftRight className="w-5 h-5"/></Button>
                          <Button variant="outline" onClick={() => { setWicketForm({...wicketForm, batterOutId: activeInningData?.strikerPlayerId || '', fielderId: 'none', successorId: ''}); setIsWicketDialogOpen(true); }} className="h-14 border-red-500/30 text-red-500 font-black rounded-2xl uppercase text-[10px] bg-white/5">Wicket</Button>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <Button variant="outline" onClick={() => handleRecordBall(0, 'wide')} className="h-12 border-amber-500/30 text-amber-500 uppercase font-black text-[9px] bg-white/5">Wide</Button>
                          <Button variant="outline" onClick={() => setIsNoBallDialogOpen(true)} className="h-12 border-amber-500/30 text-amber-500 uppercase font-black text-[9px] bg-white/5">No Ball</Button>
                          <Button variant="outline" onClick={async () => { 
                            const currId = `inning_${match?.currentInningNumber}`;
                            const snap = await getDocs(query(collection(db, 'matches', matchId, 'innings', currId, 'deliveryRecords'), orderBy('timestamp', 'desc'), limit(1)));
                            if(!snap.empty) { await deleteDocumentNonBlocking(snap.docs[0].ref); await recalculateInningState(currId); toast({ title: "Undone" }); }
                          }} className="h-12 border-white/10 text-slate-400 uppercase font-black text-[9px] bg-white/5">Undo</Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
                {activeInningData?.isDeclaredFinished && match?.status === 'live' && (
                  <Button onClick={async () => {
                    if (match?.currentInningNumber === 1) {
                      const batId = match.team1Id === inn1?.battingTeamId ? match.team2Id : match.team1Id;
                      await setDocumentNonBlocking(doc(db, 'matches', matchId), { currentInningNumber: 2 }, { merge: true });
                      await setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', 'inning_2'), { id: 'inning_2', battingTeamId: batId, score: 0, wickets: 0, oversCompleted: 0, ballsInCurrentOver: 0, isDeclaredFinished: false }, { merge: true });
                      toast({ title: "2nd Innings Started" });
                    } else {
                      await handleFinalizeMatch();
                    }
                  }} className="w-full h-20 bg-emerald-600 text-white font-black text-xl uppercase rounded-3xl shadow-2xl">
                    {match?.currentInningNumber === 1 ? "Start 2nd Innings" : "Finalize Match"}
                  </Button>
                )}
              </div>
            )}

            <div className="space-y-6">
              <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
                <div className="p-3 bg-slate-100 flex items-center justify-between"><span className="text-[10px] font-black uppercase text-slate-500">Live Batting</span></div>
                <Table>
                  <TableHeader><TableRow><TableHead className="text-[9px] font-black uppercase">Batter</TableHead><TableHead className="text-right text-[9px] font-black uppercase">R</TableHead><TableHead className="text-right text-[9px] font-black uppercase">B</TableHead><TableHead className="text-right text-[9px] font-black uppercase">Dots</TableHead><TableHead className="text-right text-[9px] font-black uppercase">SR</TableHead></TableRow></TableHeader>
                  <TableBody>{[activeInningData?.strikerPlayerId, activeInningData?.nonStrikerPlayerId].map((pid, idx) => {
                      if (!pid) return null;
                      const stats = match?.currentInningNumber === 1 ? stats1 : stats2;
                      const b = stats.batting.find((p: any) => p?.id === pid) || { runs: 0, balls: 0, dots: 0 };
                      return (
                        <TableRow key={pid} className={idx === 0 ? "bg-primary/5" : ""}>
                          <TableCell className="font-black text-xs uppercase py-3 truncate max-w-[140px]">{getPlayerName(pid)}{idx === 0 ? '*' : ''}</TableCell>
                          <TableCell className="text-right font-black">{b.runs}</TableCell>
                          <TableCell className="text-right text-xs font-bold text-slate-500">{b.balls}</TableCell>
                          <TableCell className="text-right text-xs text-slate-400">{b.dots}</TableCell>
                          <TableCell className="text-right text-[9px] font-bold text-slate-400">{b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0'}</TableCell>
                        </TableRow>
                      );
                    })}</TableBody>
                </Table>
              </Card>

              <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
                <div className="p-3 bg-slate-100 flex items-center justify-between"><span className="text-[10px] font-black uppercase text-slate-500">Live Bowling</span></div>
                <Table>
                  <TableHeader><TableRow><TableHead className="text-[9px] font-black uppercase">Bowler</TableHead><TableHead className="text-right text-[9px] font-black uppercase">O</TableHead><TableHead className="text-right text-[9px] font-black uppercase">Dots</TableHead><TableHead className="text-right text-[9px] font-black uppercase">R</TableHead><TableHead className="text-right text-[9px] font-black uppercase">W</TableHead><TableHead className="text-right text-[9px] font-black uppercase">ER</TableHead></TableRow></TableHeader>
                  <TableBody>{activeInningData?.currentBowlerPlayerId ? (() => {
                      const b = (match?.currentInningNumber === 1 ? stats1 : stats2).bowling.find(bowler => bowler.id === activeInningData.currentBowlerPlayerId);
                      return (
                        <TableRow className="bg-secondary/5">
                          <TableCell className="font-black text-xs uppercase py-3 truncate max-w-[140px]">{getPlayerName(activeInningData.currentBowlerPlayerId)}</TableCell>
                          <TableCell className="text-right font-bold text-xs">{b?.oversDisplay || '0.0'}</TableCell>
                          <TableCell className="text-right text-xs">{b?.dots || 0}</TableCell>
                          <TableCell className="text-right text-xs">{b?.runs || 0}</TableCell>
                          <TableCell className="text-right font-black text-secondary">{b?.wickets || 0}</TableCell>
                          <TableCell className="text-right text-[9px] font-bold text-slate-400">{b?.economy || '0.00'}</TableCell>
                        </TableRow>
                      );
                    })() : null}</TableBody>
                </Table>
              </Card>

              <div className="space-y-3">
                <h3 className="text-[10px] font-black uppercase text-slate-500 px-2 tracking-widest flex items-center gap-2"><History className="w-3 h-3" /> Recent Over History</h3>
                {groupedByOver.length > 0 ? groupedByOver.slice(0, 3).map(([overIdx, deliveries]) => (
                  <Card key={overIdx} className="border-none shadow-sm bg-white p-3 flex items-center justify-between rounded-xl">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="bg-slate-900 text-white text-[10px] font-black h-8 w-8 rounded-lg flex items-center justify-center shrink-0">OV {overIdx}</div>
                      <div className="flex flex-wrap gap-1.5 overflow-x-auto scrollbar-hide py-1">
                        {deliveries.map(d => {
                          let label = (d.totalRunsOnDelivery || 0).toString();
                          let color = "bg-slate-100 text-slate-600";
                          if (d.isWicket) { label = d.dismissalType === 'retired' ? 'RET' : (d.dismissalType === 'runout' && d.runsScored > 0 ? `${d.runsScored}+W` : 'W'); color = d.dismissalType === 'retired' ? 'bg-slate-200' : 'bg-red-500 text-white'; }
                          else if (d.extraType === 'wide') { label = `${d.totalRunsOnDelivery}wd`; color = "bg-amber-100 text-amber-700"; }
                          else if (d.extraType === 'noball') { label = d.runsScored === 0 ? 'NB' : `${d.runsScored}+NB`; color = "bg-amber-100 text-amber-700"; }
                          else if (d.runsScored === 4) color = "bg-blue-500 text-white";
                          else if (d.runsScored === 6) color = "bg-primary text-white";
                          else if (d.runsScored === 0) label = "•";
                          return <div key={d.id} className={cn("min-w-[24px] h-6 px-1.5 rounded flex items-center justify-center text-[10px] font-black", color)}>{label}</div>;
                        })}
                      </div>
                    </div>
                    <div className="text-right shrink-0 border-l pl-3"><p className="text-[10px] font-black text-slate-900">{deliveries.reduce((acc, d) => acc + (d.totalRunsOnDelivery || 0), 0)} R</p></div>
                  </Card>
                )) : (
                  <div className="text-center py-8 border-2 border-dashed rounded-2xl bg-slate-50/50"><p className="text-[10px] font-black uppercase text-slate-300">Awaiting first delivery</p></div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="scorecard" className="space-y-8">
            {[ 
              {id: 1, stats: stats1, teamId: inn1?.battingTeamId || match?.team1Id, label: '1st Innings'}, 
              {id: 2, stats: stats2, teamId: inn2?.battingTeamId || (inn1?.battingTeamId === match?.team1Id ? match?.team2Id : match?.team1Id), label: '2nd Innings'} 
            ].map(inn => (
              <div key={inn.id} className="space-y-6">
                <div className="flex justify-between items-center px-2">
                  <h2 className="text-lg font-black uppercase text-slate-900">{inn.label} - {getTeamName(inn.teamId || '')}</h2>
                  <Badge className="bg-primary text-white font-black">{inn.stats.total}/{inn.stats.wickets} ({inn.stats.overs})</Badge>
                </div>
                <Card className="border-none shadow-lg rounded-3xl overflow-hidden bg-white">
                  <Table>
                    <TableHeader className="bg-slate-50"><TableRow><TableHead className="text-[9px] font-black uppercase">Batter</TableHead><TableHead className="text-right text-[9px] font-black uppercase">R</TableHead><TableHead className="text-right text-[9px] font-black uppercase">B</TableHead><TableHead className="text-right text-[9px] font-black uppercase">Dots</TableHead><TableHead className="text-right text-[9px] font-black uppercase">4s/6s</TableHead><TableHead className="text-right text-[9px] font-black uppercase">SR</TableHead></TableRow></TableHeader>
                    <TableBody>{inn.stats.batting.map((b: any) => (
                        <TableRow key={b.id}>
                          <TableCell className="py-3"><p className="font-black text-xs uppercase">{getPlayerName(b.id)}</p><p className="text-[8px] font-bold text-slate-400 uppercase italic">{(b.dismissal || 'not out').replace('Fielder', getPlayerName(b.fielderId))}</p></TableCell>
                          <TableCell className="text-right font-black">{b.runs}</TableCell>
                          <TableCell className="text-right text-xs font-bold text-slate-500">{b.balls}</TableCell>
                          <TableCell className="text-right text-xs text-slate-400">{b.dots}</TableCell>
                          <TableCell className="text-right text-xs text-slate-400">{b.fours}/{b.sixes}</TableCell>
                          <TableCell className="text-right text-[9px] font-bold text-slate-400">{b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0'}</TableCell>
                        </TableRow>
                      ))}</TableBody>
                  </Table>
                  <div className="bg-slate-50 p-4 border-t flex justify-between items-center"><span className="text-[10px] font-black uppercase text-slate-400">Extras: {inn.stats.extras.total} (wd {inn.stats.extras.w}, nb {inn.stats.extras.nb})</span><span className="text-xs font-black uppercase text-slate-900">Total: {inn.stats.total}/{inn.stats.wickets}</span></div>
                </Card>

                {inn.stats.didNotBat?.length > 0 && (
                  <div className="px-4 py-3 bg-slate-50 rounded-2xl border border-dashed">
                    <span className="text-[10px] font-black text-slate-400 uppercase mr-3">Did Not Bat:</span>
                    <span className="text-[10px] font-bold text-slate-600 uppercase">{inn.stats.didNotBat.map((id: string) => getPlayerName(id)).join(', ')}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="border-none shadow-md rounded-2xl bg-white p-4">
                    <h3 className="text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest border-b pb-2">Fall of Wickets</h3>
                    <div className="space-y-2">
                      {inn.stats.fow.length > 0 ? inn.stats.fow.map((f: any) => (
                        <div key={f.wicketNum} className="flex justify-between items-center text-[10px]">
                          <span className="font-black text-slate-900">{f.wicketNum}-{f.scoreAtWicket}</span>
                          <span className="font-bold text-slate-500 uppercase">{getPlayerName(f.playerOutId).split(' ')[0]} ({f.runsOut}, {f.over} ov)</span>
                        </div>
                      )) : <p className="text-[10px] font-bold text-slate-300 italic text-center py-2">No Wickets</p>}
                    </div>
                  </Card>
                  <Card className="border-none shadow-md rounded-2xl bg-white p-4">
                    <h3 className="text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest border-b pb-2">Partnerships</h3>
                    <div className="space-y-2">
                      {inn.stats.partnerships.map((p: any, i: number) => (
                        <div key={i} className="flex justify-between items-start text-[9px] border-b border-slate-50 pb-2 last:border-0">
                          <div className="flex flex-col">
                            <span className="font-black text-slate-900 uppercase">{p.batters.map((id: string) => getPlayerName(id).split(' ')[0]).join(' - ')}</span>
                            <span className="text-[8px] text-slate-400 italic">{Object.entries(p.contributions).map(([id, s]: [any, any]) => `${getPlayerName(id).split(' ')[0]} ${s.runs}`).join(', ')}</span>
                          </div>
                          <span className="font-black text-primary ml-2">{p.runs} ({p.balls}b)</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>

                <Card className="border-none shadow-lg rounded-3xl overflow-hidden bg-white">
                  <Table>
                    <TableHeader className="bg-slate-50"><TableRow><TableHead className="text-[9px] font-black uppercase">Bowler</TableHead><TableHead className="text-right text-[9px] font-black uppercase">O</TableHead><TableHead className="text-right text-[9px] font-black uppercase">M</TableHead><TableHead className="text-right text-[9px] font-black uppercase">Dots</TableHead><TableHead className="text-right text-[9px] font-black uppercase">R</TableHead><TableHead className="text-right text-[9px] font-black uppercase">W</TableHead><TableHead className="text-right text-[9px] font-black uppercase">ER</TableHead></TableRow></TableHeader>
                    <TableBody>{inn.stats.bowling.map((b: any) => (
                        <TableRow key={b.id}>
                          <TableCell className="font-black text-xs uppercase py-3">{getPlayerName(b.id)}</TableCell>
                          <TableCell className="text-right font-bold text-xs">{b.oversDisplay}</TableCell>
                          <TableCell className="text-right text-xs">{b.maidens || 0}</TableCell>
                          <TableCell className="text-right text-xs">{b.dots || 0}</TableCell>
                          <TableCell className="text-right text-xs">{b.runs}</TableCell>
                          <TableCell className="text-right font-black text-secondary">{b.wickets}</TableCell>
                          <TableCell className="text-right text-[9px] font-bold text-slate-400">{b.economy}</TableCell>
                        </TableRow>
                      ))}</TableBody>
                  </Table>
                </Card>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="analysis" className="space-y-8">
            <div className="space-y-4">
              <h2 className="text-lg font-black uppercase text-slate-900 px-2 flex items-center gap-2"><History className="w-5 h-5 text-primary" /> Momentum</h2>
              <Card className="p-6 border-none shadow-xl rounded-3xl bg-white">
                <p className="text-[10px] font-black uppercase text-slate-400 mb-6 tracking-widest">Manhattan</p>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={manhattanData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="over" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800 }} />
                      <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                      <Legend verticalAlign="top" align="right" height={36}/>
                      <Bar name={getTeamName(row1TeamId)} dataKey="team1" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      <Bar name={getTeamName(row2TeamId)} dataKey="team2" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card className="p-6 border-none shadow-xl rounded-3xl bg-white">
                <p className="text-[10px] font-black uppercase text-slate-400 mb-6 tracking-widest">Worm</p>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={wormData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="over" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800 }} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                      <Legend verticalAlign="top" align="right" height={36}/>
                      <Line key="line-t1" name={getTeamName(row1TeamId)} type="monotone" dataKey="team1" stroke="hsl(var(--primary))" strokeWidth={3} dot={(props: any) => props.payload.w1 ? <circle key={`w1-${props.cx}-${props.cy}`} cx={props.cx} cy={props.cy} r={6} fill="#ef4444" stroke="white" strokeWidth={2} /> : null} />
                      <Line key="line-t2" name={getTeamName(row2TeamId)} type="monotone" dataKey="team2" stroke="hsl(var(--secondary))" strokeWidth={3} dot={(props: any) => props.payload.w2 ? <circle key={`w2-${props.cx}-${props.cy}`} cx={props.cx} cy={props.cy} r={6} fill="#ef4444" stroke="white" strokeWidth={2} /> : null} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="overs" className="space-y-4">
            <div className="flex flex-col gap-4 px-2">
              <h2 className="text-lg font-black uppercase text-slate-900 flex items-center gap-2"><History className="w-5 h-5 text-primary" /> History Explorer</h2>
              <Tabs defaultValue="current" className="w-full">
                <TabsList className="grid w-full grid-cols-2 h-10 bg-slate-100 p-1 rounded-xl mb-4">
                  <TabsTrigger value="current" className="text-[9px] font-black uppercase">Inning {match?.currentInningNumber}</TabsTrigger>
                  <TabsTrigger value="other" className="text-[9px] font-black uppercase">Inning {match?.currentInningNumber === 1 ? 2 : 1}</TabsTrigger>
                </TabsList>
                {[ 
                  {id: 'current', labels: (match?.currentInningNumber === 1 ? inn1WithLabels : inn2WithLabels), innKey: `inning_${match?.currentInningNumber}`}, 
                  {id: 'other', labels: (match?.currentInningNumber === 1 ? inn2WithLabels : inn1WithLabels), innKey: `inning_${match?.currentInningNumber === 1 ? 2 : 1}`} 
                ].map(tab => {
                  const oversMap: Record<number, string> = {};
                  tab.labels.forEach(d => { if (!oversMap[d.overIndex]) oversMap[d.overIndex] = `Over ${d.overIndex} - ${getPlayerName(d.bowlerId)}`; });
                  const filteredLog = selectedOverFilter === 'all' ? tab.labels : tab.labels.filter(d => d.overIndex.toString() === selectedOverFilter);
                  return (
                    <TabsContent key={tab.id} value={tab.id} className="space-y-4">
                      <div className="bg-white p-4 rounded-2xl border-2 border-slate-100 shadow-sm flex items-center gap-3">
                        <Filter className="w-4 h-4 text-slate-400" />
                        <Select value={selectedOverFilter} onValueChange={setSelectedOverFilter}>
                          <SelectTrigger className="h-10 border-none bg-slate-50 font-black uppercase text-[10px]"><SelectValue placeholder="Jump to Over" /></SelectTrigger>
                          <SelectContent className="z-[200]">
                            <SelectItem value="all" className="font-black uppercase text-[10px]">All History</SelectItem>
                            {Object.entries(oversMap).map(([idx, label]) => <SelectItem key={idx} value={idx} className="font-black uppercase text-[10px]">{label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        {filteredLog.slice().reverse().map((d, idx, arr) => {
                          const prevBallInLog = arr[idx + 1];
                          const nextBallInLog = arr[idx - 1];
                          const isOverStart = !nextBallInLog || nextBallInLog.overIndex !== d.overIndex;
                          return (
                            <div key={d.id} className="space-y-1">
                              {isOverStart && selectedOverFilter === 'all' && <div className="pt-6 pb-2 px-2 flex items-center gap-3"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Over {d.overIndex}</span><div className="h-px bg-slate-100 flex-1"></div></div>}
                              {isUmpire && (
                                <div className="flex justify-center py-1 group">
                                  <Button variant="ghost" size="sm" onClick={() => {
                                    const newTs = prevBallInLog ? (prevBallInLog.timestamp + d.timestamp) / 2 : d.timestamp - 1000;
                                    setCorrectionForm({ 
                                      id: '', 
                                      strikerId: d.strikerPlayerId || '', 
                                      nonStrikerId: d.nonStrikerPlayerId || '', 
                                      bowlerId: d.bowlerId || d.bowlerPlayerId || '', 
                                      runs: 0, 
                                      extra: 'none', 
                                      isWicket: false, 
                                      timestamp: newTs, 
                                      targetInning: tab.innKey 
                                    });
                                    setIsCorrectionDialogOpen(true);
                                  }} className="h-6 w-6 rounded-full bg-slate-50 text-slate-300 hover:text-primary opacity-0 group-hover:opacity-100 transition-all p-0"><PlusCircle className="w-4 h-4" /></Button>
                                </div>
                              )}
                              <Card className="border-none shadow-sm bg-white p-3 flex items-center justify-between rounded-xl group border-l-4 border-l-slate-100">
                                <div className="flex items-center gap-4">
                                  <div className="flex flex-col items-center justify-center min-w-[40px] border-r pr-3"><span className="text-[10px] font-black text-slate-400">BALL</span><span className="text-xs font-black text-slate-900">{d.ballLabel}</span></div>
                                  <div className={cn("w-10 h-10 rounded-full flex flex-col items-center justify-center font-black text-[10px] border shadow-sm shrink-0 px-1 text-center", d.isWicket ? (d.dismissalType === 'retired' ? "bg-slate-200 text-slate-600 border-slate-300" : "bg-red-500 text-white border-red-600") : d.runsScored === 6 ? "bg-primary text-white" : d.runsScored === 4 ? "bg-blue-500 text-white" : d.extraType !== 'none' ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-slate-50")}>
                                    {d.isWicket ? (d.dismissalType === 'retired' ? "RET" : (d.dismissalType === 'runout' && d.runsScored > 0 ? `${d.runsScored}+W` : "W")) : (d.extraType === 'noball' ? (d.runsScored === 0 ? "NB" : `${d.runsScored}+NB`) : (d.totalRunsOnDelivery || 0))}
                                    {d.extraType === 'wide' && <span className="text-[6px] -mt-1">WD</span>}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-[10px] font-black text-slate-900 truncate max-w-[120px] uppercase">{getPlayerName(d.strikerPlayerId)} vs {getPlayerName(d.bowlerId)}</p>
                                    <p className={cn("text-[8px] font-bold uppercase", d.isWicket ? (d.dismissalType === 'retired' ? "text-slate-500" : "text-red-500") : "text-slate-400")}>{d.isWicket ? d.dismissalType : `${d.runsScored || 0} runs`}</p>
                                  </div>
                                </div>
                                {isUmpire && <div className="flex gap-1 shrink-0"><Button variant="ghost" size="icon" onClick={() => { 
                                  setCorrectionForm({ 
                                    ...d, 
                                    strikerId: d.strikerPlayerId, 
                                    nonStrikerId: d.nonStrikerPlayerId, 
                                    bowlerId: d.bowlerId || d.bowlerPlayerId, 
                                    extra: d.extraType || 'none', 
                                    runs: d.runsScored || 0, 
                                    targetInning: tab.innKey 
                                  }); 
                                  setIsCorrectionDialogOpen(true); 
                                }} className="h-8 w-8 text-slate-300 hover:text-primary"><Edit2 className="w-3 h-3" /></Button><Button variant="ghost" size="icon" onClick={async () => { if(confirm("Delete delivery?")) { await deleteDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', tab.innKey, 'deliveryRecords', d.id)); await recalculateInningState(tab.innKey); toast({ title: "Action Purged" }); } }} className="h-8 w-8 text-slate-300 hover:text-destructive"><Trash2 className="w-4 h-4" /></Button></div>}
                              </Card>
                            </div>
                          );
                        })}
                      </div>
                    </TabsContent>
                  );
                })}
              </Tabs>
            </div>
          </TabsContent>

          <TabsContent value="info" className="space-y-6">
            <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
              <div className="p-6 space-y-8">
                <div className="space-y-4">
                  <div className="flex justify-between items-center"><h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Match Record</h3>{isUmpire && <Button variant="ghost" size="sm" onClick={() => setIsMatchDetailsDialogOpen(true)} className="h-8 font-black uppercase text-[9px]"><Edit2 className="w-3 h-3 mr-1" /> Edit</Button>}</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-2xl border col-span-2"><p className="text-[8px] font-black text-slate-400 uppercase mb-1">Match Tag</p><p className="text-xs font-black uppercase flex items-center gap-2"><Hash className="w-3 h-3 text-primary" /> {match?.matchNumber || 'NOT ASSIGNED'}</p></div>
                    <div className="bg-slate-50 p-4 rounded-2xl border col-span-2"><p className="text-[8px] font-black text-slate-400 uppercase mb-1">Venue</p><p className="text-xs font-black uppercase flex items-center gap-2"><MapPin className="w-3 h-3 text-secondary" /> {match?.venue || 'GULLY GROUND'}</p></div>
                    <div className="bg-slate-50 p-4 rounded-2xl border"><p className="text-[8px] font-black text-slate-400 uppercase mb-1">Decision</p><p className="text-xs font-black uppercase">Elected to {match?.tossDecision}</p></div>
                    <div className="bg-slate-50 p-4 rounded-2xl border"><p className="text-[8px] font-black text-slate-400 uppercase mb-1">Format</p><p className="text-xs font-black uppercase">{match?.totalOvers} Overs</p></div>
                    <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 col-span-2"><p className="text-[8px] font-black text-amber-600 uppercase mb-1">Player of the Match</p><p className="text-sm font-black uppercase flex items-center gap-2 text-amber-900"><UserCheck className="w-4 h-4 text-amber-500" /> {match?.potmPlayerId ? getPlayerName(match.potmPlayerId) : 'TO BE DECLARED'}</p></div>
                  </div>
                </div>

                <div className="space-y-6 pt-4 border-t">
                  <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2"><Users className="w-3 h-3" /> Participating Squads</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 px-1">
                        <div className="w-1 h-3 bg-primary rounded-full" />
                        <p className="text-[9px] font-black uppercase text-slate-900 truncate tracking-wider">{getTeamName(match?.team1Id)}</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {match?.team1SquadPlayerIds?.map((pid: string) => (
                          <Link key={pid} href={`/players/${pid}`}>
                            <Badge variant="outline" className="h-7 border-slate-200 hover:border-primary hover:bg-primary/5 transition-all group cursor-pointer">
                              <span className="text-[9px] font-bold text-slate-600 group-hover:text-primary uppercase">{getPlayerName(pid)}</span>
                            </Badge>
                          </Link>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 px-1">
                        <div className="w-1 h-3 bg-secondary rounded-full" />
                        <p className="text-[9px] font-black uppercase text-slate-900 truncate tracking-wider">{getTeamName(match?.team2Id)}</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {match?.team2SquadPlayerIds?.map((pid: string) => (
                          <Link key={pid} href={`/players/${pid}`}>
                            <Badge variant="outline" className="h-7 border-slate-200 hover:border-secondary hover:bg-secondary/5 transition-all group cursor-pointer">
                              <span className="text-[9px] font-bold text-slate-600 group-hover:text-secondary uppercase">{getPlayerName(pid)}</span>
                            </Badge>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 pt-4 border-t">
                  <Button className="w-full h-14 bg-secondary font-black uppercase shadow-lg group" onClick={handleShareImage} disabled={isSharing}>
                    {isSharing ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Share2 className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />} 
                    Generate HD Share Image
                  </Button>
                  <Button variant="outline" className="w-full h-12 font-black uppercase text-[10px] border-slate-200" onClick={() => {
                    const playerNamesMap = allPlayers?.reduce((acc, p) => ({ ...acc, [p.id]: p.name }), {}) || {};
                    const report = generateMatchReport(match, allTeams || [], playerNamesMap, inn1, inn2, stats1, stats2);
                    const blob = new Blob([report], { type: 'text/html' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url; a.download = `CricMates_${match?.id}.html`; a.click();
                  }}><Download className="w-4 h-4 mr-2" /> Download HTML Scorecard</Button>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Hidden Share Card for Export */}
      <div className="fixed -left-[2000px] top-0">
        <div ref={shareCardRef} className="w-[600px] p-10 bg-slate-50 font-body border-[12px] border-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-10 opacity-5"><Swords className="w-64 h-64" /></div>
          <div className="relative z-10 flex flex-col items-center text-center space-y-2 mb-10">
            <div className="p-2 bg-primary rounded-xl mb-2"><Trophy className="w-8 h-8 text-white" /></div>
            <h1 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Official League Record</h1>
            <div className="flex items-center gap-3">
              <span className="h-px w-8 bg-slate-300"></span>
              <h2 className="text-xl font-black uppercase text-slate-900 tracking-tighter">{match?.matchNumber || 'Match X'}</h2>
              <span className="h-px w-8 bg-slate-300"></span>
            </div>
            <p className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">{match?.venue || 'The Arena'} • {match?.matchDate ? new Date(match.matchDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</p>
          </div>

          <div className="flex justify-between items-center gap-6 mb-10">
            <div className="flex-1 text-center bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <p className="text-[10px] font-black uppercase text-slate-400 mb-2 truncate">{getTeamName(row1TeamId)}</p>
              <p className="text-4xl font-black text-slate-900">{stats1.total}/{stats1.wickets}</p>
              <p className="text-[10px] font-bold text-primary uppercase mt-1">({stats1.overs} Overs)</p>
            </div>
            <div className="bg-slate-900 text-white font-black h-12 w-12 rounded-full flex items-center justify-center text-sm shadow-xl">VS</div>
            <div className="flex-1 text-center bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <p className="text-[10px] font-black uppercase text-slate-400 mb-2 truncate">{getTeamName(row2TeamId)}</p>
              <p className="text-4xl font-black text-slate-900">{stats2.total}/{stats2.wickets}</p>
              <p className="text-[10px] font-bold text-secondary uppercase mt-1">({stats2.overs} Overs)</p>
            </div>
          </div>

          <div className="bg-primary text-white text-center py-4 px-6 rounded-2xl shadow-lg mb-8 font-black uppercase text-sm tracking-tight border-b-4 border-black/20">
            {match?.resultDescription || 'MATCH IN PROGRESS'}
          </div>

          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2"><Zap className="w-4 h-4 text-amber-500" /><h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Top Batters</h3></div>
              {[...stats1.batting, ...stats2.batting].sort((a,b) => b.runs - a.runs).slice(0, 3).map((b, i) => (
                <div key={i} className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-[11px] font-black uppercase text-slate-700 truncate max-w-[120px]">{getPlayerName(b.id)}</span>
                  <span className="text-[11px] font-black text-slate-900">{b.runs} <span className="text-[8px] opacity-40">({b.balls})</span></span>
                </div>
              ))}
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2"><Target className="w-4 h-4 text-emerald-500" /><h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Top Bowlers</h3></div>
              {[...stats1.bowling, ...stats2.bowling].sort((a,b) => b.wickets - a.wickets || a.runs - b.runs).slice(0, 3).map((b, i) => (
                <div key={i} className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-[11px] font-black uppercase text-slate-700 truncate max-w-[120px]">{getPlayerName(b.id)}</span>
                  <span className="text-[11px] font-black text-slate-900">{b.wickets}/{b.runs} <span className="text-[8px] opacity-40">({b.oversDisplay})</span></span>
                </div>
              ))}
            </div>
          </div>

          {match?.potmPlayerId && (
            <div className="bg-amber-50 border-2 border-amber-200 p-4 rounded-2xl flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="bg-amber-500 p-2 rounded-lg shadow-sm"><Star className="w-4 h-4 text-white fill-white" /></div>
                <div><p className="text-[8px] font-black uppercase text-amber-600 mb-0.5">Player of the Match</p><p className="text-sm font-black uppercase text-amber-900">{getPlayerName(match.potmPlayerId)}</p></div>
              </div>
              <div className="text-right"><p className="text-lg font-black text-amber-600 leading-none">{(matchCvpMap[match.potmPlayerId] || 0).toFixed(1)}</p><p className="text-[8px] font-black uppercase text-amber-400">PTS</p></div>
            </div>
          )}

          <div className="text-center pt-4 border-t border-slate-200"><p className="text-[8px] font-black uppercase text-slate-300 tracking-[0.5em]">Generated by CricMates Pro League Interface</p></div>
        </div>
      </div>

      {/* Dialogs */}
      <Dialog open={isMatchDetailsDialogOpen} onOpenChange={setIsMatchDetailsDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md rounded-3xl border-t-8 border-t-primary shadow-2xl z-[151]">
          <DialogHeader><DialogTitle className="font-black uppercase text-xl">Edit Match Details</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto scrollbar-hide px-1">
            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Match Number / Tag</Label><Input value={matchNumberForm} onChange={(e) => setMatchNumberForm(e.target.value)} placeholder="e.g. Match 1" className="h-14 font-bold" /></div>
            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Ground Name / Venue</Label><Input value={venueForm} onChange={(e) => setVenueForm(e.target.value)} placeholder="e.g. Lords Ground" className="h-14 font-bold" /></div>
            <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Date & Time</Label><Input type="datetime-local" value={matchDateForm} onChange={(e) => setMatchDateForm(e.target.value)} className="h-14 font-bold" /></div>
          </div>
          <DialogFooter><Button onClick={async () => { 
            const updates: any = { venue: venueForm, matchNumber: matchNumberForm };
            if (matchDateForm) updates.matchDate = new Date(matchDateForm).toISOString();
            await setDocumentNonBlocking(doc(db, 'matches', matchId), updates, { merge: true });
            setIsMatchDetailsDialogOpen(false);
            toast({ title: "Updated" });
          }} className="w-full h-14 bg-primary font-black uppercase shadow-xl">Save Changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPotmDialogOpen} onOpenChange={setIsPotmDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md rounded-3xl border-t-8 border-t-amber-500 shadow-2xl z-[151]">
          <DialogHeader><DialogTitle className="font-black uppercase text-xl text-amber-600">Declare POTM</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto px-1 scrollbar-hide">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400">Select Player (Ranked by CVP)</Label>
              <Select value={potmId} onValueChange={setPotmId}>
                <SelectTrigger className="h-14 font-bold"><SelectValue placeholder="Pick MVP" /></SelectTrigger>
                <SelectContent className="z-[200] max-h-[300px]" position="popper" sideOffset={4}>
                  <SelectItem value="none" className="font-bold">Not Decided</SelectItem>
                  {allPlayers?.filter(p => [...(match?.team1SquadPlayerIds || []), ...(match?.team2SquadPlayerIds || [])].includes(p.id))
                    .sort((a, b) => (matchCvpMap[b.id] || 0) - (matchCvpMap[a.id] || 0))
                    .map(p => (
                    <SelectItem key={p.id} value={p.id} className="font-bold">{p.name} ({(matchCvpMap[p.id] || 0).toFixed(1)} PTS)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={async () => { 
            await setDocumentNonBlocking(doc(db, 'matches', matchId), { potmPlayerId: potmId === 'none' ? '' : potmId }, { merge: true });
            setIsPotmDialogOpen(false);
            toast({ title: "POTM Recorded" });
          }} className="w-full h-14 bg-amber-600 font-black uppercase shadow-xl">Confirm</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCorrectionDialogOpen} onOpenChange={setIsCorrectionDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md rounded-3xl border-t-8 border-t-amber-500 shadow-2xl z-[151]">
          <DialogHeader><DialogTitle className="font-black uppercase text-xl text-amber-600">Correction</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto px-1 scrollbar-hide">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Striker</Label><Select value={correctionForm.strikerId || ''} onValueChange={(v) => setCorrectionForm({...correctionForm, strikerId: v})}><SelectTrigger className="h-12 font-bold"><SelectValue /></SelectTrigger><SelectContent className="z-[200] max-h-[250px]" position="popper">{allPlayers?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Bowler</Label><Select value={correctionForm.bowlerId || ''} onValueChange={(v) => setCorrectionForm({...correctionForm, bowlerId: v})}><SelectTrigger className="h-12 font-bold"><SelectValue /></SelectTrigger><SelectContent className="z-[200] max-h-[250px]" position="popper">{allPlayers?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Bat Runs</Label><Select value={(correctionForm.runs || 0).toString()} onValueChange={(v) => setCorrectionForm({...correctionForm, runs: parseInt(v)})}><SelectTrigger className="h-12 font-bold"><SelectValue /></SelectTrigger><SelectContent className="z-[200] max-h-[250px]" position="popper">{[0,1,2,3,4,6].map(r => <SelectItem key={r} value={r.toString()}>{r}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Extra</Label><Select value={correctionForm.extra || 'none'} onValueChange={(v) => setCorrectionForm({...correctionForm, extra: v})}><SelectTrigger className="h-12 font-bold"><SelectValue /></SelectTrigger><SelectContent className="z-[200] max-h-[250px]" position="popper"><SelectItem value="none">None</SelectItem><SelectItem value="wide">Wide</SelectItem><SelectItem value="noball">No Ball</SelectItem></SelectContent></Select></div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border">
              <Label className="text-[10px] font-black uppercase flex-1">Wicket/Retire?</Label>
              <Button variant={correctionForm.isWicket ? "destructive" : "outline"} size="sm" onClick={() => setCorrectionForm({...correctionForm, isWicket: !correctionForm.isWicket})} className="font-black h-8 uppercase text-[10px]">{correctionForm.isWicket ? "YES" : "NO"}</Button>
            </div>
            {correctionForm.isWicket && (
              <div className="space-y-3">
                <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Type</Label><Select value={correctionForm.wicketType || 'bowled'} onValueChange={(v) => setCorrectionForm({...correctionForm, wicketType: v})}><SelectTrigger className="h-12 font-bold"><SelectValue /></SelectTrigger><SelectContent className="z-[200] max-h-[250px]" position="popper"><SelectItem value="bowled">Bowled</SelectItem><SelectItem value="caught">Caught</SelectItem><SelectItem value="runout">Run Out</SelectItem><SelectItem value="stumped">Stumped</SelectItem><SelectItem value="retired">Retired</SelectItem></Select></div>
                <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Batter Out</Label><Select value={correctionForm.batterOutId || correctionForm.strikerId || ''} onValueChange={(v) => setCorrectionForm({...correctionForm, batterOutId: v})}><SelectTrigger className="h-12 font-bold"><SelectValue /></SelectTrigger><SelectContent className="z-[200] max-h-[250px]" position="popper"><SelectItem value={correctionForm.strikerId}>Striker</SelectItem><SelectItem value={correctionForm.nonStrikerId}>Non-Striker</SelectItem></SelectContent></Select></div>
              </div>
            )}
          </div>
          <DialogFooter><Button onClick={handleManualCorrection} className="w-full h-14 bg-amber-600 font-black uppercase shadow-xl">Apply Changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPlayerAssignmentOpen} onOpenChange={setIsPlayerAssignmentOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md rounded-3xl border-t-8 border-t-primary shadow-2xl z-[151]">
          <DialogHeader><DialogTitle className="font-black uppercase tracking-tight text-xl">Assign Positions</DialogTitle></DialogHeader>
          <div className="space-y-6 py-4 max-h-[60vh] overflow-y-auto px-1 scrollbar-hide">
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase">STRIKER</Label>
              <Select value={assignmentForm.strikerId || ''} onValueChange={(v) => setAssignmentForm({...assignmentForm, strikerId: v})}>
                <SelectTrigger className="h-14 font-black"><SelectValue placeholder="Pick Striker" /></SelectTrigger>
                <SelectContent className="z-[200] max-h-[250px]" position="popper">
                  {allPlayers?.filter(p => (match?.team1Id === activeInningData?.battingTeamId ? match?.team1SquadPlayerIds : match?.team2SquadPlayerIds)?.includes(p.id) && p.id !== assignmentForm.nonStrikerId).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase">NON-STRIKER</Label>
              <Select value={assignmentForm.nonStrikerId || ''} onValueChange={(v) => setAssignmentForm({...assignmentForm, nonStrikerId: v})}>
                <SelectTrigger className="h-14 font-black"><SelectValue placeholder="Pick Non-Striker" /></SelectTrigger>
                <SelectContent className="z-[200] max-h-[250px]" position="popper">
                  {allPlayers?.filter(p => (match?.team1Id === activeInningData?.battingTeamId ? match?.team1SquadPlayerIds : match?.team2SquadPlayerIds)?.includes(p.id) && p.id !== assignmentForm.strikerId).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase">BOWLER</Label>
              <Select value={assignmentForm.bowlerId || ''} onValueChange={(v) => setAssignmentForm({...assignmentForm, bowlerId: v})}>
                <SelectTrigger className="h-14 font-black"><SelectValue placeholder="Pick Bowler" /></SelectTrigger>
                <SelectContent className="z-[200] max-h-[250px]" position="popper">
                  {allPlayers?.filter(p => (activeInningData?.battingTeamId === match?.team1Id ? match?.team2SquadPlayerIds : match?.team1SquadPlayerIds)?.includes(p.id)).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={async () => { 
              const updates: any = {};
              if (assignmentForm.strikerId) updates.strikerPlayerId = assignmentForm.strikerId;
              if (assignmentForm.nonStrikerId) updates.nonStrikerPlayerId = assignmentForm.nonStrikerId;
              if (assignmentForm.bowlerId) updates.currentBowlerPlayerId = assignmentForm.bowlerId;
              await setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match?.currentInningNumber}`), updates, { merge: true });
              setIsPlayerAssignmentOpen(false);
              toast({ title: "Assignments Updated" });
            }} className="w-full h-16 bg-primary font-black uppercase rounded-2xl shadow-xl">Confirm</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isWicketDialogOpen} onOpenChange={setIsWicketDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md rounded-3xl border-t-8 border-t-destructive shadow-2xl z-[151]">
          <DialogHeader><DialogTitle className="font-black uppercase text-xl text-destructive">{wicketForm.type === 'retired' ? 'Retire Player' : 'Register Out'}</DialogTitle></DialogHeader>
          <div className="space-y-6 py-4 max-h-[60vh] overflow-y-auto px-1 scrollbar-hide">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400">Batter Out</Label>
              <Select value={wicketForm.batterOutId || ''} onValueChange={(v) => setWicketForm({...wicketForm, batterOutId: v})}>
                <SelectTrigger className="h-14 font-black border-2 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent className="z-[200] max-h-[250px]" position="popper">
                  {activeInningData?.strikerPlayerId && <SelectItem value={activeInningData.strikerPlayerId}>{getPlayerName(activeInningData.strikerPlayerId)} (Striker)</SelectItem>}
                  {activeInningData?.nonStrikerPlayerId && <SelectItem value={activeInningData.nonStrikerPlayerId}>{getPlayerName(activeInningData.nonStrikerPlayerId)} (Non-Striker)</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400">Type</Label>
              <Select value={wicketForm.type || 'bowled'} onValueChange={(v) => setWicketForm({...wicketForm, type: v, runsCompleted: 0, fielderId: 'none', successorId: ''})}>
                <SelectTrigger className="h-14 font-black border-2 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent className="z-[200] max-h-[250px]" position="popper"><SelectItem value="bowled">Bowled</SelectItem><SelectItem value="caught">Caught</SelectItem><SelectItem value="runout">Run Out</SelectItem><SelectItem value="stumped">Stumped</SelectItem><SelectItem value="retired">Retired</SelectItem></SelectContent>
              </Select>
            </div>
            {wicketForm.type === 'retired' && (
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-400">Successor</Label>
                <Select value={wicketForm.successorId || ''} onValueChange={(v) => setWicketForm({...wicketForm, successorId: v})}>
                  <SelectTrigger className="h-14 font-black border-2 rounded-xl border-primary/30"><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[200] max-h-[250px]" position="popper">
                    {allPlayers?.filter(p => (match?.team1Id === activeInningData?.battingTeamId ? match?.team1SquadPlayerIds : match?.team2SquadPlayerIds)?.includes(p.id) && p.id !== activeInningData?.strikerPlayerId && p.id !== activeInningData?.nonStrikerPlayerId).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {['caught', 'runout', 'stumped'].includes(wicketForm.type) && (
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-400">Fielder</Label>
                <Select value={wicketForm.fielderId || 'none'} onValueChange={(v) => setWicketForm({...wicketForm, fielderId: v})}>
                  <SelectTrigger className="h-14 font-black border-2 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[200] max-h-[250px]" position="popper">
                    <SelectItem value="none">Direct</SelectItem>
                    {allPlayers?.filter(p => (activeInningData?.battingTeamId === match?.team1Id ? match?.team2SquadPlayerIds : match?.team1SquadPlayerIds)?.includes(p.id)).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {wicketForm.type === 'runout' && (
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-400">Runs Completed</Label>
                <Select value={(wicketForm.runsCompleted || 0).toString()} onValueChange={(v) => setWicketForm({...wicketForm, runsCompleted: parseInt(v)})}>
                  <SelectTrigger className="h-14 font-black border-2 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[200] max-h-[250px]" position="popper">{[0, 1, 2, 3].map(r => <SelectItem key={r} value={r.toString()}>{r} Runs</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={async () => {
              const currId = `inning_${match?.currentInningNumber}`;
              const dId = doc(collection(db, 'temp')).id;
              await setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currId, 'deliveryRecords', dId), { 
                id: dId, strikerPlayerId: activeInningData?.strikerPlayerId || '', nonStrikerPlayerId: activeInningData?.nonStrikerPlayerId || '', bowlerId: activeInningData?.currentBowlerPlayerId || '', fielderPlayerId: wicketForm.fielderId || 'none', isWicket: true, dismissalType: wicketForm.type || 'bowled', batsmanOutPlayerId: wicketForm.batterOutId || '', successorPlayerId: wicketForm.successorId || '', extraType: 'none', runsScored: wicketForm.runsCompleted || 0, totalRunsOnDelivery: wicketForm.runsCompleted || 0, timestamp: Date.now() 
              }, { merge: true });
              await recalculateInningState(currId);
              setIsWicketDialogOpen(false);
              toast({ title: wicketForm.type === 'retired' ? "Retired" : "Out" });
            }} disabled={!wicketForm.batterOutId || (wicketForm.type === 'retired' && !wicketForm.successorId)} className={cn("w-full h-16 text-white font-black uppercase rounded-2xl shadow-xl", wicketForm.type === 'retired' ? "bg-slate-600" : "bg-destructive")}>Confirm</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isNoBallDialogOpen} onOpenChange={setIsNoBallDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md rounded-3xl border-t-8 border-t-amber-500 shadow-2xl z-[151]">
          <DialogHeader><DialogTitle className="font-black uppercase text-xl text-amber-600">No Ball</DialogTitle></DialogHeader>
          <div className="grid grid-cols-3 gap-3 py-4">
            {[0, 1, 2, 3, 4, 6].map(r => <Button key={r} onClick={() => handleRecordBall(r, 'noball')} variant="outline" className="h-16 font-black text-2xl border-amber-200">{r || '•'}</Button>)}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
