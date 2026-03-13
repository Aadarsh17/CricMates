
"use client"

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useMemoFirebase, useFirestore, useCollection, setDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, orderBy, limit, getDocs, writeBatch } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { History, Loader2, ArrowLeftRight, ShieldCheck, CheckCircle2, Settings2, Rewind, Download, Edit2, PlusCircle, Filter, Calendar, UserCheck, MapPin, Hash, ChevronLeft, Trash2, Share2, Star, Zap, Swords, Trophy, Target, Crown, Users, UserPlus, Undo2, RotateCcw, AlertTriangle, RefreshCw, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn, formatTeamName } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useApp } from '@/context/AppContext';
import { getExtendedInningStats } from '@/lib/report-utils';
import { calculatePlayerCVP } from '@/lib/cvp-utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toPng } from 'html-to-image';

export default function MatchScoreboardPage() {
  const params = useParams();
  const matchId = params.matchId as string;
  const db = useFirestore();
  const router = useRouter();
  const { isUmpire } = useApp();
  const [isMounted, setIsMounted] = useState(false);
  
  const [isWicketDialogOpen, setIsWicketDialogOpen] = useState(false);
  const [isPlayerAssignmentOpen, setIsPlayerAssignmentOpen] = useState(false);
  const [isMatchDetailsDialogOpen, setIsMatchDetailsDialogOpen] = useState(false);
  const [isPotmDialogOpen, setIsPotmDialogOpen] = useState(false);
  const [isRepairOpen, setIsRepairOpen] = useState(false);
  
  const [assignmentForm, setAssignmentForm] = useState({ strikerId: '', nonStrikerId: '', bowlerId: '' });
  const [isInjuryOverride, setIsInjuryOverride] = useState(false);
  const [wicketForm, setWicketForm] = useState({ type: 'bowled', batterOutId: '', extraType: 'none', runsCompleted: 0, fielderId: 'none', successorId: '' });
  
  const [repairTargetId, setRepairTargetId] = useState<string>('');
  const [replacementPlayerId, setReplacementPlayerId] = useState<string>('');
  const [isRepairing, setIsRepairing] = useState(false);

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
    return p ? p.name : '---';
  };

  const getTeamName = (tid: string) => {
    const t = allTeams?.find(t => t.id === tid);
    return t ? formatTeamName(t.name) : '---';
  };

  const activeInningData = useMemo(() => {
    if (!match) return null;
    return match.currentInningNumber === 1 ? inn1 : (match.currentInningNumber === 2 ? inn2 : null);
  }, [match?.currentInningNumber, inn1, inn2]);

  const currentBattingSquad = useMemo(() => {
    if (!match || !activeInningData) return [];
    return activeInningData.battingTeamId === match.team1Id ? match.team1SquadPlayerIds : match.team2SquadPlayerIds;
  }, [match, activeInningData]);

  const currentBowlingSquad = useMemo(() => {
    if (!match || !activeInningData) return [];
    return activeInningData.battingTeamId === match.team1Id ? match.team2SquadPlayerIds : match.team1SquadPlayerIds;
  }, [match, activeInningData]);

  const recalculateInningState = async (inningId: string) => {
    const inningRef = doc(db, 'matches', matchId, 'innings', inningId);
    const deliveriesRef = collection(db, 'matches', matchId, 'innings', inningId, 'deliveryRecords');
    const deliveriesSnap = await getDocs(query(deliveriesRef, orderBy('timestamp', 'asc')));
    const deliveries = deliveriesSnap.docs.map(d => d.data());

    // Fallback: If no balls, we reset to starting positions.
    // In a real pro app, we'd store openers in the Inning document.
    // For now, we assume the first ball recorded the initial openers.
    if (deliveries.length === 0) {
      await updateDocumentNonBlocking(inningRef, {
        score: 0,
        wickets: 0,
        oversCompleted: 0,
        ballsInCurrentOver: 0,
        currentBowlerPlayerId: '',
        isDeclaredFinished: false
      });
      return;
    }

    let score = 0, wkts = 0, legalCount = 0;
    let currentS = deliveries[0].strikerPlayerId;
    let currentNS = deliveries[0].nonStrikerPlayerId;
    let currentB = deliveries[0].bowlerId;

    deliveries.forEach((d, idx) => {
      score += (d.totalRunsOnDelivery || 0);
      if (d.isWicket && d.dismissalType !== 'retired') wkts++;
      if (d.extraType === 'none' && d.dismissalType !== 'retired') legalCount++;

      // Update strike based on this ball
      currentS = d.strikerPlayerId;
      currentNS = d.nonStrikerPlayerId;
      currentB = d.bowlerId;

      if (d.isWicket) {
        const outId = d.batsmanOutPlayerId || currentS;
        if (outId === currentS) currentS = d.successorPlayerId || '';
        else if (outId === currentNS) currentNS = d.successorPlayerId || '';
      } else {
        // Strike rotation on runs
        if (currentNS && !d.isDeclared && (d.runsScored || 0) % 2 !== 0) {
          [currentS, currentNS] = [currentNS, currentS];
        }
      }

      // Over rotation (if not the last ball being processed, or we want the state *after* this ball)
      if (currentNS && legalCount % 6 === 0 && d.extraType === 'none') {
        [currentS, currentNS] = [currentNS, currentS];
        currentB = ''; // Over finished, bowler clears
      }
    });

    await updateDocumentNonBlocking(inningRef, {
      score,
      wickets: wkts,
      oversCompleted: Math.floor(legalCount / 6),
      ballsInCurrentOver: legalCount % 6,
      strikerPlayerId: currentS || '',
      nonStrikerPlayerId: currentNS || '',
      currentBowlerPlayerId: legalCount % 6 === 0 ? '' : currentB,
      isDeclaredFinished: legalCount >= (match?.totalOvers || 0) * 6
    });
  };

  const handleRecordBall = async (runs: number, extra: any = 'none', isDeclared: boolean = false) => {
    if (!match || !activeInningData || !isUmpire || !activeInningData.currentBowlerPlayerId) return;
    const currentInningId = `inning_${match.currentInningNumber}`;
    const deliveryId = doc(collection(db, 'temp')).id;
    
    const dData = {
      id: deliveryId,
      strikerPlayerId: activeInningData.strikerPlayerId,
      nonStrikerPlayerId: activeInningData.nonStrikerPlayerId,
      bowlerId: activeInningData.currentBowlerPlayerId,
      runsScored: runs,
      extraType: extra,
      isDeclared: isDeclared,
      totalRunsOnDelivery: runs + (extra !== 'none' ? 1 : 0),
      isWicket: false,
      timestamp: Date.now()
    };

    await setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords', deliveryId), dData);
    await recalculateInningState(currentInningId);
  };

  const handleRecordWicket = async () => {
    if (!match || !activeInningData || !isUmpire || !wicketForm.batterOutId) return;
    const currentInningId = `inning_${match.currentInningNumber}`;
    const deliveryId = doc(collection(db, 'temp')).id;

    const dData = {
      id: deliveryId,
      strikerPlayerId: activeInningData.strikerPlayerId,
      nonStrikerPlayerId: activeInningData.nonStrikerPlayerId,
      bowlerId: activeInningData.currentBowlerPlayerId,
      runsScored: wicketForm.runsCompleted,
      extraType: wicketForm.extraType,
      totalRunsOnDelivery: wicketForm.runsCompleted + (wicketForm.extraType !== 'none' ? 1 : 0),
      isWicket: true,
      dismissalType: wicketForm.type,
      batsmanOutPlayerId: wicketForm.batterOutId,
      fielderPlayerId: wicketForm.fielderId,
      successorPlayerId: wicketForm.successorId,
      timestamp: Date.now()
    };

    await setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords', deliveryId), dData);
    await recalculateInningState(currentInningId);
    setIsWicketDialogOpen(false);
    setWicketForm({ type: 'bowled', batterOutId: '', extraType: 'none', runsCompleted: 0, fielderId: 'none', successorId: '' });
  };

  const handleUndo = async () => {
    const currId = `inning_${match?.currentInningNumber}`;
    const snap = await getDocs(query(collection(db, 'matches', matchId, 'innings', currId, 'deliveryRecords'), orderBy('timestamp', 'desc'), limit(1)));
    if (!snap.empty) {
      await deleteDocumentNonBlocking(snap.docs[0].ref);
      await recalculateInningState(currId);
      toast({ title: "Action Reverted" });
    }
  };

  const handleRepairMatchData = async () => {
    if (!repairTargetId || !replacementPlayerId) return;
    setIsRepairing(true);
    try {
      const batch = writeBatch(db);
      const innings = ['inning_1', 'inning_2'];
      for (const innId of innings) {
        const delRef = collection(db, 'matches', matchId, 'innings', innId, 'deliveryRecords');
        const snap = await getDocs(delRef);
        snap.docs.forEach(docSnap => {
          const d = docSnap.data();
          const updates: any = {};
          if (d.strikerPlayerId === repairTargetId) updates.strikerPlayerId = replacementPlayerId;
          if (d.nonStrikerPlayerId === repairTargetId) updates.nonStrikerPlayerId = replacementPlayerId;
          if (d.bowlerId === repairTargetId || d.bowlerPlayerId === repairTargetId) updates.bowlerId = replacementPlayerId;
          if (d.batsmanOutPlayerId === repairTargetId) updates.batsmanOutPlayerId = replacementPlayerId;
          if (d.fielderPlayerId === repairTargetId) updates.fielderPlayerId = replacementPlayerId;
          if (d.successorPlayerId === repairTargetId) updates.successorPlayerId = replacementPlayerId;
          if (Object.keys(updates).length > 0) batch.update(docSnap.ref, updates);
        });
      }
      await batch.commit();
      await recalculateInningState('inning_1');
      await recalculateInningState('inning_2');
      toast({ title: "Scorecard Repaired" });
      setIsRepairOpen(false);
    } catch (e) {
      toast({ title: "Repair Failed", variant: "destructive" });
    } finally {
      setIsRepairing(false);
    }
  };

  const handleFinalizeMatch = async () => {
    const s1 = stats1.total;
    const s2 = stats2.total;
    const bat1Id = inn1?.battingTeamId || match?.team1Id;
    const bat2Id = inn2?.battingTeamId || (bat1Id === match?.team1Id ? match?.team2Id : match?.team1Id);
    let result = "Match Completed";
    let winnerId = "";
    let isTie = false;

    if (s1 > s2) { winnerId = bat1Id; result = `${getTeamName(bat1Id || '')} won by ${s1 - s2} runs`; }
    else if (s2 > s1) { winnerId = bat2Id; const wLeft = Math.max(0, (currentBattingSquad?.length || 11) - 1 - stats2.wickets); result = `${getTeamName(bat2Id || '')} won by ${wLeft} wickets`; }
    else { isTie = true; result = "Match Tied"; }

    await updateDocumentNonBlocking(doc(db, 'matches', matchId), { status: 'completed', resultDescription: result, winnerTeamId: winnerId || 'none', isTie: isTie });
    toast({ title: "Official Finalization Complete" });
  };

  const isBowlerLocked = useMemo(() => {
    if (!activeInningData) return false;
    return !isInjuryOverride && (activeInningData.ballsInCurrentOver || 0) > 0 && !!activeInningData.currentBowlerPlayerId;
  }, [activeInningData, isInjuryOverride]);

  if (!isMounted || isMatchLoading) return <div className="flex flex-col items-center justify-center min-h-screen"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 max-w-lg mx-auto pb-32 relative px-1">
      {/* Dynamic Floating Scoreboard */}
      <div className="fixed top-16 left-0 right-0 z-[90] bg-white text-slate-950 shadow-2xl px-6 py-4 border-b-4 border-slate-300">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/matches')} className="h-8 w-8 shrink-0"><ChevronLeft className="w-6 h-6" /></Button>
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-3"><span className="font-black uppercase text-[11px] text-slate-700 max-w-[120px] tracking-tight">{getTeamName(inn1?.battingTeamId || match?.team1Id)}</span><span className="font-black text-2xl leading-none text-slate-950">{stats1.total}/{stats1.wickets}</span><Badge variant="outline" className="text-[11px] font-black h-6 bg-slate-100 px-2">({stats1.overs})</Badge></div>
            <div className="flex items-center gap-3"><span className="font-black uppercase text-[11px] text-slate-700 max-w-[120px] tracking-tight">{getTeamName(inn2?.battingTeamId || (inn1?.battingTeamId === match?.team1Id ? match?.team2Id : match?.team1Id))}</span><span className="font-black text-2xl leading-none text-slate-950">{stats2.total}/{stats2.wickets}</span><Badge variant="outline" className="text-[11px] font-black h-6 bg-slate-100 px-2">({stats2.overs})</Badge></div>
          </div>
          <div className="text-right flex flex-col items-end gap-1">
            {match?.status === 'live' && <Badge variant="destructive" className="animate-pulse text-[10px] h-6 font-black uppercase px-3 shadow-md border-2 border-white">LIVE</Badge>}
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{match?.matchNumber || 'Match X'}</span>
          </div>
        </div>
      </div>

      <div className="pt-32">
        <Tabs defaultValue="live" className="w-full">
          <TabsList className="grid w-full grid-cols-4 h-12 bg-slate-100 p-1 rounded-xl mb-6 sticky top-[120px] z-[80] shadow-sm">
            <TabsTrigger value="live" className="font-black text-[9px] uppercase">Live</TabsTrigger>
            <TabsTrigger value="scorecard" className="font-black text-[9px] uppercase">Score</TabsTrigger>
            <TabsTrigger value="history" className="font-black text-[9px] uppercase">History</TabsTrigger>
            <TabsTrigger value="info" className="font-black text-[9px] uppercase">Info</TabsTrigger>
          </TabsList>

          <TabsContent value="live" className="space-y-6">
            {isUmpire && (
              <Card className="bg-slate-900 border-none rounded-3xl overflow-hidden shadow-2xl">
                <CardContent className="p-6 space-y-6">
                  <div className="flex gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="outline" className="flex-1 h-12 border-primary/20 text-primary font-black uppercase text-[9px] bg-white/5"><ShieldCheck className="w-4 h-4 mr-2" /> Match Actions</Button></DropdownMenuTrigger>
                      <DropdownMenuContent className="w-56 rounded-xl" align="end">
                        <DropdownMenuItem className="font-bold py-3" onClick={handleUndo}><Undo2 className="w-4 h-4 mr-2 text-rose-500" /> Undo Ball</DropdownMenuItem>
                        <DropdownMenuItem className="font-bold py-3" onClick={() => setIsPotmDialogOpen(true)}><UserCheck className="w-4 h-4 mr-2 text-amber-500" /> Declare POTM</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="font-bold py-3" onClick={handleFinalizeMatch}><ShieldCheck className="w-4 h-4 mr-2 text-emerald-500" /> Finalize Match</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="outline" onClick={() => setIsPlayerAssignmentOpen(true)} className="flex-1 h-12 border-secondary/20 text-secondary font-black uppercase text-[9px] bg-white/5"><Settings2 className="w-4 h-4 mr-2" /> Assign Ends</Button>
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
            )}

            <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
              <Table>
                <TableHeader className="bg-slate-50"><TableRow><TableHead className="text-[9px] font-black uppercase">Live Striker</TableHead><TableHead className="text-right text-[9px] font-black uppercase">R</TableHead><TableHead className="text-right text-[9px] font-black uppercase">B</TableHead><TableHead className="text-right text-[9px] font-black uppercase">SR</TableHead></TableRow></TableHeader>
                <TableBody>{[activeInningData?.strikerPlayerId, activeInningData?.nonStrikerPlayerId].map((pid, idx) => {
                    if (!pid || pid === 'none') return null;
                    const stats = match?.currentInningNumber === 1 ? stats1 : stats2;
                    const b = stats.batting.find((p: any) => p?.id === pid) || { runs: 0, balls: 0 };
                    const name = getPlayerName(pid);
                    return (
                      <TableRow key={pid} className={idx === 0 ? "bg-primary/5" : ""}>
                        <TableCell className="font-black text-xs uppercase py-3 truncate max-w-[140px]">{name}{idx === 0 ? '*' : ''}</TableCell>
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
                              <div className="flex items-center gap-2"><p className={cn("font-black text-xs uppercase", name === '---' ? "text-amber-600" : "text-slate-900")}>{name}</p></div>
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

      {/* Wicket Dialog - SLOT SPECIFIC */}
      <Dialog open={isWicketDialogOpen} onOpenChange={setIsWicketDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md rounded-3xl border-t-8 border-t-destructive shadow-2xl z-[200]">
          <DialogHeader><DialogTitle className="font-black uppercase text-xl text-destructive">Wicket Event</DialogTitle></DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400">Who is Out?</Label>
              <Select value={wicketForm.batterOutId} onValueChange={(v) => setWicketForm({...wicketForm, batterOutId: v})}>
                <SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Select dismissed player" /></SelectTrigger>
                <SelectContent className="z-[250]">
                  {activeInningData?.strikerPlayerId && <SelectItem value={activeInningData.strikerPlayerId}>Striker: {getPlayerName(activeInningData.strikerPlayerId)}</SelectItem>}
                  {activeInningData?.nonStrikerPlayerId && <SelectItem value={activeInningData.nonStrikerPlayerId}>Non-Striker: {getPlayerName(activeInningData.nonStrikerPlayerId)}</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Dismissal Type</Label><Select value={wicketForm.type} onValueChange={(v) => setWicketForm({...wicketForm, type: v})}><SelectTrigger className="font-bold h-12"><SelectValue /></SelectTrigger><SelectContent className="z-[250]"><SelectItem value="bowled">Bowled</SelectItem><SelectItem value="caught">Caught</SelectItem><SelectItem value="runout">Run Out</SelectItem><SelectItem value="stumped">Stumped</SelectItem><SelectItem value="lbw">LBW</SelectItem><SelectItem value="retired">Retired</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase text-slate-400">Fielder (Optional)</Label><Select value={wicketForm.fielderId} onValueChange={(v) => setWicketForm({...wicketForm, fielderId: v})}><SelectTrigger className="font-bold h-12"><SelectValue /></SelectTrigger><SelectContent className="z-[250]"><SelectItem value="none">N/A</SelectItem>{allPlayers?.filter(p => currentBowlingSquad?.includes(p.id)).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
            </div>

            <div className="space-y-2 pt-4 border-t">
              <Label className="text-[10px] font-black uppercase text-slate-400">Successor (Next Batter)</Label>
              <Select value={wicketForm.successorId} onValueChange={(v) => setWicketForm({...wicketForm, successorId: v})}>
                <SelectTrigger className="h-14 font-black text-lg border-primary/20"><SelectValue placeholder="Pick next batter" /></SelectTrigger>
                <SelectContent className="z-[250]">
                  <SelectItem value="none">Inning Ends / No Successor</SelectItem>
                  {allPlayers?.filter(p => currentBattingSquad?.includes(p.id) && p.id !== activeInningData?.strikerPlayerId && p.id !== activeInningData?.nonStrikerPlayerId).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={handleRecordWicket} disabled={!wicketForm.batterOutId} className="w-full h-14 bg-destructive font-black uppercase shadow-xl">Confirm Dismissal</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Position Assignment Dialog */}
      <Dialog open={isPlayerAssignmentOpen} onOpenChange={setIsPlayerAssignmentOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md rounded-3xl border-t-8 border-t-primary shadow-2xl z-[200]">
          <DialogHeader><DialogTitle className="font-black uppercase text-xl">Official Assignment</DialogTitle></DialogHeader>
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-400">Striker</Label>
                <Select value={assignmentForm.strikerId} onValueChange={(v) => setAssignmentForm({...assignmentForm, strikerId: v})}>
                  <SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Striker" /></SelectTrigger>
                  <SelectContent className="z-[250]">{allPlayers?.filter(p => currentBattingSquad?.includes(p.id)).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-400">Non-Striker</Label>
                <Select value={assignmentForm.nonStrikerId || 'none'} onValueChange={(v) => setAssignmentForm({...assignmentForm, nonStrikerId: v === 'none' ? '' : v})}>
                  <SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Non-Striker" /></SelectTrigger>
                  <SelectContent className="z-[250]"><SelectItem value="none">No Non-Striker</SelectItem>{allPlayers?.filter(p => currentBattingSquad?.includes(p.id) && p.id !== assignmentForm.strikerId).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t">
              <div className="flex justify-between items-center">
                <Label className="text-[10px] font-black uppercase text-slate-400">Current Bowler</Label>
                {isBowlerLocked && (
                  <Badge variant="outline" className="text-[8px] font-black text-amber-600 border-amber-200">LOCKED (Over in Progress)</Badge>
                )}
              </div>
              <Select 
                value={assignmentForm.bowlerId} 
                onValueChange={(v) => setAssignmentForm({...assignmentForm, bowlerId: v})}
                disabled={isBowlerLocked}
              >
                <SelectTrigger className={cn("h-14 font-black text-lg", isBowlerLocked && "opacity-50 grayscale")}>
                  <SelectValue placeholder="Assign Bowler" />
                </SelectTrigger>
                <SelectContent className="z-[250]">{allPlayers?.filter(p => currentBowlingSquad?.includes(p.id)).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
              
              {isBowlerLocked && (
                <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <Switch 
                    id="injury-override" 
                    checked={isInjuryOverride} 
                    onCheckedChange={setIsInjuryOverride} 
                  />
                  <Label htmlFor="injury-override" className="text-[10px] font-black uppercase text-amber-700 leading-none">Force Change (Injury/Emergency)</Label>
                </div>
              )}
            </div>
          </div>
          <DialogFooter><Button onClick={async () => {
            const updates = { strikerPlayerId: assignmentForm.strikerId, nonStrikerPlayerId: assignmentForm.nonStrikerId || '', currentBowlerPlayerId: assignmentForm.bowlerId };
            await setDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match?.currentInningNumber}`), updates);
            setIsPlayerAssignmentOpen(false);
            toast({ title: "Ends Assigned" });
          }} className="w-full h-14 bg-primary font-black uppercase shadow-xl">Apply Assignments</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Repair Scorecard Dialog */}
      <Dialog open={isRepairOpen} onOpenChange={setIsRepairOpen}><DialogContent className="max-w-[95vw] sm:max-w-md rounded-3xl border-t-8 border-t-amber-500 shadow-2xl z-[200]"><DialogHeader><DialogTitle className="font-black uppercase text-xl text-amber-600 flex items-center gap-2"><AlertTriangle className="w-6 h-6" /> Repair Scorecard</DialogTitle></DialogHeader><div className="space-y-6 py-4"><div className="bg-amber-50 p-4 rounded-2xl border border-amber-100"><p className="text-[10px] font-black uppercase text-amber-600 mb-1">Target Unknown ID</p><code className="text-xs font-bold break-all">{repairTargetId}</code></div><div className="space-y-2"><Label className="text-xs font-black uppercase">Assign To Profile</Label><Select value={replacementPlayerId} onValueChange={setReplacementPlayerId}><SelectTrigger className="h-14 font-bold"><SelectValue placeholder="Pick replacement player" /></SelectTrigger><SelectContent className="z-[250] max-h-[250px]">{allPlayers?.map(p => <SelectItem key={p.id} value={p.id} className="font-bold">{p.name}</SelectItem>)}</SelectContent></Select></div></div><DialogFooter><Button onClick={handleRepairMatchData} disabled={!replacementPlayerId || isRepairing} className="w-full h-14 bg-amber-600 font-black uppercase shadow-xl">{isRepairing ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <RefreshCw className="w-5 h-5 mr-2" />} Re-map All Entries</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
