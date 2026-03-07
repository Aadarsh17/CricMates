
"use client"

import { useState, useMemo, useEffect } from 'react';
import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, orderBy, collectionGroup } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeftRight, Trophy, Zap, Target, Star, History, UserCircle, TrendingUp, CheckCircle2, Award, Activity } from 'lucide-react';
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

  const processedData = useMemo(() => {
    if (!players || !matches || !deliveries) return null;

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
        }
      };
    });

    const matchPerformances: Record<string, Record<string, any>> = {};

    deliveries.forEach(d => {
      const matchId = d.__fullPath?.split('/')[1];
      if (!matchId || !validMatchIds.has(matchId)) return;

      const pIds = [d.strikerPlayerId, d.bowlerId || d.bowlerPlayerId, d.fielderPlayerId, d.batsmanOutPlayerId].filter(id => id && id !== 'none');
      
      pIds.forEach(pid => {
        if (!matchPerformances[matchId]) matchPerformances[matchId] = {};
        if (!matchPerformances[matchId][pid]) {
          matchPerformances[matchId][pid] = { runs: 0, balls: 0, fours: 0, sixes: 0, wkts: 0, runsCon: 0, ballsB: 0, catches: 0, runouts: 0, out: false };
        }
      });

      const s = matchPerformances[matchId][d.strikerPlayerId];
      if (s) {
        s.runs += (d.runsScored || 0);
        if (d.extraType !== 'wide') s.balls += 1;
        if (d.runsScored === 4) s.fours += 1;
        if (d.runsScored === 6) s.sixes += 1;
      }

      const b = matchPerformances[matchId][d.bowlerId || d.bowlerPlayerId];
      if (b) {
        b.runsCon += (d.totalRunsOnDelivery || 0);
        if (d.extraType !== 'wide' && d.extraType !== 'noball') b.ballsB += 1;
        if (d.isWicket && d.dismissalType !== 'runout' && d.dismissalType !== 'retired') b.wkts += 1;
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

        if (m.potmPlayerId === p.id) {
          insight.stats.potm += 1;
          counts.potm += 1;
          timeline.push({ label: 'Man of the Match', date: m.matchDate });
        }

        // Batting Match Milestones
        if (perf.runs >= 10) { 
          counts.r10 += 1; 
          if (!reached.has('10 Runs')) { reached.add('10 Runs'); timeline.push({ label: 'First 10+ Runs', date: m.matchDate }); }
        }
        if (perf.runs >= 20) { counts.r20 += 1; if (!reached.has('20 Runs')) { reached.add('20 Runs'); timeline.push({ label: 'First 20+ Runs', date: m.matchDate }); } }
        if (perf.runs >= 30) { counts.r30 += 1; if (!reached.has('30 Runs')) { reached.add('30 Runs'); timeline.push({ label: 'First 30+ Runs', date: m.matchDate }); } }
        if (perf.runs >= 50) { counts.r50 += 1; if (!reached.has('50 Runs')) { reached.add('50 Runs'); timeline.push({ label: 'First 50+ Runs', date: m.matchDate }); } }

        // Bowling Match Milestones
        if (perf.wkts >= 1) { 
          counts.w1 += 1; 
          if (!reached.has('First Wicket')) { reached.add('First Wicket'); timeline.push({ label: 'First Wicket', date: m.matchDate }); }
        }
        if (perf.wkts >= 2) { counts.w2 += 1; if (!reached.has('2 Wickets')) { reached.add('2 Wickets'); timeline.push({ label: '2 Wickets in a Match', date: m.matchDate }); } }
        if (perf.wkts >= 3) { counts.w3 += 1; if (!reached.has('3 Wickets')) { reached.add('3 Wickets'); timeline.push({ label: '3 Wickets in a Match', date: m.matchDate }); } }

        // Career Cumulative Milestones (Dynamic Detection)
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
        
        // Fielding
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
  }, [players, matches, deliveries, isMounted]);

  if (!isMounted || isPlayersLoading || isMatchesLoading || isDeliveriesLoading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <Loader2 className="w-10 h-10 text-primary animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Processing Analytics...</p>
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
        <TableCell className="text-left py-4"><span className="text-[10px] font-black text-slate-400 uppercase">{label}</span></TableCell>
        <TableCell className="text-center">
          <div className={cn("inline-block px-3 py-1 rounded-full font-black text-sm", isV1Better ? "bg-primary/10 text-primary border border-primary/20" : "text-slate-600")}>{val1}</div>
        </TableCell>
        <TableCell className="text-center">
          <div className={cn("inline-block px-3 py-1 rounded-full font-black text-sm", isV2Better ? "bg-secondary/10 text-secondary border border-secondary/20" : "text-slate-600")}>{val2}</div>
        </TableCell>
      </TableRow>
    );
  };

  const selectedMilestonePlayer = getStats(milestonePid);

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-24 px-4">
      <div className="flex items-center gap-4">
        <div className="bg-primary/10 p-3 rounded-2xl">
          <TrendingUp className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-black font-headline tracking-tighter uppercase text-slate-900">Advanced Insights</h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Professional Intelligence Module</p>
        </div>
      </div>

      <Tabs defaultValue="comparison" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 bg-slate-100 p-1 rounded-xl mb-8 h-12">
          <TabsTrigger value="comparison" className="font-bold data-[state=active]:bg-white data-[state=active]:text-primary rounded-lg">Comparison</TabsTrigger>
          <TabsTrigger value="milestones" className="font-bold data-[state=active]:bg-white data-[state=active]:text-primary rounded-lg">Milestones</TabsTrigger>
        </TabsList>

        <TabsContent value="comparison" className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase text-slate-400 px-1">Player A</label>
              <Select value={p1Id} onValueChange={setP1Id}>
                <SelectTrigger className="h-14 font-bold border-2 border-primary/20 focus:border-primary">
                  <SelectValue placeholder="Choose First Player" />
                </SelectTrigger>
                <SelectContent>
                  {players?.map(p => <SelectItem key={p.id} value={p.id} className="font-bold">{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase text-slate-400 px-1">Player B</label>
              <Select value={p2Id} onValueChange={setP2Id}>
                <SelectTrigger className="h-14 font-bold border-2 border-secondary/20 focus:border-secondary">
                  <SelectValue placeholder="Choose Second Player" />
                </SelectTrigger>
                <SelectContent>
                  {players?.map(p => <SelectItem key={p.id} value={p.id} className="font-bold">{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {p1Id && p2Id ? (
            <Card className="border-none shadow-2xl overflow-hidden bg-white">
              <div className="bg-slate-900 text-white p-6 grid grid-cols-3 items-center text-center">
                <div className="flex flex-col items-center space-y-2">
                  <Avatar className="w-16 h-16 border-4 border-primary shadow-lg"><AvatarImage src={getStats(p1Id)?.imageUrl}/><AvatarFallback>{getStats(p1Id)?.name[0]}</AvatarFallback></Avatar>
                  <span className="font-black uppercase text-xs tracking-tighter truncate max-w-[100px]">{getStats(p1Id)?.name}</span>
                </div>
                <div className="flex justify-center"><ArrowLeftRight className="w-8 h-8 text-slate-600" /></div>
                <div className="flex flex-col items-center space-y-2">
                  <Avatar className="w-16 h-16 border-4 border-secondary shadow-lg"><AvatarImage src={getStats(p2Id)?.imageUrl}/><AvatarFallback>{getStats(p2Id)?.name[0]}</AvatarFallback></Avatar>
                  <span className="font-black uppercase text-xs tracking-tighter truncate max-w-[100px]">{getStats(p2Id)?.name}</span>
                </div>
              </div>
              <Table>
                <TableBody>
                  {renderComparisonRow('Matches Played', getStats(p1Id)?.stats.played, getStats(p2Id)?.stats.played)}
                  {renderComparisonRow('Runs Scored', getStats(p1Id)?.stats.runs, getStats(p2Id)?.stats.runs)}
                  {renderComparisonRow('Batting Avg', (getStats(p1Id)?.stats.runs / (getStats(p1Id)?.stats.timesOut || 1)).toFixed(2), (getStats(p2Id)?.stats.runs / (getStats(p2Id)?.stats.timesOut || 1)).toFixed(2))}
                  {renderComparisonRow('Strike Rate', (getStats(p1Id)?.stats.ballsFaced > 0 ? (getStats(p1Id)?.stats.runs / getStats(p1Id)?.stats.ballsFaced * 100).toFixed(2) : '0.00'), (getStats(p2Id)?.stats.ballsFaced > 0 ? (getStats(p2Id)?.stats.runs / getStats(p2Id)?.stats.ballsFaced * 100).toFixed(2) : '0.00'))}
                  {renderComparisonRow('Boundary %', (getStats(p1Id)?.stats.runs > 0 ? ((getStats(p1Id)?.stats.fours * 4 + getStats(p1Id)?.stats.sixes * 6) / getStats(p1Id)?.stats.runs * 100).toFixed(1) + '%' : '0.0%'), (getStats(p2Id)?.stats.runs > 0 ? ((getStats(p2Id)?.stats.fours * 4 + getStats(p2Id)?.stats.sixes * 6) / getStats(p2Id)?.stats.runs * 100).toFixed(1) + '%' : '0.0%'))}
                  {renderComparisonRow('Wickets', getStats(p1Id)?.stats.wickets, getStats(p2Id)?.stats.wickets)}
                  {renderComparisonRow('Bowling Econ', (getStats(p1Id)?.stats.ballsBowled > 0 ? (getStats(p1Id)?.stats.runsConceded / (getStats(p1Id)?.stats.ballsBowled / 6)).toFixed(2) : '0.00'), (getStats(p2Id)?.stats.ballsBowled > 0 ? (getStats(p2Id)?.stats.runsConceded / (getStats(p2Id)?.stats.ballsBowled / 6)).toFixed(2) : '0.00'), false)}
                  {renderComparisonRow('Wkts/Match', (getStats(p1Id)?.stats.wickets / (getStats(p1Id)?.stats.played || 1)).toFixed(2), (getStats(p2Id)?.stats.wickets / (getStats(p2Id)?.stats.played || 1)).toFixed(2))}
                </TableBody>
              </Table>
            </Card>
          ) : (
            <div className="py-24 text-center border-2 border-dashed rounded-3xl bg-slate-50/50 flex flex-col items-center space-y-4">
              <Zap className="w-12 h-12 text-slate-200" />
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Select two players to unlock dual analytics</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="milestones" className="space-y-8">
          <div className="max-w-md mx-auto space-y-2">
            <label className="text-[9px] font-black uppercase text-slate-400 px-1">Achievement Search</label>
            <Select value={milestonePid} onValueChange={setMilestonePid}>
              <SelectTrigger className="h-14 font-bold border-2 border-amber-500/20 focus:border-amber-500">
                <SelectValue placeholder="Pick a Player to See Achievements" />
              </SelectTrigger>
              <SelectContent>
                {players?.map(p => <SelectItem key={p.id} value={p.id} className="font-bold">{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {selectedMilestonePlayer ? (
            <div className="space-y-10">
              {/* Career Aggregates Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-slate-900 text-white border-none shadow-xl overflow-hidden relative group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Activity className="w-20 h-20" /></div>
                  <CardContent className="p-8 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Total Career Runs</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-black tracking-tighter">{selectedMilestonePlayer.stats.runs}</span>
                      <span className="text-xs font-bold text-slate-500">RUNS</span>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-slate-900 text-white border-none shadow-xl overflow-hidden relative group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Target className="w-20 h-20" /></div>
                  <CardContent className="p-8 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-secondary">Total Career Wickets</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-black tracking-tighter">{selectedMilestonePlayer.stats.wickets}</span>
                      <span className="text-xs font-bold text-slate-500">WKTS</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                  {/* Match Milestones Summary */}
                  <Card className="border-t-8 border-t-amber-500 shadow-xl overflow-hidden">
                    <CardHeader className="bg-slate-50 border-b">
                      <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                        <Award className="w-4 h-4 text-amber-500" /> Match Records
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="grid grid-cols-2 sm:grid-cols-3 border-b">
                        {[
                          { label: '10+ Runs in Match', count: selectedMilestonePlayer.milestoneSummary.r10, icon: Zap, color: 'text-blue-500' },
                          { label: '20+ Runs in Match', count: selectedMilestonePlayer.milestoneSummary.r20, icon: Zap, color: 'text-indigo-500' },
                          { label: '30+ Runs in Match', count: selectedMilestonePlayer.milestoneSummary.r30, icon: Zap, color: 'text-violet-500' },
                          { label: '50+ Runs in Match', count: selectedMilestonePlayer.milestoneSummary.r50, icon: Star, color: 'text-amber-500' },
                          { label: 'Total Fours Hit', count: selectedMilestonePlayer.stats.fours, icon: Zap, color: 'text-emerald-500' },
                          { label: 'Total Sixes Hit', count: selectedMilestonePlayer.stats.sixes, icon: Zap, color: 'text-purple-500' },
                          { label: '1 Wicket in Match', count: selectedMilestonePlayer.milestoneSummary.w1, icon: Target, color: 'text-sky-500' },
                          { label: '2+ Wickets in Match', count: selectedMilestonePlayer.milestoneSummary.w2, icon: Target, color: 'text-sky-600' },
                          { label: '3+ Wickets in Match', count: selectedMilestonePlayer.milestoneSummary.w3, icon: Trophy, color: 'text-sky-700' },
                          { label: 'Catch Taken', count: selectedMilestonePlayer.milestoneSummary.catches, icon: Zap, color: 'text-purple-500' },
                          { label: 'Direct Run Out', count: selectedMilestonePlayer.milestoneSummary.runouts, icon: Zap, color: 'text-rose-500' },
                          { label: 'Man of the Match', count: selectedMilestonePlayer.milestoneSummary.potm, icon: Trophy, color: 'text-amber-600' },
                        ].map((m, i) => (
                          <div key={i} className="p-6 border-r border-b last:border-r-0 flex flex-col items-center text-center space-y-2 hover:bg-slate-50 transition-colors">
                            <m.icon className={cn("w-5 h-5", m.color)} />
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-tighter leading-none">{m.label}</span>
                            <span className="text-2xl font-black text-slate-900">{m.count}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Career Level Progression */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="border-none shadow-md overflow-hidden bg-slate-50/50">
                      <div className="px-4 py-3 bg-primary text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-between">
                        <span>Career Runs Progression</span>
                        <TrendingUp className="w-3 h-3" />
                      </div>
                      <CardContent className="p-4 space-y-2">
                        {selectedMilestonePlayer.careerThresholds.runs.map((t: any, idx: number) => (
                          <div key={idx} className={cn("flex items-center justify-between p-3 rounded-lg border bg-white transition-all", t.achieved ? "border-primary/20 bg-primary/5 shadow-sm" : "opacity-40 grayscale")}>
                            <span className="text-xs font-black text-slate-700">{t.val} Runs</span>
                            {t.achieved ? <CheckCircle2 className="w-4 h-4 text-primary" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-200" />}
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <Card className="border-none shadow-md overflow-hidden bg-slate-50/50">
                      <div className="px-4 py-3 bg-secondary text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-between">
                        <span>Career Wickets Progression</span>
                        <Target className="w-3 h-3" />
                      </div>
                      <CardContent className="p-4 space-y-2">
                        {selectedMilestonePlayer.careerThresholds.wickets.map((t: any, idx: number) => (
                          <div key={idx} className={cn("flex items-center justify-between p-3 rounded-lg border bg-white transition-all", t.achieved ? "border-secondary/20 bg-secondary/5 shadow-sm" : "opacity-40 grayscale")}>
                            <span className="text-xs font-black text-slate-700">{t.val} Wickets</span>
                            {t.achieved ? <CheckCircle2 className="w-4 h-4 text-secondary" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-200" />}
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <div className="space-y-6">
                  <Card className="shadow-lg border-none bg-slate-900 text-white">
                    <CardHeader className="border-b border-white/10">
                      <CardTitle className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                        <History className="w-4 h-4" /> Achievement Timeline
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <div className="relative space-y-8 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/10">
                        {selectedMilestonePlayer.timeline.length > 0 ? selectedMilestonePlayer.timeline.map((event: any, idx: number) => (
                          <div key={idx} className="relative pl-10 group">
                            <div className="absolute left-0 top-1.5 w-6 h-6 rounded-full bg-slate-800 border-2 border-primary flex items-center justify-center z-10 shadow-sm shadow-primary/50">
                              <span className="text-[8px] font-black">{idx + 1}</span>
                            </div>
                            <div>
                              <p className="text-xs font-black uppercase tracking-tight text-white group-hover:text-primary transition-colors">{event.label}</p>
                              <p className="text-[9px] font-bold text-slate-500 uppercase">{new Date(event.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                            </div>
                          </div>
                        )) : (
                          <div className="text-center py-12">
                            <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">No milestones unlocked yet</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-24 text-center border-2 border-dashed rounded-3xl bg-slate-50/50 flex flex-col items-center space-y-4">
              <Trophy className="w-12 h-12 text-slate-200" />
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Select a player to view their professional career timeline</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
