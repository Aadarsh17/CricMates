"use client"

import { useState, useMemo, useEffect } from 'react';
import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, orderBy, collectionGroup } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeftRight, Trophy, Zap, Target, Star, History, UserCircle, TrendingUp, CheckCircle2, Award, Activity, FastForward, Clock, Timer, UserCheck, Swords, ShieldAlert } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const RUN_MILESTONES = [50, 100, 200, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 10000];
const WICKET_MILESTONES = [25, 50, 100, 150, 200, 300, 500, 1000];

export default function InsightsPage() {
  const db = useFirestore();
  const [isMounted, setIsMounted] = useState(false);
  const [p1Id, setP1Id] = useState<string>('');
  const [p2Id, setP2Id] = useState<string>('');
  const [milestonePid, setMilestonePid] = useState<string>('');
  const [activeFastestSubTab, setActiveFastestSubTab] = useState('matches');

  useEffect(() => { setIsMounted(true); }, []);

  const playersQuery = useMemoFirebase(() => query(collection(db, 'players'), orderBy('name', 'asc')), [db]);
  const { data: players, isLoading: isPlayersLoading } = useCollection(playersQuery);

  const matchesQuery = useMemoFirebase(() => query(collection(db, 'matches'), orderBy('matchDate', 'asc')), [db]);
  const { data: matches, isLoading: isMatchesLoading } = useCollection(matchesQuery);

  const deliveriesQuery = useMemoFirebase(() => {
    if (!isMounted) return null;
    return query(collectionGroup(db, 'deliveryRecords'));
  }, [db, isMounted]);
  const { data: deliveries, isLoading: isDeliveriesLoading } = useCollection(deliveriesQuery);

  const sortedDeliveries = useMemo(() => {
    if (!deliveries) return [];
    return [...deliveries].sort((a, b) => {
      const matchA = a.__fullPath?.split('/')[1] || '';
      const matchB = b.__fullPath?.split('/')[1] || '';
      if (matchA !== matchB) return matchA.localeCompare(matchB);
      return (a.timestamp || 0) - (b.timestamp || 0);
    });
  }, [deliveries]);

  const processedData = useMemo(() => {
    if (!players || !matches || !sortedDeliveries) return null;

    const validMatchIds = new Set(matches.map(m => m.id));
    const playerInsights: Record<string, any> = {};

    players.forEach(p => {
      playerInsights[p.id] = {
        id: p.id,
        name: p.name,
        role: p.role,
        imageUrl: p.imageUrl,
        matches: [],
        milestones: [],
        timeline: [] as any[],
        stats: {
          played: 0, runs: 0, ballsFaced: 0, fours: 0, sixes: 0, wickets: 0, ballsBowled: 0, runsConceded: 0, catches: 0, stumpings: 0, runOuts: 0, timesOut: 0, potm: 0
        },
        achievements: {
          fastest50r: null, fastest100r: null, fastest500r: null,
          fastest10w: null, fastest25w: null, fastest50w: null,
          fastest30b: null,
          hattricks: [],
          winningKnocks: []
        }
      };
    });

    const matchPerformances: Record<string, Record<string, any>> = {};
    const matchMeta: Record<string, any> = {};
    matches.forEach(m => {
      matchMeta[m.id] = { date: m.matchDate, target: 0, currentScore: 0, isWon: m.status === 'completed' };
    });

    const inn1Scores: Record<string, number> = {};

    sortedDeliveries.forEach(d => {
      const matchId = d.__fullPath?.split('/')[1];
      if (!matchId || !validMatchIds.has(matchId)) return;

      const pIds = [d.strikerPlayerId, d.bowlerId || d.bowlerPlayerId, d.fielderPlayerId, d.batsmanOutPlayerId].filter(id => id && id !== 'none');
      
      pIds.forEach(pid => {
        if (!matchPerformances[matchId]) matchPerformances[matchId] = {};
        if (!matchPerformances[matchId][pid]) {
          matchPerformances[matchId][pid] = { runs: 0, balls: 0, fours: 0, sixes: 0, wkts: 0, runsCon: 0, ballsB: 0, catches: 0, runouts: 0, out: false, reached30: false, ballsAt30: 0 };
        }
      });

      const innNum = parseInt(d.__fullPath?.split('/')[3].split('_')[1] || '1');
      if (innNum === 1) {
        inn1Scores[matchId] = (inn1Scores[matchId] || 0) + (d.totalRunsOnDelivery || 0);
      }

      const s = matchPerformances[matchId][d.strikerPlayerId];
      if (s) {
        s.runs += (d.runsScored || 0);
        if (d.extraType !== 'wide') s.balls += 1;
        if (d.runsScored === 4) s.fours += 1;
        if (d.runsScored === 6) s.sixes += 1;

        if (s.runs >= 30 && !s.reached30) {
          s.reached30 = true;
          s.ballsAt30 = s.balls;
          if (!playerInsights[d.strikerPlayerId].achievements.fastest30b || s.balls < playerInsights[d.strikerPlayerId].achievements.fastest30b) {
            playerInsights[d.strikerPlayerId].achievements.fastest30b = s.balls;
          }
        }
      }

      if (innNum === 2 && inn1Scores[matchId] !== undefined) {
        const target = inn1Scores[matchId];
        const prevScore = matchMeta[matchId].currentScore;
        const newScore = prevScore + (d.totalRunsOnDelivery || 0);
        matchMeta[matchId].currentScore = newScore;

        if (prevScore <= target && newScore > target && d.strikerPlayerId) {
          matchMeta[matchId].winningPlayerId = d.strikerPlayerId;
        }
      }

      const bId = d.bowlerId || d.bowlerPlayerId;
      const b = matchPerformances[matchId][bId];
      if (b) {
        b.runsCon += (d.totalRunsOnDelivery || 0);
        const isLegal = d.extraType !== 'wide' && d.extraType !== 'noball';
        if (isLegal) b.ballsB += 1;
        
        const isWicket = d.isWicket && d.dismissalType !== 'runout' && d.dismissalType !== 'retired';
        if (isWicket) b.wkts += 1;

        if (!b.recentBalls) b.recentBalls = [];
        if (isLegal || isWicket) {
          b.recentBalls.push({ isWicket, isLegal });
          if (b.recentBalls.length >= 3) {
            const last3 = b.recentBalls.slice(-3);
            if (last3.every((ball: any) => ball.isWicket)) {
              playerInsights[bId].achievements.hattricks.push({ balls: 3, date: matchMeta[matchId].date });
            }
          }
        }
      }

      const f = matchPerformances[matchId][d.fielderPlayerId];
      if (f) {
        if (d.dismissalType === 'caught') f.catches += 1;
        if (d.dismissalType === 'runout') f.runouts += 1;
      }

      if (d.isWicket && d.batsmanOutPlayerId) {
        const outP = matchPerformances[matchId][d.batsmanOutPlayerId];
        if (outP) outP.out = true;
      }
    });

    players.forEach(p => {
      const insight = playerInsights[p.id];
      let careerRuns = 0;
      let careerWickets = 0;
      let matchesCount = 0;
      
      const counts = {
        r10: 0, r20: 0, r30: 0, r50: 0,
        w1: 0, w2: 0, w3: 0,
        catches: 0, runouts: 0,
        potm: 0
      };

      const timeline: any[] = [];
      const reached = new Set<string>();

      matches.forEach(m => {
        const perf = matchPerformances[m.id]?.[p.id];
        if (!perf) return;

        matchesCount += 1;
        insight.stats.played += 1;
        insight.stats.runs += perf.runs;
        insight.stats.ballsFaced += perf.balls;
        insight.stats.fours += perf.fours;
        insight.stats.sixes += perf.sixes;
        insight.stats.wickets += perf.wkts;
        insight.stats.runsConceded += perf.runsCon;
        insight.stats.ballsBowled += perf.ballsB;
        insight.stats.catches += perf.catches;
        insight.stats.runOuts += perf.runouts;
        if (perf.out) insight.stats.timesOut += 1;
        
        careerRuns += perf.runs;
        careerWickets += perf.wkts;

        if (matchMeta[m.id].winningPlayerId === p.id) {
          insight.achievements.winningKnocks.push({ balls: perf.balls, runs: perf.runs, date: m.matchDate });
        }

        if (careerRuns >= 50 && !insight.achievements.fastest50r) insight.achievements.fastest50r = matchesCount;
        if (careerRuns >= 100 && !insight.achievements.fastest100r) insight.achievements.fastest100r = matchesCount;
        if (careerRuns >= 500 && !insight.achievements.fastest500r) insight.achievements.fastest500r = matchesCount;
        if (careerWickets >= 10 && !insight.achievements.fastest10w) insight.achievements.fastest10w = matchesCount;
        if (careerWickets >= 25 && !insight.achievements.fastest25w) insight.achievements.fastest25w = matchesCount;
        if (careerWickets >= 50 && !insight.achievements.fastest50w) insight.achievements.fastest50w = matchesCount;

        if (m.potmPlayerId === p.id) {
          insight.stats.potm += 1;
          counts.potm += 1;
          timeline.push({ label: 'Man of the Match', date: m.matchDate });
        }

        if (perf.runs >= 10) { 
          counts.r10 += 1; 
          if (!reached.has('10 Runs')) { reached.add('10 Runs'); timeline.push({ label: 'First 10+ Runs', date: m.matchDate }); }
        }
        if (perf.runs >= 20) { counts.r20 += 1; if (!reached.has('20 Runs')) { reached.add('20 Runs'); timeline.push({ label: 'First 20+ Runs', date: m.matchDate }); } }
        if (perf.runs >= 30) { counts.r30 += 1; if (!reached.has('30 Runs')) { reached.add('30 Runs'); timeline.push({ label: 'First 30+ Runs', date: m.matchDate }); } }
        if (perf.runs >= 50) { counts.r50 += 1; if (!reached.has('50 Runs')) { reached.add('50 Runs'); timeline.push({ label: 'First 50+ Runs', date: m.matchDate }); } }

        if (perf.wkts >= 1) { 
          counts.w1 += 1; 
          if (!reached.has('First Wicket')) { reached.add('First Wicket'); timeline.push({ label: 'First Wicket', date: m.matchDate }); }
        }
        if (perf.wkts >= 2) { counts.w2 += 1; if (!reached.has('2 Wickets')) { reached.add('2 Wickets'); timeline.push({ label: '2 Wickets in a Match', date: m.matchDate }); } }
        if (perf.wkts >= 3) { counts.w3 += 1; if (!reached.has('3 Wickets')) { reached.add('3 Wickets'); timeline.push({ label: '3 Wickets in a Match', date: m.matchDate }); } }

        RUN_MILESTONES.forEach(threshold => {
          const key = `Career Runs ${threshold}`;
          if (careerRuns >= threshold && !reached.has(key)) {
            reached.add(key);
            timeline.push({ label: `${threshold} Career Runs Reached`, date: m.matchDate });
          }
        });

        WICKET_MILESTONES.forEach(threshold => {
          const key = `Career Wickets ${threshold}`;
          if (careerWickets >= threshold && !reached.has(key)) {
            reached.add(key);
            timeline.push({ label: `${threshold} Career Wickets Reached`, date: m.matchDate });
          }
        });
        
        if (perf.catches >= 1) {
          counts.catches += perf.catches;
          if (!reached.has('First Catch')) { reached.add('First Catch'); timeline.push({ label: 'First Catch Taken', date: m.matchDate }); }
        }
        if (perf.runouts >= 1) {
          counts.runouts += perf.runouts;
          if (!reached.has('First RunOut')) { reached.add('First RunOut'); timeline.push({ label: 'Direct Run Out Effected', date: m.matchDate }); }
        }
      });

      insight.milestoneSummary = counts;
      insight.timeline = timeline.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      insight.careerThresholds = {
        runs: RUN_MILESTONES.map(t => ({ val: t, achieved: careerRuns >= t })),
        wickets: WICKET_MILESTONES.map(t => ({ val: t, achieved: careerWickets >= t }))
      };
    });

    return playerInsights;
  }, [players, matches, sortedDeliveries]);

  const rivalryStats = useMemo(() => {
    if (!p1Id || !p2Id || !sortedDeliveries) return null;
    
    const stats = {
      p1BatVsP2Bowl: { runs: 0, balls: 0, outs: 0 },
      p2BatVsP1Bowl: { runs: 0, balls: 0, outs: 0 }
    };

    sortedDeliveries.forEach(d => {
      const bowlerId = d.bowlerId || d.bowlerPlayerId;
      if (d.strikerPlayerId === p1Id && bowlerId === p2Id) {
        stats.p1BatVsP2Bowl.runs += (d.runsScored || 0);
        if (d.extraType !== 'wide') stats.p1BatVsP2Bowl.balls += 1;
        if (d.isWicket && d.batsmanOutPlayerId === p1Id && d.dismissalType !== 'runout' && d.dismissalType !== 'retired') {
          stats.p1BatVsP2Bowl.outs += 1;
        }
      }
      if (d.strikerPlayerId === p2Id && bowlerId === p1Id) {
        stats.p2BatVsP1Bowl.runs += (d.runsScored || 0);
        if (d.extraType !== 'wide') stats.p2BatVsP1Bowl.balls += 1;
        if (d.isWicket && d.batsmanOutPlayerId === p2Id && d.dismissalType !== 'runout' && d.dismissalType !== 'retired') {
          stats.p2BatVsP1Bowl.outs += 1;
        }
      }
    });

    return stats;
  }, [p1Id, p2Id, sortedDeliveries]);

  const fastestRecords = useMemo(() => {
    if (!processedData) return null;
    const records: any = {
      r50: { player: '---', count: Infinity },
      r100: { player: '---', count: Infinity },
      r500: { player: '---', count: Infinity },
      w10: { player: '---', count: Infinity },
      w25: { player: '---', count: Infinity },
      w50: { player: '---', count: Infinity },
      f30b: { player: '---', balls: Infinity },
      hattrick: { player: '---', balls: Infinity, date: '' },
      winner: { player: '---', balls: Infinity, runs: 0, date: '' }
    };

    Object.values(processedData).forEach((p: any) => {
      if (p.achievements.fastest50r < records.r50.count) records.r50 = { player: p.name, count: p.achievements.fastest50r };
      if (p.achievements.fastest100r < records.r100.count) records.r100 = { player: p.name, count: p.achievements.fastest100r };
      if (p.achievements.fastest500r < records.r500.count) records.r500 = { player: p.name, count: p.achievements.fastest500r };
      if (p.achievements.fastest10w < records.w10.count) records.w10 = { player: p.name, count: p.achievements.fastest10w };
      if (p.achievements.fastest25w < records.w25.count) records.w25 = { player: p.name, count: p.achievements.fastest25w };
      if (p.achievements.fastest50w < records.w50.count) records.w50 = { player: p.name, count: p.achievements.fastest50w };

      if (p.achievements.fastest30b && p.achievements.fastest30b < records.f30b.balls) {
        records.f30b = { player: p.name, balls: p.achievements.fastest30b };
      }

      p.achievements.hattricks.forEach((h: any) => {
        if (h.balls < records.hattrick.balls) {
          records.hattrick = { player: p.name, balls: h.balls, date: h.date };
        }
      });

      p.achievements.winningKnocks.forEach((wk: any) => {
        if (wk.balls < records.winner.balls) {
          records.winner = { player: p.name, balls: wk.balls, runs: wk.runs, date: wk.date };
        }
      });
    });

    return records;
  }, [processedData]);

  if (!isMounted || isPlayersLoading || isMatchesLoading || isDeliveriesLoading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <Loader2 className="w-12 h-12 text-primary animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Processing League Intelligence...</p>
    </div>
  );

  const getStats = (id: string) => processedData?.[id] || null;

  const renderComparisonRow = (label: string, val1: any, val2: any, isHigherBetter: boolean = true) => {
    const v1 = parseFloat(val1) || 0;
    const v2 = parseFloat(val2) || 0;
    const isV1Better = isHigherBetter ? v1 > v2 : v1 < v2;
    const isV2Better = isHigherBetter ? v2 > v1 : v2 < v1;

    return (
      <TableRow className="hover:bg-transparent">
        <TableCell className="text-left py-5 pl-8"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span></TableCell>
        <TableCell className="text-center">
          <div className={cn("inline-block px-4 py-1.5 rounded-full font-black text-sm", isV1Better ? "bg-primary/10 text-primary border-2 border-primary/20" : "text-slate-600")}>{val1}</div>
        </TableCell>
        <TableCell className="text-center pr-8">
          <div className={cn("inline-block px-4 py-1.5 rounded-full font-black text-sm", isV2Better ? "bg-secondary/10 text-secondary border-2 border-secondary/20" : "text-slate-600")}>{val2}</div>
        </TableCell>
      </TableRow>
    );
  };

  const selectedMilestonePlayer = getStats(milestonePid);

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-24 px-4">
      <div className="flex items-center gap-5">
        <div className="bg-primary p-4 rounded-[1.5rem] shadow-xl shadow-primary/20">
          <TrendingUp className="w-8 h-8 text-white" />
        </div>
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase text-slate-900 leading-none">Advanced Insights</h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">Professional Intelligence Module v2.0</p>
        </div>
      </div>

      <Tabs defaultValue="comparison" className="w-full">
        <TabsList className="grid w-full max-w-lg grid-cols-3 bg-slate-100 p-1.5 rounded-2xl mb-10 h-14">
          <TabsTrigger value="comparison" className="font-black data-[state=active]:bg-white data-[state=active]:text-primary rounded-xl uppercase text-[10px] tracking-widest">Comparison</TabsTrigger>
          <TabsTrigger value="milestones" className="font-black data-[state=active]:bg-white data-[state=active]:text-primary rounded-xl uppercase text-[10px] tracking-widest">Milestones</TabsTrigger>
          <TabsTrigger value="fastest" className="font-black data-[state=active]:bg-white data-[state=active]:text-primary rounded-xl uppercase text-[10px] tracking-widest">Fastest</TabsTrigger>
        </TabsList>

        <TabsContent value="comparison" className="space-y-10 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-slate-50 p-8 rounded-[2rem] border border-slate-200 shadow-inner">
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Player A (Primary)</label>
              <Select value={p1Id} onValueChange={setP1Id}>
                <SelectTrigger className="h-16 font-black text-sm uppercase rounded-2xl border-4 border-primary/10 hover:border-primary/30 transition-all bg-white">
                  <SelectValue placeholder="CHOOSE FIRST PLAYER" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl shadow-2xl">
                  {players?.map(p => <SelectItem key={p.id} value={p.id} className="font-black uppercase text-xs p-3">{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Player B (Opponent)</label>
              <Select value={p2Id} onValueChange={setP2Id}>
                <SelectTrigger className="h-16 font-black text-sm uppercase rounded-2xl border-4 border-secondary/10 hover:border-secondary/30 transition-all bg-white">
                  <SelectValue placeholder="CHOOSE SECOND PLAYER" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl shadow-2xl">
                  {players?.map(p => <SelectItem key={p.id} value={p.id} className="font-black uppercase text-xs p-3">{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {p1Id && p2Id ? (
            <div className="space-y-10">
              <Card className="border-none shadow-2xl overflow-hidden bg-white rounded-[2rem]">
                <div className="bg-slate-900 text-white p-10 grid grid-cols-3 items-center text-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />
                  <div className="flex flex-col items-center space-y-4 relative z-10">
                    <Avatar className="w-24 h-24 border-4 border-primary shadow-2xl rounded-3xl overflow-hidden"><AvatarImage src={getStats(p1Id)?.imageUrl} className="object-cover" /><AvatarFallback className="bg-slate-800 text-2xl font-black">{getStats(p1Id)?.name[0]}</AvatarFallback></Avatar>
                    <span className="font-black uppercase text-xs tracking-tighter truncate max-w-[120px] bg-primary px-3 py-1 rounded-full">{getStats(p1Id)?.name}</span>
                  </div>
                  <div className="flex justify-center relative z-10">
                    <div className="bg-white/10 p-4 rounded-full backdrop-blur-md border border-white/5"><ArrowLeftRight className="w-10 h-10 text-slate-400" /></div>
                  </div>
                  <div className="flex flex-col items-center space-y-4 relative z-10">
                    <Avatar className="w-24 h-24 border-4 border-secondary shadow-2xl rounded-3xl overflow-hidden"><AvatarImage src={getStats(p2Id)?.imageUrl} className="object-cover" /><AvatarFallback className="bg-slate-800 text-2xl font-black">{getStats(p2Id)?.name[0]}</AvatarFallback></Avatar>
                    <span className="font-black uppercase text-xs tracking-tighter truncate max-w-[120px] bg-secondary px-3 py-1 rounded-full">{getStats(p2Id)?.name}</span>
                  </div>
                </div>
                <Table>
                  <TableBody>
                    {renderComparisonRow('Matches Logged', getStats(p1Id)?.stats.played, getStats(p2Id)?.stats.played)}
                    {renderComparisonRow('Total Runs', getStats(p1Id)?.stats.runs, getStats(p2Id)?.stats.runs)}
                    {renderComparisonRow('Batting Average', (getStats(p1Id)?.stats.runs / (getStats(p1Id)?.stats.timesOut || 1)).toFixed(2), (getStats(p2Id)?.stats.runs / (getStats(p2Id)?.stats.timesOut || 1)).toFixed(2))}
                    {renderComparisonRow('Strike Rate', (getStats(p1Id)?.stats.ballsFaced > 0 ? (getStats(p1Id)?.stats.runs / getStats(p1Id)?.stats.ballsFaced * 100).toFixed(2) : '0.00'), (getStats(p2Id)?.stats.ballsFaced > 0 ? (getStats(p2Id)?.stats.runs / getStats(p2Id)?.stats.ballsFaced * 100).toFixed(2) : '0.00'))}
                    {renderComparisonRow('Boundary Run %', (getStats(p1Id)?.stats.runs > 0 ? ((getStats(p1Id)?.stats.fours * 4 + getStats(p1Id)?.stats.sixes * 6) / getStats(p1Id)?.stats.runs * 100).toFixed(1) + '%' : '0.0%'), (getStats(p2Id)?.stats.runs > 0 ? ((getStats(p2Id)?.stats.fours * 4 + getStats(p2Id)?.stats.sixes * 6) / getStats(p2Id)?.stats.runs * 100).toFixed(1) + '%' : '0.0%'))}
                    {renderComparisonRow('Wickets Taken', getStats(p1Id)?.stats.wickets, getStats(p2Id)?.stats.wickets)}
                    {renderComparisonRow('Bowling Economy', (getStats(p1Id)?.stats.ballsBowled > 0 ? (getStats(p1Id)?.stats.runsConceded / (getStats(p1Id)?.stats.ballsBowled / 6)).toFixed(2) : '0.00'), (getStats(p2Id)?.stats.ballsBowled > 0 ? (getStats(p2Id)?.stats.runsConceded / (getStats(p2Id)?.stats.ballsBowled / 6)).toFixed(2) : '0.00'), false)}
                  </TableBody>
                </Table>
              </Card>

              {/* RIVALRY SECTION */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 px-2">
                  <div className="bg-destructive/10 p-2 rounded-xl"><Swords className="w-6 h-6 text-destructive" /></div>
                  <h3 className="font-black uppercase text-xl tracking-tighter text-slate-900">Battle Rivalry <span className="text-slate-400 font-medium">(Head-to-Head)</span></h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <Card className="border-none shadow-xl overflow-hidden bg-white rounded-[2rem]">
                    <CardHeader className="bg-slate-50 border-b py-4 px-8">
                      <CardTitle className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">
                        {getStats(p1Id)?.name} (BAT) <span className="text-slate-300 mx-2">VS</span> {getStats(p2Id)?.name} (BOWL)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-10">
                      {rivalryStats?.p1BatVsP2Bowl.balls ? (
                        <div className="grid grid-cols-3 gap-8 text-center">
                          <div><p className="text-4xl font-black text-slate-900">{rivalryStats.p1BatVsP2Bowl.runs}</p><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Runs</p></div>
                          <div><p className="text-4xl font-black text-slate-900">{rivalryStats.p1BatVsP2Bowl.balls}</p><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Balls</p></div>
                          <div><p className="text-4xl font-black text-destructive">{rivalryStats.p1BatVsP2Bowl.outs}</p><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Outs</p></div>
                        </div>
                      ) : (
                        <p className="text-center py-6 text-xs font-black text-slate-300 uppercase italic tracking-widest">No documented encounters</p>
                      )}
                    </CardContent>
                  </Card>
                  <Card className="border-none shadow-xl overflow-hidden bg-white rounded-[2rem]">
                    <CardHeader className="bg-slate-50 border-b py-4 px-8">
                      <CardTitle className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">
                        {getStats(p2Id)?.name} (BAT) <span className="text-slate-300 mx-2">VS</span> {getStats(p1Id)?.name} (BOWL)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-10">
                      {rivalryStats?.p2BatVsP1Bowl.balls ? (
                        <div className="grid grid-cols-3 gap-8 text-center">
                          <div><p className="text-4xl font-black text-slate-900">{rivalryStats.p2BatVsP1Bowl.runs}</p><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Runs</p></div>
                          <div><p className="text-4xl font-black text-slate-900">{rivalryStats.p2BatVsP1Bowl.balls}</p><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Balls</p></div>
                          <div><p className="text-4xl font-black text-destructive">{rivalryStats.p2BatVsP1Bowl.outs}</p><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Outs</p></div>
                        </div>
                      ) : (
                        <p className="text-center py-6 text-xs font-black text-slate-300 uppercase italic tracking-widest">No documented encounters</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-32 text-center border-4 border-dashed rounded-[3rem] bg-slate-50/50 flex flex-col items-center space-y-6">
              <Zap className="w-20 h-20 text-slate-200" />
              <p className="text-slate-400 text-xs font-black uppercase tracking-[0.4em]">Select two players to unlock battle analytics</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="milestones" className="space-y-10 animate-in fade-in duration-500">
          <div className="max-w-md mx-auto space-y-3">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Achievement Intelligence Search</label>
            <Select value={milestonePid} onValueChange={setMilestonePid}>
              <SelectTrigger className="h-16 font-black text-sm uppercase rounded-2xl border-4 border-amber-500/10 hover:border-amber-500/30 transition-all bg-white shadow-xl shadow-amber-500/5">
                <SelectValue placeholder="PICK A PLAYER TO VIEW LEGACY" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl shadow-2xl">
                {players?.map(p => <SelectItem key={p.id} value={p.id} className="font-black uppercase text-xs p-3">{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {selectedMilestonePlayer ? (
            <div className="space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="bg-slate-900 text-white border-none shadow-2xl rounded-[2rem] overflow-hidden relative group p-10">
                  <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity"><Activity className="w-24 h-24" /></div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">Total Career Runs</p>
                    <div className="flex items-baseline gap-3">
                      <span className="text-7xl font-black tracking-tighter leading-none">{selectedMilestonePlayer.stats.runs}</span>
                      <span className="text-xs font-black text-slate-500 tracking-widest">RUNS</span>
                    </div>
                  </div>
                </Card>
                <Card className="bg-slate-900 text-white border-none shadow-2xl rounded-[2rem] overflow-hidden relative group p-10">
                  <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity"><Target className="w-24 h-24" /></div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-secondary">Total Career Wickets</p>
                    <div className="flex items-baseline gap-3">
                      <span className="text-7xl font-black tracking-tighter leading-none">{selectedMilestonePlayer.stats.wickets}</span>
                      <span className="text-xs font-black text-slate-500 tracking-widest">WKTS</span>
                    </div>
                  </div>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-2 space-y-10">
                  <Card className="border-t-8 border-t-amber-500 shadow-2xl overflow-hidden rounded-[2rem] bg-white">
                    <CardHeader className="bg-slate-50 border-b py-5 px-8">
                      <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-3 text-slate-600">
                        <Award className="w-5 h-5 text-amber-500" /> Match Honors & Logs
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="grid grid-cols-2 sm:grid-cols-3">
                        {[
                          { label: '10+ Runs', count: selectedMilestonePlayer.milestoneSummary.r10, icon: Zap, color: 'text-blue-500' },
                          { label: '20+ Runs', count: selectedMilestonePlayer.milestoneSummary.r20, icon: Zap, color: 'text-indigo-500' },
                          { label: '30+ Runs', count: selectedMilestonePlayer.milestoneSummary.r30, icon: Zap, color: 'text-violet-500' },
                          { label: '50+ Runs', count: selectedMilestonePlayer.milestoneSummary.r50, icon: Star, color: 'text-amber-500' },
                          { label: 'Fours Hit', count: selectedMilestonePlayer.stats.fours, icon: Zap, color: 'text-emerald-500' },
                          { label: 'Sixes Hit', count: selectedMilestonePlayer.stats.sixes, icon: Zap, color: 'text-purple-500' },
                          { label: '1 Wicket', count: selectedMilestonePlayer.milestoneSummary.w1, icon: Target, color: 'text-sky-500' },
                          { label: '2+ Wickets', count: selectedMilestonePlayer.milestoneSummary.w2, icon: Target, color: 'text-sky-600' },
                          { label: '3+ Wickets', count: selectedMilestonePlayer.milestoneSummary.w3, icon: Trophy, color: 'text-sky-700' },
                          { label: 'Catches', count: selectedMilestonePlayer.milestoneSummary.catches, icon: Zap, color: 'text-purple-500' },
                          { label: 'Run Outs', count: selectedMilestonePlayer.milestoneSummary.runouts, icon: Zap, color: 'text-rose-500' },
                          { label: 'POTM Awards', count: selectedMilestonePlayer.milestoneSummary.potm, icon: Trophy, color: 'text-amber-600' },
                        ].map((m, i) => (
                          <div key={i} className="p-8 border-r border-b last:border-r-0 flex flex-col items-center text-center space-y-3 hover:bg-slate-50 transition-colors">
                            <m.icon className={cn("w-6 h-6", m.color)} />
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest leading-none">{m.label}</span>
                            <span className="text-3xl font-black text-slate-900">{m.count}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <Card className="border-none shadow-xl overflow-hidden bg-slate-50/50 rounded-[2rem]">
                      <div className="px-8 py-4 bg-primary text-white text-[10px] font-black uppercase tracking-[0.3em] flex items-center justify-between">
                        <span>Career Runs Journey</span>
                        <TrendingUp className="w-4 h-4" />
                      </div>
                      <CardContent className="p-6 space-y-3">
                        {selectedMilestonePlayer.careerThresholds.runs.slice(0, 6).map((t: any, idx: number) => (
                          <div key={idx} className={cn("flex items-center justify-between p-4 rounded-2xl border transition-all", t.achieved ? "bg-white border-primary/20 shadow-lg scale-[1.02]" : "bg-transparent border-slate-200 opacity-30 grayscale")}>
                            <span className="text-xs font-black text-slate-700 uppercase tracking-tight">{t.val} Career Runs</span>
                            {t.achieved ? <CheckCircle2 className="w-5 h-5 text-primary" /> : <div className="w-5 h-5 rounded-full border-2 border-slate-200" />}
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <Card className="border-none shadow-xl overflow-hidden bg-slate-50/50 rounded-[2rem]">
                      <div className="px-8 py-4 bg-secondary text-white text-[10px] font-black uppercase tracking-[0.3em] flex items-center justify-between">
                        <span>Career Wickets Journey</span>
                        <Target className="w-4 h-4" />
                      </div>
                      <CardContent className="p-6 space-y-3">
                        {selectedMilestonePlayer.careerThresholds.wickets.slice(0, 6).map((t: any, idx: number) => (
                          <div key={idx} className={cn("flex items-center justify-between p-4 rounded-2xl border transition-all", t.achieved ? "bg-white border-secondary/20 shadow-lg scale-[1.02]" : "bg-transparent border-slate-200 opacity-30 grayscale")}>
                            <span className="text-xs font-black text-slate-700 uppercase tracking-tight">{t.val} Career Wkts</span>
                            {t.achieved ? <CheckCircle2 className="w-5 h-5 text-secondary" /> : <div className="w-5 h-5 rounded-full border-2 border-slate-200" />}
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <div className="space-y-8">
                  <Card className="shadow-2xl border-none bg-slate-900 text-white rounded-[2rem]">
                    <CardHeader className="border-b border-white/10 py-6 px-8">
                      <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-primary flex items-center gap-3">
                        <History className="w-5 h-5" /> Achievement Timeline
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-10">
                      <div className="relative space-y-10 before:absolute before:left-4 before:top-2 before:bottom-2 before:w-1 before:bg-white/5">
                        {selectedMilestonePlayer.timeline.length > 0 ? selectedMilestonePlayer.timeline.map((event: any, idx: number) => (
                          <div key={idx} className="relative pl-12 group">
                            <div className="absolute left-0 top-1 w-8 h-8 rounded-full bg-slate-800 border-4 border-primary flex items-center justify-center z-10 shadow-2xl shadow-primary/50">
                              <span className="text-[10px] font-black">{idx + 1}</span>
                            </div>
                            <div>
                              <p className="text-sm font-black uppercase tracking-tight text-white group-hover:text-primary transition-colors leading-tight">{event.label}</p>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{new Date(event.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                            </div>
                          </div>
                        )) : (
                          <div className="text-center py-20 flex flex-col items-center">
                            <Clock className="w-12 h-12 text-slate-800 mb-4" />
                            <p className="text-[10px] font-black uppercase text-slate-600 tracking-[0.3em]">No milestones documented</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-32 text-center border-4 border-dashed rounded-[3rem] bg-slate-50/50 flex flex-col items-center space-y-6">
              <Trophy className="w-20 h-20 text-slate-200" />
              <p className="text-slate-400 text-xs font-black uppercase tracking-[0.4em]">Select a player to view professional timeline</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="fastest" className="space-y-10 animate-in fade-in duration-500">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="bg-secondary p-3 rounded-2xl shadow-lg"><FastForward className="w-6 h-6 text-white" /></div>
              <h2 className="text-2xl font-black uppercase tracking-tighter">Fastest Achievements</h2>
            </div>
            <Tabs value={activeFastestSubTab} onValueChange={setActiveFastestSubTab} className="w-full md:w-auto">
              <TabsList className="bg-slate-100 p-1.5 h-12 rounded-xl w-full flex overflow-x-auto scrollbar-hide">
                {['matches', 'balls', 'hattrick', 'winner'].map(st => (
                  <TabsTrigger key={st} value={st} className="text-[10px] font-black uppercase px-6 h-9 data-[state=active]:bg-white data-[state=active]:text-primary rounded-lg tracking-widest">{st}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <TabsContent value="matches" className="m-0 space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <Card className="border-none shadow-2xl overflow-hidden bg-white rounded-[2rem]">
                <CardHeader className="bg-slate-50 border-b py-5 px-8">
                  <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-3"><Trophy className="w-4 h-4 text-primary"/> Career Runs (by Matches)</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {[
                    { label: 'Fastest 50 Runs', key: 'r50', icon: Zap },
                    { label: 'Fastest 100 Runs', key: 'r100', icon: Star },
                    { label: 'Fastest 500 Runs', key: 'r500', icon: Trophy },
                  ].map((rec, idx) => {
                    const val = fastestRecords?.[rec.key as keyof typeof fastestRecords];
                    return (
                      <div key={idx} className="p-8 border-b last:border-none flex justify-between items-center group hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-6">
                          <div className="p-4 bg-primary/10 rounded-2xl text-primary shadow-inner"><rec.icon className="w-6 h-6" /></div>
                          <div>
                            <p className="text-lg font-black uppercase tracking-tighter text-slate-900 leading-none">{val?.player}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">{rec.label}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-4xl font-black text-primary leading-none">{val?.count === Infinity ? '---' : val?.count}</p>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Matches</p>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card className="border-none shadow-2xl overflow-hidden bg-white rounded-[2rem]">
                <CardHeader className="bg-slate-50 border-b py-5 px-8">
                  <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-3"><Target className="w-4 h-4 text-secondary"/> Career Wickets (by Matches)</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {[
                    { label: 'Fastest 10 Wickets', key: 'w10', icon: Target },
                    { label: 'Fastest 25 Wickets', key: 'w25', icon: Target },
                    { label: 'Fastest 50 Wickets', key: 'w50', icon: Award },
                  ].map((rec, idx) => {
                    const val = fastestRecords?.[rec.key as keyof typeof fastestRecords];
                    return (
                      <div key={idx} className="p-8 border-b last:border-none flex justify-between items-center group hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-6">
                          <div className="p-4 bg-secondary/10 rounded-2xl text-secondary shadow-inner"><rec.icon className="w-6 h-6" /></div>
                          <div>
                            <p className="text-lg font-black uppercase tracking-tighter text-slate-900 leading-none">{val?.player}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">{rec.label}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-4xl font-black text-secondary leading-none">{val?.count === Infinity ? '---' : val?.count}</p>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Matches</p>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="balls" className="m-0">
            <Card className="border-none shadow-2xl overflow-hidden bg-white rounded-[3rem] max-w-2xl mx-auto border-t-[12px] border-t-orange-500">
              <CardHeader className="bg-slate-50 border-b py-6 px-10 flex flex-row items-center justify-between">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 flex items-center gap-3"><Timer className="w-5 h-5 text-orange-500"/> Fastest 30 (Aggressive Tier)</CardTitle>
                <Badge variant="outline" className="text-[9px] font-black uppercase border-orange-200 text-orange-600 px-3 py-1 rounded-full">BALLS FACED</Badge>
              </CardHeader>
              <CardContent className="p-12">
                {fastestRecords?.f30b?.balls !== Infinity ? (
                  <div className="flex flex-col items-center text-center space-y-10">
                    <div className="bg-orange-50 p-10 rounded-[2.5rem] border-8 border-white shadow-2xl"><Zap className="w-20 h-20 text-orange-500" /></div>
                    <div className="space-y-2">
                      <h3 className="text-5xl font-black uppercase tracking-tighter text-slate-900 leading-tight">{fastestRecords.f30b.player}</h3>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Reached 30 runs in record balls</p>
                    </div>
                    <div className="grid grid-cols-1 w-full bg-slate-950 rounded-[2rem] p-10 shadow-2xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-6 opacity-10"><Zap className="w-32 h-32 text-white" /></div>
                      <div className="space-y-2 relative z-10">
                        <span className="text-[10px] font-black text-orange-400 uppercase tracking-[0.4em]">Historical Minimum</span>
                        <p className="text-8xl font-black text-white leading-none tracking-tighter">{fastestRecords.f30b.balls}</p>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-4">Balls to reach 30 runs</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-24 text-center space-y-6 flex flex-col items-center">
                    <Activity className="w-20 h-20 text-slate-100" />
                    <p className="text-xs font-black uppercase text-slate-300 tracking-[0.4em] italic">Record awaiting qualifying performance</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="hattrick" className="m-0">
            <Card className="border-none shadow-2xl overflow-hidden bg-slate-900 text-white rounded-[3rem] max-w-2xl mx-auto border-t-[12px] border-t-purple-600">
              <CardHeader className="bg-white/5 border-b border-white/5 py-6 px-10 flex flex-row items-center justify-between">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-3"><Target className="w-5 h-5 text-purple-600"/> Premier Hat-trick</CardTitle>
                <Badge className="bg-purple-600 text-white text-[9px] font-black uppercase px-3 py-1 rounded-full">CONSECUTIVE WKTS</Badge>
              </CardHeader>
              <CardContent className="p-12">
                {fastestRecords?.hattrick?.balls !== Infinity ? (
                  <div className="flex flex-col items-center text-center space-y-10">
                    <div className="bg-purple-600/20 p-10 rounded-[2.5rem] border-8 border-white/5 shadow-2xl"><Award className="w-20 h-20 text-purple-600" /></div>
                    <div className="space-y-2">
                      <h3 className="text-5xl font-black uppercase tracking-tighter text-white leading-tight">{fastestRecords.hattrick.player}</h3>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-2">Achieved on {new Date(fastestRecords.hattrick.date).toLocaleDateString()}</p>
                    </div>
                    <div className="grid grid-cols-1 w-full bg-white/5 rounded-[2rem] p-10 border border-white/10 shadow-inner">
                      <div className="space-y-2">
                        <span className="text-[10px] font-black text-purple-400 uppercase tracking-[0.4em]">Delivery Count</span>
                        <p className="text-8xl font-black text-white leading-none tracking-tighter">{fastestRecords.hattrick.balls}</p>
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mt-4">3 Wickets in 3 Consecutive Legal Balls</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-24 text-center space-y-6 flex flex-col items-center">
                    <UserCheck className="w-20 h-20 text-white/5" />
                    <p className="text-xs font-black uppercase text-slate-600 tracking-[0.4em] italic">No Hat-tricks Recorded in Series</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="winner" className="m-0">
            <Card className="border-none shadow-2xl overflow-hidden bg-white rounded-[3rem] max-w-2xl mx-auto border-t-[12px] border-t-emerald-600">
              <CardHeader className="bg-slate-50 border-b py-6 px-10 flex flex-row items-center justify-between">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 flex items-center gap-3"><Zap className="w-5 h-5 text-emerald-600"/> Clutch Finisher</CardTitle>
                <Badge className="bg-emerald-600 text-white text-[9px] font-black uppercase px-3 py-1 rounded-full">WINNING KNOCK</Badge>
              </CardHeader>
              <CardContent className="p-12">
                {fastestRecords?.winner?.balls !== Infinity ? (
                  <div className="flex flex-col items-center text-center space-y-10">
                    <div className="bg-emerald-50 p-10 rounded-[2.5rem] border-8 border-white shadow-2xl"><Star className="w-20 h-20 text-emerald-600" /></div>
                    <div className="space-y-2">
                      <h3 className="text-5xl font-black uppercase tracking-tighter text-slate-900 leading-tight">{fastestRecords.winner.player}</h3>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Highest impact chasing knock in records</p>
                    </div>
                    <div className="grid grid-cols-2 w-full gap-6">
                      <div className="bg-slate-950 rounded-[2rem] p-8 shadow-xl text-center">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Balls Faced</span>
                        <p className="text-5xl font-black text-white mt-3 tracking-tighter">{fastestRecords.winner.balls}</p>
                      </div>
                      <div className="bg-emerald-600 rounded-[2rem] p-8 shadow-xl text-center">
                        <span className="text-[10px] font-black text-emerald-100 uppercase tracking-[0.3em]">Match Runs</span>
                        <p className="text-5xl font-black text-white mt-3 tracking-tighter">{fastestRecords.winner.runs}</p>
                      </div>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Recorded officially on {new Date(fastestRecords.winner.date).toLocaleDateString()}</p>
                  </div>
                ) : (
                  <div className="py-24 text-center space-y-6 flex flex-col items-center">
                    <Clock className="w-20 h-20 text-slate-100" />
                    <p className="text-xs font-black uppercase text-slate-300 tracking-[0.4em] italic">Awaiting Clutch Performance Data</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </TabsContent>
      </Tabs>
    </div>
  );
}