
"use client"

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDoc, useMemoFirebase, useFirestore, useUser, useCollection, updateDocumentNonBlocking, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, orderBy, getDocs, limit } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Trophy, Info, ArrowLeftRight, Trash2, Download, Loader2, Zap, LineChart as LineChartIcon, BarChart, ChevronRight, History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from '@/components/ui/table';
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area, Line, BarChart as ReBarChart, Bar, Cell } from "recharts";
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useApp } from '@/context/AppContext';
import { generateHTMLReport, getExtendedInningStats, getMatchFlow } from '@/lib/report-utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

const CustomWicketDot = (props: any) => {
  const { cx, cy, value, stroke } = props;
  if (value === null || value === undefined) return null;
  return (
    <g key={`wkt-dot-${cx}-${cy}`}>
      <circle cx={cx} cy={cy} r={7} fill={stroke} stroke="#fff" strokeWidth={1} />
      <text x={cx} y={cy} dy={3} textAnchor="middle" fill="white" fontSize="8px" fontWeight="900">W</text>
    </g>
  );
};

export default function MatchScoreboardPage() {
  const params = useParams();
  const matchId = params.matchId as string;
  const db = useFirestore();
  const { isUmpire } = useApp();
  
  const [isMounted, setIsMounted] = useState(false);
  const [isWicketDialogOpen, setIsWicketDialogOpen] = useState(false);
  const [isPlayerAssignmentOpen, setIsPlayerAssignmentOpen] = useState(false);
  const [isEditFullMatchOpen, setIsEditFullMatchOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('live');
  const [activeInningView, setActiveInningView] = useState<number>(1);
  const [activeScorecardSubTab, setActiveScorecardSubTab] = useState<'inn1' | 'inn2' | 'flow'>('inn1');
  const [isUndoing, setIsUndoing] = useState(false);

  const [wicketForm, setWicketForm] = useState({
    type: 'bowled',
    batterOutId: '',
    fielderId: 'none',
    decision: 'next'
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const matchRef = useMemoFirebase(() => doc(db, 'matches', matchId), [db, matchId]);
  const { data: match, isLoading: isMatchLoading } = useDoc(matchRef);

  const inn1Ref = useMemoFirebase(() => doc(db, 'matches', matchId, 'innings', 'inning_1'), [db, matchId]);
  const { data: inn1 } = useDoc(inn1Ref);
  const inn2Ref = useMemoFirebase(() => doc(db, 'matches', matchId, 'innings', 'inning_2'), [db, matchId]);
  const { data: inn2 } = useDoc(inn2Ref);

  const inn1DeliveriesQuery = useMemoFirebase(() => 
    query(collection(db, 'matches', matchId, 'innings', 'inning_1', 'deliveryRecords'), orderBy('timestamp', 'asc')), 
    [db, matchId]
  );
  const { data: inn1Deliveries, isLoading: isInn1Loading } = useCollection(inn1DeliveriesQuery);

  const inn2DeliveriesQuery = useMemoFirebase(() => 
    query(collection(db, 'matches', matchId, 'innings', 'inning_2', 'deliveryRecords'), orderBy('timestamp', 'asc')), 
    [db, matchId]
  );
  const { data: inn2Deliveries, isLoading: isInn2Loading } = useCollection(inn2DeliveriesQuery);

  const allPlayersQuery = useMemoFirebase(() => query(collection(db, 'players'), orderBy('name', 'asc')), [db]);
  const { data: allPlayers } = useCollection(allPlayersQuery);

  const allTeamsQuery = useMemoFirebase(() => query(collection(db, 'teams')), [db]);
  const { data: allTeams } = useCollection(allTeamsQuery);

  const activeInningData = useMemo(() => {
    if (!match) return null;
    return match.currentInningNumber === 1 ? inn1 : (match.currentInningNumber === 2 ? inn2 : null);
  }, [match?.currentInningNumber, inn1, inn2]);

  const getPlayerName = (pid: string) => {
    if (!pid || pid === 'none' || pid === '') return '---';
    return allPlayers?.find(p => p.id === pid)?.name || '---';
  };

  const getPlayerRole = (pid: string) => {
    if (!pid || pid === 'none' || pid === '') return '';
    return allPlayers?.find(p => p.id === pid)?.role || '';
  };

  const getTeamName = (tid: string) => {
    if (!tid) return '---';
    return allTeams?.find(t => t.id === tid)?.name || 'Unknown Team';
  };

  const stats1 = useMemo(() => getExtendedInningStats(inn1Deliveries || []), [inn1Deliveries]);
  const stats2 = useMemo(() => getExtendedInningStats(inn2Deliveries || []), [inn2Deliveries]);

  const overGroups1 = useMemo(() => {
    if (!inn1Deliveries) return null;
    const groups: Record<number, any[]> = {};
    inn1Deliveries.forEach(d => {
      if (!groups[d.overNumber]) groups[d.overNumber] = [];
      groups[d.overNumber].push(d);
    });
    return groups;
  }, [inn1Deliveries]);

  const overGroups2 = useMemo(() => {
    if (!inn2Deliveries) return null;
    const groups: Record<number, any[]> = {};
    inn2Deliveries.forEach(d => {
      if (!groups[d.overNumber]) groups[d.overNumber] = [];
      groups[d.overNumber].push(d);
    });
    return groups;
  }, [inn2Deliveries]);

  const wormData = useMemo(() => {
    const data: any[] = [];
    const maxBalls = Math.max(inn1Deliveries?.length || 0, inn2Deliveries?.length || 0);
    let score1 = 0; let score2 = 0;
    for (let i = 0; i < maxBalls; i++) {
      const d1 = inn1Deliveries?.[i]; const d2 = inn2Deliveries?.[i];
      if (d1) score1 += (d1.totalRunsOnDelivery || 0);
      if (d2) score2 += (d2.totalRunsOnDelivery || 0);
      data.push({ 
        ball: i + 1, 
        team1: d1 ? score1 : null, 
        team2: d2 ? score2 : null, 
        team1Wicket: d1?.isWicket && d1.dismissalType !== 'retired' ? score1 : null, 
        team2Wicket: d2?.isWicket && d2.dismissalType !== 'retired' ? score2 : null 
      });
    }
    return data;
  }, [inn1Deliveries, inn2Deliveries]);

  const manhattanData = useMemo(() => {
    const currentDeliveries = activeInningView === 1 ? inn1Deliveries : inn2Deliveries;
    if (!currentDeliveries) return [];
    const overs: Record<number, { over: number, runs: number, wickets: number }> = {};
    currentDeliveries.forEach(d => {
      const oNum = d.overNumber;
      if (!overs[oNum]) overs[oNum] = { over: oNum, runs: 0, wickets: 0 };
      overs[oNum].runs += (d.totalRunsOnDelivery || 0);
      if (d.isWicket && d.dismissalType !== 'retired') overs[oNum].wickets += 1;
    });
    return Object.values(overs).sort((a, b) => a.over - b.over);
  }, [activeInningView, inn1Deliveries, inn2Deliveries]);

  const flowEvents = useMemo(() => {
    if (!match || !allPlayers) return [];
    const flow1 = getMatchFlow(inn1Deliveries || [], getTeamName(inn1?.battingTeamId), allPlayers || []);
    const flow2 = getMatchFlow(inn2Deliveries || [], getTeamName(inn2?.battingTeamId), allPlayers || []);
    return [...flow1, ...flow2];
  }, [match, inn1Deliveries, inn2Deliveries, allPlayers, inn1?.battingTeamId, inn2?.battingTeamId]);

  const handleRecordBall = async (runs: number, extraType: 'none' | 'wide' | 'noball' | 'bye' | 'legbye' = 'none', noStrikeChange: boolean = false) => {
    if (!match || !activeInningData || !isUmpire) return;
    
    if (!activeInningData.currentBowlerPlayerId) {
      setIsPlayerAssignmentOpen(true);
      toast({ title: "Assign Bowler", description: "Select a bowler to continue the over." });
      return;
    }

    const currentInningId = `inning_${match.currentInningNumber}`;
    let ballRuns = runs; let extraRuns = 0; let isLegalBall = true;
    if (extraType === 'wide') { extraRuns = runs + 1; ballRuns = 0; isLegalBall = false; }
    else if (extraType === 'noball') { extraRuns = 1; ballRuns = runs; isLegalBall = false; }
    else if (extraType === 'bye' || extraType === 'legbye') { extraRuns = runs; ballRuns = 0; }
    const totalRunsOnDelivery = ballRuns + extraRuns;
    const newScore = activeInningData.score + totalRunsOnDelivery;
    let newBalls = activeInningData.ballsInCurrentOver + (isLegalBall ? 1 : 0);
    let newOvers = activeInningData.oversCompleted;
    
    let shouldClearBowler = false;
    if (newBalls === 6) { 
      newOvers += 1; 
      newBalls = 0; 
      shouldClearBowler = true;
    }

    const deliveryData = { 
      id: doc(collection(db, 'temp')).id, 
      overNumber: newBalls === 0 && isLegalBall ? newOvers : newOvers + 1, 
      ballNumberInOver: newBalls === 0 && isLegalBall ? 6 : newBalls, 
      strikerPlayerId: activeInningData.strikerPlayerId, 
      nonStrikerPlayerId: activeInningData.nonStrikerPlayerId || 'none', 
      bowlerId: activeInningData.currentBowlerPlayerId, 
      runsScored: ballRuns, 
      extraRuns, 
      extraType, 
      totalRunsOnDelivery, 
      isWicket: false, 
      timestamp: Date.now(), 
      noStrikeChange 
    };
    addDocumentNonBlocking(collection(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords'), deliveryData);
    
    const updates: any = { score: newScore, oversCompleted: newOvers, ballsInCurrentOver: newBalls };
    if (shouldClearBowler) updates.currentBowlerPlayerId = '';
    
    if (!activeInningData.isLastManActive && !noStrikeChange) { 
      if (runs % 2 !== 0) { 
        updates.strikerPlayerId = activeInningData.nonStrikerPlayerId; 
        updates.nonStrikerPlayerId = activeInningData.strikerPlayerId; 
      } 
    }
    
    updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currentInningId), updates);
    if (shouldClearBowler) {
      toast({ title: "Over Complete", description: "Assign a new bowler for the next over." });
      setIsPlayerAssignmentOpen(true);
    }
  };

  const handleSwapStrike = () => {
    if (!match || !activeInningData || !isUmpire || activeInningData.isLastManActive) return;
    updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match.currentInningNumber}`), { strikerPlayerId: activeInningData.nonStrikerPlayerId, nonStrikerPlayerId: activeInningData.strikerPlayerId });
    toast({ title: "Strikers Swapped" });
  };

  const handleWicket = async () => {
    if (!match || !activeInningData || !isUmpire || !wicketForm.batterOutId) return;
    const currentInningId = `inning_${match.currentInningNumber}`;
    
    const isLegalBall = true;
    let newBalls = activeInningData.ballsInCurrentOver + 1; 
    let newOvers = activeInningData.oversCompleted;
    let shouldClearBowler = false;
    if (newBalls === 6) { 
      newOvers += 1; 
      newBalls = 0; 
      shouldClearBowler = true;
    }

    const deliveryData = { id: doc(collection(db, 'temp')).id, overNumber: newBalls === 0 ? newOvers : newOvers + 1, ballNumberInOver: newBalls === 0 ? 6 : newBalls, strikerPlayerId: activeInningData.strikerPlayerId, nonStrikerPlayerId: activeInningData.nonStrikerPlayerId || 'none', bowlerId: activeInningData.currentBowlerPlayerId, runsScored: 0, extraRuns: 0, extraType: 'none', totalRunsOnDelivery: 0, isWicket: true, dismissalType: wicketForm.type, batsmanOutPlayerId: wicketForm.batterOutId, fielderPlayerId: wicketForm.fielderId, timestamp: Date.now() };
    addDocumentNonBlocking(collection(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords'), deliveryData);
    
    const newWickets = activeInningData.wickets + (wicketForm.type === 'retired' ? 0 : 1);
    const updates: any = { wickets: newWickets, oversCompleted: newOvers, ballsInCurrentOver: newBalls };
    if (shouldClearBowler) updates.currentBowlerPlayerId = '';
    
    if (wicketForm.decision === 'finish') updates.isDeclaredFinished = true;
    else if (wicketForm.decision === 'last_man') { updates.isLastManActive = true; updates.strikerPlayerId = wicketForm.batterOutId === activeInningData.strikerPlayerId ? activeInningData.nonStrikerPlayerId : activeInningData.strikerPlayerId; updates.nonStrikerPlayerId = ''; }
    else { updates.strikerPlayerId = wicketForm.batterOutId === activeInningData.strikerPlayerId ? '' : activeInningData.strikerPlayerId; updates.nonStrikerPlayerId = wicketForm.batterOutId === activeInningData.nonStrikerPlayerId ? '' : activeInningData.nonStrikerPlayerId; }
    
    updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currentInningId), updates);
    setIsWicketDialogOpen(false); 
    toast({ title: "OUT!", variant: "destructive" });
    if (shouldClearBowler) setIsPlayerAssignmentOpen(true);
  };

  const handleUndoLastBall = async () => {
    if (!match || !activeInningData || !isUmpire || isUndoing) return;
    setIsUndoing(true);
    const currentInningId = `inning_${match.currentInningNumber}`;
    const q = query(collection(db, 'matches', matchId, 'innings', currentInningId, 'deliveryRecords'), orderBy('timestamp', 'desc'), limit(1));
    
    try {
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        toast({ title: "No more balls to undo", variant: "destructive" });
        return;
      }
      
      const lastBallDoc = snapshot.docs[0];
      const lastBall = lastBallDoc.data();
      
      let { score, wickets, oversCompleted, ballsInCurrentOver, strikerPlayerId, nonStrikerPlayerId, isLastManActive } = activeInningData;
      
      // 1. Revert Score
      score -= (lastBall.totalRunsOnDelivery || 0);
      
      // 2. Revert Wickets and Batter positions
      if (lastBall.isWicket) {
        if (lastBall.dismissalType !== 'retired') wickets -= 1;
        strikerPlayerId = lastBall.strikerPlayerId;
        nonStrikerPlayerId = lastBall.nonStrikerPlayerId === 'none' ? '' : lastBall.nonStrikerPlayerId;
        isLastManActive = lastBall.nonStrikerPlayerId === 'none';
      } else if (!isLastManActive && !lastBall.noStrikeChange && lastBall.runsScored % 2 !== 0) {
        // Revert Strike Swap for odd runs
        const temp = strikerPlayerId;
        strikerPlayerId = nonStrikerPlayerId;
        nonStrikerPlayerId = temp;
      }
      
      // 3. Revert Overs/Balls
      const isLegal = lastBall.extraType !== 'wide' && lastBall.extraType !== 'noball' && lastBall.dismissalType !== 'retired';
      if (isLegal) {
        if (ballsInCurrentOver === 0) {
          oversCompleted -= 1;
          ballsInCurrentOver = 5;
        } else {
          ballsInCurrentOver -= 1;
        }
      }
      
      // 4. Revert Bowler
      const newBowlerId = lastBall.bowlerId || lastBall.bowlerPlayerId;

      const updates = { 
        score: Math.max(0, score), 
        wickets: Math.max(0, wickets), 
        oversCompleted: Math.max(0, oversCompleted), 
        ballsInCurrentOver: Math.max(0, ballsInCurrentOver), 
        strikerPlayerId, 
        nonStrikerPlayerId, 
        isLastManActive, 
        isDeclaredFinished: false,
        currentBowlerPlayerId: newBowlerId
      };
      
      updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', currentInningId), updates);
      deleteDocumentNonBlocking(lastBallDoc.ref);
      toast({ title: "Last Ball Undone" });
    } catch (e) {
      console.error(e);
      toast({ title: "Undo Failed", variant: "destructive" });
    } finally {
      setIsUndoing(false);
    }
  };

  const chaseLogic = (() => {
    if (match?.currentInningNumber !== 2 || !inn1 || !inn2 || match.status === 'completed') return null;
    const target = (inn1.score || 0) + 1;
    const runsNeeded = Math.max(0, target - (inn2.score || 0));
    const totalBalls = match.totalOvers * 6;
    const ballsBowled = (inn2.oversCompleted * 6) + (inn2.ballsInCurrentOver || 0);
    const ballsRemaining = Math.max(0, totalBalls - ballsBowled);
    const crr = ballsBowled > 0 ? ((inn2.score / (ballsBowled / 6))).toFixed(2) : '0.00';
    const rrr = ballsRemaining > 0 ? ((runsNeeded / (ballsRemaining / 6))).toFixed(2) : '---';
    return { runsNeeded, ballsRemaining, crr, rrr, target };
  })();

  const PartnershipRow = ({ p }: { p: any }) => {
    const totalRuns = p.runs || 0;
    const b1Runs = p.batter1Runs || 0;
    const b1Pct = totalRuns > 0 ? (b1Runs / totalRuns) * 100 : 50;
    return (
      <div className="space-y-1 py-3 border-b last:border-none">
        <div className="flex justify-between items-center px-1">
          <span className="text-[10px] font-black uppercase text-slate-900 truncate max-w-[100px]">{getPlayerName(p.batter1Id)}</span>
          <div className="flex flex-col items-center">
            <span className="text-xs font-black text-slate-900">{p.runs} ({p.balls})</span>
          </div>
          <span className="text-[10px] font-black uppercase text-slate-900 text-right truncate max-w-[100px]">{getPlayerName(p.batter2Id)}</span>
        </div>
        <div className="flex justify-between items-center px-1 text-[8px] font-bold text-slate-400 uppercase">
          <span>{p.batter1Runs} ({p.batter1Balls || 0})</span>
          <div className="flex-1 mx-4 h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
            <div style={{ width: `${b1Pct}%` }} className="bg-primary/60 h-full" />
            <div style={{ width: `${100 - b1Pct}%` }} className="bg-slate-300 h-full" />
          </div>
          <span>{p.batter2Runs} ({p.batter2Balls || 0})</span>
        </div>
      </div>
    );
  };

  const HistoryCard = ({ title, groups, isLoading, icon: Icon }: { title: string, groups: Record<number, any[]> | null, isLoading: boolean, icon: any }) => (
    <Card className="shadow-sm border-none bg-white">
      <CardHeader className="py-4 border-b">
        <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4 max-h-[400px] overflow-y-auto scrollbar-hide">
        {isLoading ? (
          <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
        ) : groups && Object.keys(groups).length > 0 ? (
          Object.keys(groups).sort((a, b) => parseInt(b) - parseInt(a)).map(oNum => {
            const over = groups[parseInt(oNum)];
            const overRuns = over.reduce((acc, curr) => acc + curr.totalRunsOnDelivery, 0);
            return (
              <div key={oNum} className="space-y-2 pb-4 border-b last:border-none">
                <div className="flex justify-between items-center"><span className="text-[9px] font-black uppercase text-slate-400">Over {oNum}</span><span className="text-[9px] font-black text-primary uppercase">{overRuns} Runs</span></div>
                <div className="flex flex-wrap gap-1.5">
                  {over.map((d, idx) => (
                    <div key={idx} className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black border shadow-sm", d.isWicket ? "bg-red-600 text-white border-red-700" : d.runsScored === 4 ? "bg-green-100 text-green-700 border-green-200" : d.runsScored === 6 ? "bg-purple-100 text-purple-700 border-purple-200" : "bg-white text-slate-700 border-slate-200")}>{d.isWicket ? "W" : d.runsScored === 0 ? "•" : d.runsScored}</div>
                  ))}
                </div>
              </div>
            );
          })
        ) : <p className="py-12 text-center text-slate-300 font-black text-[9px] uppercase">No deliveries recorded</p>}
      </CardContent>
    </Card>
  );

  const InningsLiveStats = ({ stats, inningData, title }: { stats: any, inningData: any, title: string }) => {
    if (!inningData) return null;
    return (
      <div className="space-y-6">
        <div className="bg-slate-50 px-4 py-2 border rounded-lg flex justify-between items-center">
          <span className="text-[10px] font-black uppercase text-slate-500">{title}</span>
          <span className="text-xs font-black text-primary">{inningData.score}/{inningData.wickets} ({inningData.oversCompleted}.{inningData.ballsInCurrentOver} OV)</span>
        </div>
        <Card className="shadow-sm border-none bg-white overflow-hidden">
          <div className="overflow-x-auto scrollbar-hide">
            <Table className="min-w-max w-full">
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="text-[9px] font-black uppercase py-3 px-3">Batters</TableHead>
                  <TableHead className="text-right text-[9px] font-black uppercase">R</TableHead>
                  <TableHead className="text-right text-[9px] font-black uppercase">B</TableHead>
                  <TableHead className="text-right text-[9px] font-black uppercase">4s</TableHead>
                  <TableHead className="text-right text-[9px] font-black uppercase">6s</TableHead>
                  <TableHead className="text-right text-[9px] font-black uppercase">SR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[inningData.strikerPlayerId, inningData.nonStrikerPlayerId].filter(id => id && id !== 'none').map(pid => {
                  const s = stats.batting.find((b: any) => b.id === pid) || { runs: 0, balls: 0, fours: 0, sixes: 0 };
                  const isStriker = pid === inningData.strikerPlayerId;
                  return (
                    <TableRow key={pid} className={cn(isStriker ? "bg-primary/5" : "")}>
                      <TableCell className="py-2 px-3">
                        <p className="font-black text-sm uppercase">{getPlayerName(pid)}{isStriker ? "*" : ""}</p>
                        <p className="text-[8px] text-slate-400 uppercase font-bold">{getPlayerRole(pid)}</p>
                      </TableCell>
                      <TableCell className="text-right font-black">{s.runs}</TableCell>
                      <TableCell className="text-right text-xs text-slate-500">{s.balls}</TableCell>
                      <TableCell className="text-right text-xs text-slate-500">{s.fours}</TableCell>
                      <TableCell className="text-right text-xs text-slate-500">{s.sixes}</TableCell>
                      <TableCell className="text-right text-xs font-bold text-slate-400">{s.balls > 0 ? ((s.runs/s.balls)*100).toFixed(2) : '0.00'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="border-t overflow-x-auto scrollbar-hide">
            <Table className="min-w-max w-full">
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="text-[9px] font-black uppercase py-3 px-3">Bowlers</TableHead>
                  <TableHead className="text-right text-[9px] font-black uppercase">O</TableHead>
                  <TableHead className="text-right text-[9px] font-black uppercase">R</TableHead>
                  <TableHead className="text-right text-[9px] font-black uppercase">W</TableHead>
                  <TableHead className="text-right text-[9px] font-black uppercase">Eco</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.bowling.map((bw: any) => (
                  <TableRow key={bw.id}>
                    <TableCell className="py-2 px-3">
                      <p className="font-black text-sm uppercase">{getPlayerName(bw.id)}</p>
                      <p className="text-[8px] text-slate-400 uppercase font-bold">
                        {bw.id === inningData.currentBowlerPlayerId ? "Current Spell" : "Spell Figures"}
                      </p>
                    </TableCell>
                    <TableCell className="text-right font-bold">{bw.oversDisplay}</TableCell>
                    <TableCell className="text-right text-xs text-slate-500">{bw.runs}</TableCell>
                    <TableCell className="text-right font-black text-primary">{bw.wickets}</TableCell>
                    <TableCell className="text-right text-xs font-bold text-slate-400">{bw.balls > 0 ? (bw.runs/(bw.balls/6)).toFixed(2) : '0.00'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    );
  };

  if (!isMounted || isMatchLoading) return <div className="p-20 text-center font-black animate-pulse text-slate-400">SYNCING MATCH DATA...</div>;
  if (!match) return <div className="p-20 text-center">Match missing.</div>;

  const currentBattingSquadIds = match.currentInningNumber === 1 
    ? (match.tossWinnerTeamId === match.team1Id ? (match.tossDecision === 'bat' ? match.team1SquadPlayerIds : match.team2SquadPlayerIds) : (match.tossDecision === 'bat' ? match.team2SquadPlayerIds : match.team1SquadPlayerIds))
    : (match.tossWinnerTeamId === match.team1Id ? (match.tossDecision === 'bat' ? match.team2SquadPlayerIds : match.team1SquadPlayerIds) : (match.tossDecision === 'bat' ? match.team1SquadPlayerIds : match.team2SquadPlayerIds));

  const currentBowlingSquadIds = match.currentInningNumber === 1 
    ? (match.tossWinnerTeamId === match.team1Id ? (match.tossDecision === 'bat' ? match.team2SquadPlayerIds : match.team1SquadPlayerIds) : (match.tossDecision === 'bat' ? match.team1SquadPlayerIds : match.team2SquadPlayerIds))
    : (match.tossWinnerTeamId === match.team1Id ? (match.tossDecision === 'bat' ? match.team1SquadPlayerIds : match.team2SquadPlayerIds) : (match.tossDecision === 'bat' ? match.team2SquadPlayerIds : match.team1SquadPlayerIds));

  return (
    <div className="space-y-4 max-w-5xl mx-auto pb-24 px-1 md:px-4">
      <div className="bg-white rounded-2xl shadow-xl border-t-8 border-t-primary overflow-hidden">
        <div className="p-6 md:p-8 space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-3 flex-1 w-full">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className={cn("font-black text-xl md:text-2xl uppercase tracking-tighter truncate max-w-[200px]", match.currentInningNumber === 1 ? "text-slate-900" : "text-slate-400")}>{getTeamName(match.team1Id)}</span>
                  <span className="text-[10px] font-black text-slate-400 uppercase">({inn1?.oversCompleted || 0}.{inn1?.ballsInCurrentOver || 0}/{match.totalOvers} OV)</span>
                </div>
                <span className="font-black text-2xl md:text-3xl text-slate-900">{inn1?.score || 0}/{inn1?.wickets || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className={cn("font-black text-xl md:text-2xl uppercase tracking-tighter truncate max-w-[200px]", match.currentInningNumber === 2 ? "text-slate-900" : "text-slate-400")}>{getTeamName(match.team2Id)}</span>
                  <span className="text-[10px] font-black text-slate-400 uppercase">({inn2?.oversCompleted || 0}.{inn2?.ballsInCurrentOver || 0}/{match.totalOvers} OV)</span>
                </div>
                <span className="font-black text-2xl md:text-3xl text-slate-900">{inn2?.score || 0}/{inn2?.wickets || 0}</span>
              </div>
            </div>
            <div className="w-px h-20 bg-slate-100 hidden md:block mx-4" />
            <div className="flex flex-row md:flex-col items-center md:items-end gap-3 w-full md:w-auto">
              <Button size="sm" variant="secondary" className="flex-1 md:flex-none h-12 px-6 font-black text-[10px] md:text-xs uppercase bg-secondary text-white shadow-md" onClick={() => {
                const report = generateHTMLReport(match, inn1, inn2, stats1, stats2, allTeams || [], allPlayers || []);
                const blob = new Blob([report], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `CricMates_${matchId}.html`; a.click();
              }}><Download className="w-4 h-4 mr-2" /> Match Report</Button>
              {isUmpire && <Button variant="outline" onClick={() => setIsEditFullMatchOpen(true)} className="flex-1 md:flex-none h-10 px-6 font-black text-[10px] md:text-xs uppercase border-primary text-primary">Umpire Tools</Button>}
            </div>
          </div>

          {chaseLogic && (
            <div className="bg-slate-50 p-4 rounded-xl border-2 border-dashed border-slate-200">
              <p className="text-base font-black text-slate-900 uppercase tracking-tight">
                {getTeamName(inn2?.battingTeamId)} need {chaseLogic.runsNeeded} runs in {chaseLogic.ballsRemaining} balls.
              </p>
              <div className="flex flex-wrap gap-4 mt-2">
                <span className="text-[10px] font-black uppercase text-primary tracking-widest">CRR: {chaseLogic.crr}</span>
                <span className="text-[10px] font-black uppercase text-secondary tracking-widest">RRR: {chaseLogic.rrr}</span>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center border-t pt-4">
            <p className="text-[10px] md:text-xs font-black uppercase text-primary tracking-[0.2em]">{match.status === 'completed' ? match.resultDescription : "Match in Progress"}</p>
            <Link href="/rankings" className="text-[10px] font-black text-secondary uppercase flex items-center gap-1 hover:underline">Rankings <ChevronRight className="w-3 h-3" /></Link>
          </div>
        </div>
      </div>

      <div className="sticky top-16 z-50 bg-white/80 backdrop-blur-md border-b shadow-sm overflow-x-auto scrollbar-hide">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex w-full justify-start rounded-none bg-transparent h-auto p-0 scrollbar-hide min-w-max">
            {['Live', 'Scorecard', 'Analytics', 'Overs', 'Info'].map(t => (
              <TabsTrigger key={t} value={t.toLowerCase()} className="px-6 py-4 text-xs font-black rounded-none border-b-4 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary uppercase tracking-widest">{t}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <Tabs value={activeTab}>
        <TabsContent value="live" className="space-y-6 pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-8">
              {isUmpire && activeInningData && !activeInningData.isDeclaredFinished && (
                <Card className="shadow-lg border-none overflow-hidden bg-slate-900 text-white">
                  <CardHeader className="bg-white/5 py-4 border-b border-white/5">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Official Scorer</CardTitle>
                      <div className="flex gap-2">
                        <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-white/10" onClick={handleSwapStrike}><ArrowLeftRight className="w-4 h-4" /></Button>
                        <Button size="sm" variant="outline" className="h-8 text-[9px] font-black border-white/20 text-white" onClick={() => setIsPlayerAssignmentOpen(true)}>Edit XI</Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    {!activeInningData.currentBowlerPlayerId ? (
                      <div className="py-12 text-center space-y-4">
                        <Zap className="w-12 h-12 text-amber-500 mx-auto animate-pulse" />
                        <p className="font-black uppercase text-sm">Waiting for New Bowler</p>
                        <Button onClick={() => setIsPlayerAssignmentOpen(true)} className="bg-primary font-black uppercase px-8">Assign Bowler</Button>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-4 gap-2 md:gap-3 mb-6">
                          {[0, 1, 2, 3, 4, 6].map(r => (
                            <Button key={`r-${r}`} onClick={() => handleRecordBall(r)} className={cn("h-14 md:h-16 text-xl md:text-2xl font-black bg-white/5 border-2 border-white/10 hover:border-primary", r >= 4 ? "text-primary border-primary/40" : "text-white")}>
                              {r === 0 ? "•" : r}
                            </Button>
                          ))}
                          <Button onClick={() => handleRecordBall(1, 'none', true)} className="h-14 md:h-16 flex flex-col items-center justify-center bg-secondary/20 border-2 border-secondary/40 text-secondary">
                            <span className="text-lg font-black">1D</span>
                            <span className="text-[6px] font-bold uppercase">No Strike</span>
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3">
                          <Button variant="outline" onClick={() => handleRecordBall(0, 'wide')} className="h-10 font-black text-[9px] border-amber-500/40 text-amber-500 uppercase">Wide</Button>
                          <Button variant="outline" onClick={() => handleRecordBall(0, 'noball')} className="h-10 font-black text-[9px] border-amber-500/40 text-amber-500 uppercase">No Ball</Button>
                          <Button variant="outline" onClick={() => setIsWicketDialogOpen(true)} className="h-10 font-black text-[9px] border-red-500/40 text-red-500 uppercase">Wicket</Button>
                          <Button variant="outline" onClick={handleUndoLastBall} disabled={isUndoing} className="h-10 font-black text-[9px] border-white/20 text-white uppercase">Undo</Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}

              <div className="space-y-8">
                {match.currentInningNumber === 2 && <InningsLiveStats title="Second Innings" inningData={inn2} stats={stats2} />}
                {match.currentInningNumber >= 1 && <InningsLiveStats title={match.currentInningNumber === 2 ? "First Innings" : "Current Innings"} inningData={inn1} stats={stats1} />}
              </div>
            </div>

            <div className="space-y-4">
              <HistoryCard 
                title="Recent History" 
                groups={match.currentInningNumber === 2 ? overGroups2 : overGroups1} 
                isLoading={match.currentInningNumber === 2 ? isInn2Loading : isInn1Loading} 
                icon={Zap}
              />
              {match.currentInningNumber === 2 && (
                <HistoryCard 
                  title="Previous History" 
                  groups={overGroups1} 
                  isLoading={isInn1Loading} 
                  icon={History}
                />
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="scorecard" className="pt-4 space-y-6">
          <div className="flex gap-2 scrollbar-hide overflow-x-auto pb-2">
            {['inn1', 'inn2', 'flow'].map(s => (
              <Button key={s} size="sm" variant={activeScorecardSubTab === s ? 'default' : 'outline'} onClick={() => setActiveScorecardSubTab(s as any)} className="font-black text-[10px] uppercase shrink-0">
                {s === 'flow' ? 'Match Flow' : s === 'inn1' ? getTeamName(match.team1Id) : getTeamName(match.team2Id)}
              </Button>
            ))}
          </div>

          {activeScorecardSubTab === 'flow' ? (
            <div className="space-y-8 pl-4 py-4 relative">
              <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-slate-200" />
              {flowEvents.map((e, idx) => (
                <div key={idx} className="relative pl-8 group">
                  <div className={cn("absolute left-[-11px] top-1 w-3 h-3 rounded-full border-2 border-white shadow-sm z-10", e.type === 'header' ? "bg-slate-900 w-4 h-4 left-[-13px]" : "bg-slate-300")} />
                  <div className="space-y-1">
                    <p className={cn("font-black uppercase text-xs tracking-tight", e.type === 'header' ? "text-lg text-slate-900" : "text-slate-700", e.type === 'milestone' ? "text-primary" : "")}>{e.title}</p>
                    {e.detail && <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{e.detail}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              <Card className="rounded-xl overflow-hidden border shadow-sm">
                <div className="bg-slate-50 px-4 py-2 border-b"><span className="text-[10px] font-black uppercase text-slate-500">Batting</span></div>
                <div className="overflow-x-auto scrollbar-hide">
                  <Table className="min-w-max w-full">
                    <TableHeader className="bg-slate-50/50">
                      <TableRow><TableHead className="text-[8px] font-black uppercase">Batter</TableHead><TableHead className="text-right text-[8px] font-black uppercase">R</TableHead><TableHead className="text-right text-[8px] font-black uppercase">B</TableHead><TableHead className="text-right text-[8px] font-black uppercase">4s</TableHead><TableHead className="text-right text-[8px] font-black uppercase">6s</TableHead><TableHead className="text-right text-[8px] font-black uppercase">SR</TableHead></TableRow>
                    </TableHeader>
                    <TableBody>
                      {(activeScorecardSubTab === 'inn1' ? stats1 : stats2).batting.map((b: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="py-2"><p className="font-bold text-xs">{getPlayerName(b.id)}</p><p className="text-[8px] text-slate-400 italic">{b.out ? `${b.dismissal} b ${getPlayerName(b.bowlerId)}` : '(not out)'}</p></TableCell>
                          <TableCell className="text-right font-black text-sm">{b.runs}</TableCell>
                          <TableCell className="text-right text-xs text-slate-500">{b.balls}</TableCell>
                          <TableCell className="text-right text-xs text-slate-500">{b.fours}</TableCell>
                          <TableCell className="text-right text-xs text-slate-500">{b.sixes}</TableCell>
                          <TableCell className="text-right text-[10px] font-bold text-slate-400">{b.balls > 0 ? ((b.runs/b.balls)*100).toFixed(1) : '0.0'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="rounded-xl overflow-hidden border shadow-sm h-fit">
                  <div className="bg-slate-50 px-4 py-2 border-b"><span className="text-[10px] font-black uppercase text-slate-500">Fall of Wickets</span></div>
                  <div className="p-4 space-y-2">
                    {(activeScorecardSubTab === 'inn1' ? stats1 : stats2).fow.map((f: any, i: number) => (
                      <div key={i} className="flex justify-between items-center text-[10px] border-b pb-1 last:border-none last:pb-0"><span className="font-black text-slate-400">{f.wicketNum}-{f.scoreAtWicket}</span><span className="font-bold truncate max-w-[120px]">{getPlayerName(f.playerOutId)}</span><span className="text-slate-400">({f.overs} ov)</span></div>
                    ))}
                  </div>
                </Card>
                <Card className="rounded-xl overflow-hidden border shadow-sm">
                  <div className="bg-slate-50 px-4 py-2 border-b"><span className="text-[10px] font-black uppercase text-slate-500">Partnerships</span></div>
                  <div className="bg-slate-100/50 px-4 py-1.5 border-b"><span className="text-[8px] font-black uppercase text-slate-400 tracking-widest">{activeScorecardSubTab === 'inn1' ? 'First Innings' : 'Second Innings'}</span></div>
                  <div className="p-4 space-y-0">
                    {(activeScorecardSubTab === 'inn1' ? stats1 : stats2).partnerships.map((p: any, i: number) => (
                      <PartnershipRow key={i} p={p} />
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="pt-4 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="shadow-sm border-none overflow-hidden">
              <CardHeader><CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2"><LineChartIcon className="w-4 h-4" /> Worm Chart</CardTitle></CardHeader>
              <CardContent className="h-[300px] p-2 md:p-6">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={wormData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="ball" fontSize={8} label={{ value: 'Balls', position: 'insideBottom', offset: -5, fontSize: 10 }} />
                    <YAxis fontSize={8} label={{ value: 'Runs', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                    <Tooltip contentStyle={{ fontSize: '10px', borderRadius: '8px' }} />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                    <Area type="monotone" dataKey="team1" name={getTeamName(match.team1Id)} stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.1} />
                    <Area type="monotone" dataKey="team2" name={getTeamName(match.team2Id)} stroke="hsl(var(--secondary))" fill="hsl(var(--secondary))" fillOpacity={0.1} />
                    <Line type="monotone" dataKey="team1Wicket" name="Wkt (T1)" stroke="none" dot={<CustomWicketDot stroke="hsl(var(--primary))" />} />
                    <Line type="monotone" dataKey="team2Wicket" name="Wkt (T2)" stroke="none" dot={<CustomWicketDot stroke="hsl(var(--secondary))" />} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="shadow-sm border-none overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2"><BarChart className="w-4 h-4" /> Manhattan Chart</CardTitle>
                <div className="flex gap-1">
                  <Button size="sm" variant={activeInningView === 1 ? 'secondary' : 'ghost'} className="h-6 text-[8px] font-black" onClick={() => setActiveInningView(1)}>INN 1</Button>
                  <Button size="sm" variant={activeInningView === 2 ? 'secondary' : 'ghost'} className="h-6 text-[8px] font-black" onClick={() => setActiveInningView(2)}>INN 2</Button>
                </div>
              </CardHeader>
              <CardContent className="h-[300px] p-2 md:p-6">
                <ResponsiveContainer width="100%" height="100%">
                  <ReBarChart data={manhattanData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="over" fontSize={8} /><YAxis fontSize={8} /><Tooltip contentStyle={{ fontSize: '10px', borderRadius: '8px' }} />
                    <Bar dataKey="runs" name="Runs" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                      {manhattanData.map((e, index) => (<Cell key={`cell-${index}`} fill={e.wickets > 0 ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'} />))}
                    </Bar>
                  </ReBarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="overs" className="pt-4 space-y-4">
          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-2">
              <Button size="sm" variant={activeInningView === 1 ? 'default' : 'outline'} onClick={() => setActiveInningView(1)} className="font-black text-[10px] uppercase">1st Innings</Button>
              {match.currentInningNumber >= 2 && <Button size="sm" variant={activeInningView === 2 ? 'default' : 'outline'} onClick={() => setActiveInningView(2)} className="font-black text-[10px] uppercase">2nd Innings</Button>}
            </div>
          </div>
          {(activeInningView === 1 ? overGroups1 : overGroups2) && Object.keys(activeInningView === 1 ? overGroups1! : overGroups2!).sort((a, b) => parseInt(b) - parseInt(a)).map(oNum => {
            const overBalls = (activeInningView === 1 ? overGroups1! : overGroups2!)[parseInt(oNum)];
            const bId = overBalls[0]?.bowlerId || overBalls[0]?.bowlerPlayerId;
            return (
              <Card key={oNum} className="overflow-hidden border-l-4 border-l-slate-200">
                <div className="bg-slate-50 px-4 py-2 flex justify-between items-center border-b">
                  <h4 className="text-[10px] font-black uppercase text-slate-500">Over {oNum}</h4>
                  <span className="text-[9px] font-black text-primary uppercase">Bowled by: {getPlayerName(bId)}</span>
                </div>
                <div className="p-4 space-y-3">
                  {overBalls.map((d, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black border-2", d.isWicket ? "bg-red-600 text-white border-red-700" : "bg-white text-slate-700 border-slate-200")}>{d.isWicket ? "W" : d.runsScored}</div>
                        <div className="flex flex-col">
                          <p className="text-[10px] font-black uppercase">{getPlayerName(d.strikerPlayerId)}</p>
                          {d.isWicket ? <p className="text-[8px] text-red-600 font-bold uppercase">OUT: {d.dismissalType} {d.fielderPlayerId && d.fielderPlayerId !== 'none' ? `c ${getPlayerName(d.fielderPlayerId)}` : ''} b ${getPlayerName(bId)}</p> : <p className="text-[8px] text-slate-400 font-bold uppercase">{d.totalRunsOnDelivery} runs {d.extraType !== 'none' ? `(${d.extraType})` : ''}</p>}
                        </div>
                      </div>
                      {isUmpire && <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-destructive" onClick={() => { if(confirm("Delete ball?")) { deleteDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${activeInningView}`, 'deliveryRecords', d.id)); toast({ title: "Ball Deleted" }); } }}><Trash2 className="w-3.5 h-3.5"/></Button>}
                    </div>
                  ))}
                </div>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="info" className="pt-4 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="shadow-sm"><CardHeader><CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><Info className="w-4 h-4 text-primary" /> Match Metadata</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-2 gap-4 border-b pb-4"><div><p className="text-[10px] font-black text-slate-400 uppercase">Date</p><p className="text-xs font-bold">{match.matchDate ? new Date(match.matchDate).toLocaleDateString() : '---'}</p></div><div><p className="text-[10px] font-black text-slate-400 uppercase">Format</p><p className="text-xs font-bold">{match.totalOvers} Overs</p></div></div><div><p className="text-[10px] font-black text-slate-400 uppercase">Official Umpire</p><p className="text-xs font-bold">{match.umpireId === 'anonymous' ? 'League Official' : 'Registered Umpire'}</p></div></CardContent></Card>
            <Card className="shadow-sm"><CardHeader><CardTitle className="text-sm font-black uppercase tracking-widest">Squad Registry</CardTitle></CardHeader><CardContent className="space-y-6"><div><p className="text-[10px] font-black text-primary uppercase border-b pb-1">{getTeamName(match.team1Id)}</p><div className="flex flex-wrap gap-1.5 mt-2">{allPlayers?.filter(p => match.team1SquadPlayerIds?.includes(p.id)).map(p => (<Badge key={p.id} variant="outline" className="text-[8px] font-bold uppercase">{p.name}</Badge>))}</div></div><div><p className="text-[10px] font-black text-secondary uppercase border-b pb-1">{getTeamName(match.team2Id)}</p><div className="flex flex-wrap gap-1.5 mt-2">{allPlayers?.filter(p => match.team2SquadPlayerIds?.includes(p.id)).map(p => (<Badge key={p.id} variant="outline" className="text-[8px] font-bold uppercase">{p.name}</Badge>))}</div></div></CardContent></Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isEditFullMatchOpen} onOpenChange={setIsEditFullMatchOpen}>
        <DialogContent className="max-w-[90vw] md:max-w-2xl rounded-xl border-t-8 border-t-primary"><DialogHeader><DialogTitle className="font-black uppercase text-xl">Umpire Dashboard</DialogTitle></DialogHeader><div className="space-y-6 py-6"><div className="grid grid-cols-2 gap-6"><div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400">Match Status</Label><Select value={match.status} onValueChange={v => updateDocumentNonBlocking(matchRef, {status: v})}><SelectTrigger className="font-bold h-12"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="live">Live</SelectItem><SelectItem value="completed">Completed</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400">Active Inning</Label><Select value={match.currentInningNumber.toString()} onValueChange={v => updateDocumentNonBlocking(matchRef, {currentInningNumber: parseInt(v)})}><SelectTrigger className="font-bold h-12"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">Inning 1</SelectItem><SelectItem value="2">Inning 2</SelectItem></SelectContent></Select></div></div><div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400">Result Description</Label><Input value={match.resultDescription || ''} onChange={e => updateDocumentNonBlocking(matchRef, {resultDescription: e.target.value})} className="font-bold text-primary h-12 shadow-sm" /></div></div><DialogFooter><Button onClick={() => setIsEditFullMatchOpen(false)} className="w-full h-14 font-black uppercase shadow-xl">CLOSE TOOLS</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={isWicketDialogOpen} onOpenChange={setIsWicketDialogOpen}>
        <DialogContent className="max-w-[90vw] md:max-w-md rounded-xl border-t-8 border-t-destructive"><DialogHeader><DialogTitle className="font-black uppercase tracking-widest text-destructive">Register Wicket</DialogTitle></DialogHeader><div className="space-y-4 py-4"><div className="space-y-1"><Label className="text-[10px] font-black uppercase text-slate-400">Wicket Type</Label><Select value={wicketForm.type} onValueChange={v => setWicketForm({...wicketForm, type: v})}><SelectTrigger className="font-bold"><SelectValue /></SelectTrigger><SelectContent>{['bowled', 'caught', 'lbw', 'runout', 'stumped', 'retired'].map(t => <SelectItem key={t} value={t} className="uppercase font-bold text-[10px]">{t}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label className="text-[10px] font-black uppercase text-slate-400">Batter Out</Label><Select value={wicketForm.batterOutId} onValueChange={v => setWicketForm({...wicketForm, batterOutId: v})}><SelectTrigger className="font-bold"><SelectValue placeholder="Select Batter" /></SelectTrigger><SelectContent>{activeInningData?.strikerPlayerId && <SelectItem value={activeInningData.strikerPlayerId}>{getPlayerName(activeInningData.strikerPlayerId)}</SelectItem>}{activeInningData?.nonStrikerPlayerId && <SelectItem value={activeInningData.nonStrikerPlayerId}>{getPlayerName(activeInningData.nonStrikerPlayerId)}</SelectItem>}</SelectContent></Select></div>{['caught', 'runout', 'stumped'].includes(wicketForm.type) && (<div className="space-y-1"><Label className="text-[10px] font-black uppercase text-slate-400">Fielder Involved</Label><Select value={wicketForm.fielderId} onValueChange={v => setWicketForm({...wicketForm, fielderId: v})}><SelectTrigger className="font-bold"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">---</SelectItem>{allPlayers?.filter(p => p.teamId !== activeInningData?.battingTeamId).map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent></Select></div>)}<div className="space-y-1 p-3 bg-slate-50 rounded-lg border"><Label className="text-[10px] font-black uppercase text-primary mb-2 block">Post-Wicket Action</Label><Select value={wicketForm.decision} onValueChange={v => setWicketForm({...wicketForm, decision: v})}><SelectTrigger className="font-bold h-12 bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="next" className="font-bold">Next Batter</SelectItem><SelectItem value="last_man" className="font-bold">Last Man Standing</SelectItem><SelectItem value="finish" className="font-bold text-destructive">Finish Innings</SelectItem></SelectContent></Select></div></div><DialogFooter><Button variant="destructive" onClick={handleWicket} className="w-full h-12 font-black uppercase shadow-lg">Confirm Out</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={isPlayerAssignmentOpen} onOpenChange={setIsPlayerAssignmentOpen}>
        <DialogContent className="max-w-[90vw] md:max-w-md rounded-xl border-t-8 border-t-primary"><DialogHeader><DialogTitle className="font-black uppercase tracking-widest text-center py-2">Assign Positions</DialogTitle></DialogHeader><div className="space-y-6 py-4"><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400">Striker</Label><Select value={activeInningData?.strikerPlayerId || undefined} onValueChange={v => updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match.currentInningNumber}`), { strikerPlayerId: v })}><SelectTrigger className="font-bold h-12"><SelectValue placeholder="Striker" /></SelectTrigger><SelectContent>{allPlayers?.filter(p => currentBattingSquadIds?.includes(p.id) && p.id !== activeInningData?.currentBowlerPlayerId && !(match.currentInningNumber === 1 ? stats1 : stats2).batting.find(b => b.id === p.id && b.out)).map(p => (<SelectItem key={p.id} value={p.id} className="font-bold">{p.name}</SelectItem>))}</SelectContent></Select></div>{!activeInningData?.isLastManActive && (<div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400">Non-Striker</Label><Select value={activeInningData?.nonStrikerPlayerId || undefined} onValueChange={v => updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match.currentInningNumber}`), { nonStrikerPlayerId: v })}><SelectTrigger className="font-bold h-12"><SelectValue placeholder="Non-Striker" /></SelectTrigger><SelectContent>{allPlayers?.filter(p => currentBattingSquadIds?.includes(p.id) && p.id !== activeInningData?.currentBowlerPlayerId && !(match.currentInningNumber === 1 ? stats1 : stats2).batting.find(b => b.id === p.id && b.out)).map(p => (<SelectItem key={p.id} value={p.id} className="font-bold">{p.name}</SelectItem>))}</SelectContent></Select></div>)}</div><div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-400">Current Bowler</Label><Select value={activeInningData?.currentBowlerPlayerId || undefined} onValueChange={v => updateDocumentNonBlocking(doc(db, 'matches', matchId, 'innings', `inning_${match.currentInningNumber}`), { currentBowlerPlayerId: v })}><SelectTrigger className="font-bold h-12"><SelectValue placeholder="Bowler" /></SelectTrigger><SelectContent>{allPlayers?.filter(p => currentBowlingSquadIds?.includes(p.id) && p.id !== activeInningData?.strikerPlayerId && p.id !== activeInningData?.nonStrikerPlayerId).map(p => (<SelectItem key={p.id} value={p.id} className="font-bold">{p.name}</SelectItem>))}</SelectContent></Select></div></div><DialogFooter><Button onClick={() => setIsPlayerAssignmentOpen(false)} className="w-full h-14 font-black uppercase shadow-xl">Confirm Positions</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}
