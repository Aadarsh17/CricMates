"use client"

import { useState, useMemo, useEffect } from 'react';
import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, collectionGroup } from 'firebase/firestore';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Loader2, 
  ChevronLeft, 
  Swords, 
  Crown, 
  Activity, 
  Target, 
  Shield,
  ArrowUpDown,
  Zap,
  MapPin,
  Users,
  Trophy,
  Scale,
  Hand
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn, formatTeamName } from '@/lib/utils';

export default function InsightsPage() {
  const db = useFirestore();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  
  // Selection States
  const [cap1Id, setCap1Id] = useState<string>('');
  const [cap2Id, setCap2Id] = useState<string>('');
  const [rival1Id, setRival1Id] = useState<string>('');
  const [rival2Id, setRival2Id] = useState<string>('');
  const [team1DuelId, setTeam1DuelId] = useState<string>('');
  const [team2DuelId, setTeam2DuelId] = useState<string>('');
  
  // Watchlist specific state
  const [watchlistSort, setWatchlistSort] = useState<'progress' | 'total'>('progress');

  useEffect(() => { setIsMounted(true); }, []);

  const playersQuery = useMemoFirebase(() => query(collection(db, 'players')), [db]);
  const { data: players } = useCollection(playersQuery);

  const teamsQuery = useMemoFirebase(() => query(collection(db, 'teams')), [db]);
  const { data: teams } = useCollection(teamsQuery);

  const matchesQuery = useMemoFirebase(() => query(collection(db, 'matches')), [db]);
  const { data: matches } = useCollection(matchesQuery);

  const deliveriesQuery = useMemoFirebase(() => {
    if (!isMounted) return null;
    return query(collectionGroup(db, 'deliveryRecords'));
  }, [db, isMounted]);
  const { data: rawDeliveries, isLoading: isDeliveriesLoading } = useCollection(deliveriesQuery);

  const activeMatchIds = useMemo(() => new Set(matches?.map(m => m.id) || []), [matches]);
  
  const deliveries = useMemo(() => {
    if (!rawDeliveries || !activeMatchIds.size) return [];
    return rawDeliveries.filter(d => {
      const matchId = d.__fullPath?.split('/')[1];
      return matchId && activeMatchIds.has(matchId);
    });
  }, [rawDeliveries, activeMatchIds]);

  const playerCareerAggregates = useMemo(() => {
    if (!deliveries || !players) return {};
    const stats: Record<string, any> = {};
    const perMatchRuns: Record<string, Record<string, number>> = {}; // pid -> { matchId: runs }

    players.forEach(p => { 
      stats[p.id] = { 
        runs: 0, 
        balls: 0, 
        wkts: 0, 
        runsCon: 0, 
        ballsB: 0, 
        catches: 0, 
        stumpings: 0, 
        runOuts: 0, 
        outs: 0,
        fours: 0,
        sixes: 0,
        battingDots: 0,
        highest: 0,
        lowest: 999
      }; 
    });
    
    deliveries.forEach(d => {
      const matchId = d.__fullPath?.split('/')[1];
      if (d.strikerPlayerId && stats[d.strikerPlayerId]) {
        const s = stats[d.strikerPlayerId];
        s.runs += (d.runsScored || 0);
        if (d.extraType !== 'wide') {
          s.balls++;
          if (d.runsScored === 0) s.battingDots++;
        }
        if (d.runsScored === 4) s.fours++;
        if (d.runsScored === 6) s.sixes++;

        if (matchId) {
          if (!perMatchRuns[d.strikerPlayerId]) perMatchRuns[d.strikerPlayerId] = {};
          perMatchRuns[d.strikerPlayerId][matchId] = (perMatchRuns[d.strikerPlayerId][matchId] || 0) + (d.runsScored || 0);
        }
      }
      if (d.isWicket && stats[d.batsmanOutPlayerId]) stats[d.batsmanOutPlayerId].outs++;

      const bId = d.bowlerId || d.bowlerPlayerId;
      if (bId && bId !== 'none' && stats[bId]) {
        stats[bId].runsCon += (d.totalRunsOnDelivery || 0);
        if (d.extraType === 'none') stats[bId].ballsB++;
        if (d.isWicket && !['runout', 'retired'].includes(d.dismissalType || '')) stats[bId].wkts++;
      }
      const fId = d.fielderPlayerId;
      if (fId && fId !== 'none' && stats[fId]) {
        if (d.dismissalType === 'caught') stats[fId].catches++;
        if (d.dismissalType === 'stumped') stats[fId].stumpings++;
        if (d.dismissalType === 'runout') stats[fId].runOuts++;
      }
    });

    Object.keys(stats).forEach(pid => {
      const scores = Object.values(perMatchRuns[pid] || {});
      if (scores.length > 0) {
        stats[pid].highest = Math.max(...scores);
        stats[pid].lowest = Math.min(...scores);
      } else {
        stats[pid].lowest = 0;
      }
    });

    return stats;
  }, [deliveries, players]);

  const teamAggregates = useMemo(() => {
    if (!matches || !teams) return {};
    const stats: Record<string, any> = {};
    teams.forEach(t => stats[t.id] = { 
      played: 0, won: 0, lost: 0, tied: 0, 
      forR: 0, forB: 0, agR: 0, agB: 0,
      fours: 0, sixes: 0, highest: 0, lowest: 0
    });

    matches.forEach(m => {
      if (m.status !== 'completed' || !stats[m.team1Id] || !stats[m.team2Id]) return;
      stats[m.team1Id].played++; stats[m.team2Id].played++;
      if (m.isTie) { stats[m.team1Id].tied++; stats[m.team2Id].tied++; }
      else if (m.winnerTeamId === m.team1Id) { stats[m.team1Id].won++; stats[m.team2Id].lost++; }
      else if (m.winnerTeamId === m.team2Id) { stats[m.team2Id].won++; stats[m.team1Id].lost++; }
    });

    const inningScores: Record<string, Record<string, number>> = {}; // teamId -> { match_inn: score }

    deliveries.forEach(d => {
      const matchId = d.__fullPath?.split('/')[1];
      const match = matches?.find(m => m.id === matchId);
      if (!match) return;
      const innNum = parseInt(d.__fullPath?.split('/')[3].split('_')[1] || '1');
      const inn1BatId = match.tossWinnerTeamId === match.team1Id ? (match.tossDecision === 'bat' ? match.team1Id : match.team2Id) : (match.tossDecision === 'bat' ? match.team2Id : match.team1Id);
      const batId = innNum === 1 ? inn1BatId : (inn1BatId === match.team1Id ? match.team2Id : match.team1Id);
      const bowlId = batId === match.team1Id ? match.team2Id : match.team1Id;
      
      if (stats[batId]) { 
        stats[batId].forR += d.totalRunsOnDelivery; 
        if (d.extraType === 'none') stats[batId].forB++;
        if (d.runsScored === 4) stats[batId].fours++;
        if (d.runsScored === 6) stats[batId].sixes++;

        // Track per-inning scores for high/low calculation
        const scoreKey = `${matchId}_${innNum}`;
        if (!inningScores[batId]) inningScores[batId] = {};
        inningScores[batId][scoreKey] = (inningScores[batId][scoreKey] || 0) + d.totalRunsOnDelivery;
      }
      if (stats[bowlId]) { stats[bowlId].agR += d.totalRunsOnDelivery; if (d.extraType === 'none') stats[bowlId].agB++; }
    });

    // Finalize high/low
    Object.keys(stats).forEach(tid => {
      const scores = Object.values(inningScores[tid] || {});
      if (scores.length > 0) {
        stats[tid].highest = Math.max(...scores);
        stats[tid].lowest = Math.min(...scores);
      }
    });

    return stats;
  }, [matches, teams, deliveries]);

  const captainStats = useMemo(() => {
    if (!matches || !players) return {};
    const stats: Record<string, any> = {};
    matches.forEach(m => {
      if (m.status !== 'completed') return;
      [ { cid: m.team1CaptainId, tid: m.team1Id }, { cid: m.team2CaptainId, tid: m.team2Id } ].forEach(cap => {
        if (!cap.cid) return;
        if (!stats[cap.cid]) stats[cap.cid] = { played: 0, won: 0 };
        stats[cap.cid].played++;
        if (m.winnerTeamId === cap.tid) stats[cap.cid].won++;
      });
    });
    return stats;
  }, [matches, players]);

  const milestoneWatch = useMemo(() => {
    if (!players || players.length === 0) return { runs: [], wkts: [], catches: [], runOuts: [], stumpings: [] };
    
    const RUN_MILESTONES = [25, 50, 75, 100, 150, 200, 250, 500, 750, 1000];
    const WKT_MILESTONES = [5, 10, 15, 20, 25, 50, 75, 100];
    const FIELDING_MILESTONES = [2, 5, 10, 15, 20, 25, 50];

    const process = (type: string, milestones: number[], key: string) => {
      return players.map(p => {
        const val = playerCareerAggregates[p.id]?.[key] || 0;
        const next = milestones.find(m => m > val) || (Math.floor(val / 5) + 1) * 5;
        const prev = [...milestones].reverse().find(m => m <= val) || 0;
        const progress = next > prev ? ((val - prev) / (next - prev)) * 100 : 0;
        return { 
          ...p, 
          type, 
          current: val, 
          next, 
          diff: next - val, 
          progress, 
          label: `${next - val} more for ${next} Career ${type}` 
        };
      }).sort((a: any, b: any) => watchlistSort === 'progress' ? b.progress - a.progress : b.current - a.current);
    };

    return { 
      runs: process('runs', RUN_MILESTONES, 'runs'),
      wkts: process('wickets', WKT_MILESTONES, 'wkts'),
      catches: process('catches', FIELDING_MILESTONES, 'catches'),
      runOuts: process('run outs', FIELDING_MILESTONES, 'runOuts'),
      stumpings: process('stumpings', FIELDING_MILESTONES, 'stumpings')
    };
  }, [players, playerCareerAggregates, watchlistSort]);

  const groundStats = useMemo(() => {
    if (!matches) return [];
    const venues: Record<string, any> = {};
    matches.forEach(m => {
      const v = m.venue || 'Gully Ground';
      if (!venues[v]) venues[v] = { name: v, played: 0, bat1Won: 0, bat2Win: 0, totalRuns: 0, innings: 0, highest: 0 };
      if (m.status !== 'completed') return;
      venues[v].played++;
      const mDeliveries = deliveries.filter(d => d.__fullPath?.includes(m.id));
      const s1 = mDeliveries.filter(d => d.__fullPath?.includes('inning_1')).reduce((a,b) => a + (b.totalRunsOnDelivery || 0), 0);
      const s2 = mDeliveries.filter(d => d.__fullPath?.includes('inning_2')).reduce((a,b) => a + (b.totalRunsOnDelivery || 0), 0);
      venues[v].totalRuns += (s1 + s2);
      venues[v].innings += (s1 > 0 ? 1 : 0) + (s2 > 0 ? 1 : 0);
      venues[v].highest = Math.max(venues[v].highest, s1, s2);
      
      const bat1TeamId = m.tossWinnerTeamId === m.team1Id ? (m.tossDecision === 'bat' ? m.team1Id : m.team2Id) : (m.tossDecision === 'bat' ? m.team2Id : m.team1Id);
      if (!m.isTie && m.winnerTeamId) {
        if (m.winnerTeamId === bat1TeamId) venues[v].bat1Won++;
        else venues[v].bat2Win++;
      }
    });
    return Object.values(venues).sort((a,b) => b.played - a.played);
  }, [matches, deliveries]);

  if (!isMounted || isDeliveriesLoading) return <div className="py-20 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" /></div>;

  const getPData = (id: string) => playerCareerAggregates[id] || { runs: 0, balls: 0, wkts: 0, runsCon: 0, ballsB: 0, fours: 0, sixes: 0, battingDots: 0, highest: 0, lowest: 0 };
  const getTData = (id: string) => teamAggregates[id] || { played: 0, won: 0, tied: 0, lost: 0, forR: 0, forB: 0, agR: 0, agB: 0, fours: 0, sixes: 0, highest: 0, lowest: 0 };
  const getCData = (id: string) => captainStats[id] || { played: 0, won: 0 };

  const renderMilestoneList = (data: any[]) => (
    <div className="space-y-4">
      {data.slice(0, 10).map((p: any) => (
        <Card key={p.id} className="p-5 border-none shadow-lg rounded-3xl bg-white space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-black uppercase group-hover:text-primary">{p.name}</p>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{p.label}</p>
            </div>
            <div className="text-right"><p className="text-xl font-black text-slate-900 leading-none">{p.current}</p><p className="text-[7px] font-black text-slate-400 uppercase mt-1">Total</p></div>
          </div>
          <div className="space-y-1.5"><Progress value={p.progress} className="h-2 bg-slate-100" /></div>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="max-w-lg mx-auto space-y-12 pb-32 px-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="rounded-full"><ChevronLeft className="w-6 h-6" /></Button>
        <h1 className="text-2xl font-black uppercase text-slate-900 leading-none">Pro Insights</h1>
      </div>

      <Tabs defaultValue="watchlist" className="w-full">
        <TabsList className="grid w-full grid-cols-5 h-12 bg-slate-100 p-1 rounded-xl mb-8">
          <TabsTrigger value="watchlist" className="font-bold text-[8px] uppercase">Watch</TabsTrigger>
          <TabsTrigger value="captaincy" className="font-bold text-[8px] uppercase">Leader</TabsTrigger>
          <TabsTrigger value="comparison" className="font-bold text-[8px] uppercase">Rival</TabsTrigger>
          <TabsTrigger value="franchise" className="font-bold text-[8px] uppercase">Team</TabsTrigger>
          <TabsTrigger value="ground" className="font-bold text-[8px] uppercase">Pitch</TabsTrigger>
        </TabsList>

        <TabsContent value="watchlist" className="space-y-6">
          <div className="flex justify-between items-center px-2">
            <h2 className="text-xl font-black uppercase flex items-center gap-2"><Activity className="w-5 h-5 text-primary" /> Career Watch</h2>
            <Button variant="outline" size="sm" onClick={() => setWatchlistSort(watchlistSort === 'progress' ? 'total' : 'progress')} className="h-8 font-black uppercase text-[8px]">
              {watchlistSort === 'progress' ? 'By Proximity' : 'By Volume'}
            </Button>
          </div>

          <Tabs defaultValue="batting" className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-10 bg-slate-50 p-1 rounded-lg mb-6 border">
              <TabsTrigger value="batting" className="font-bold text-[8px] uppercase">Batting</TabsTrigger>
              <TabsTrigger value="bowling" className="font-bold text-[8px] uppercase">Bowling</TabsTrigger>
              <TabsTrigger value="fielding" className="font-bold text-[8px] uppercase">Fielding</TabsTrigger>
            </TabsList>

            <TabsContent value="batting">
              {renderMilestoneList(milestoneWatch.runs)}
            </TabsContent>

            <TabsContent value="bowling">
              {renderMilestoneList(milestoneWatch.wkts)}
            </TabsContent>

            <TabsContent value="fielding">
              <Tabs defaultValue="caught" className="w-full">
                <TabsList className="grid w-full grid-cols-3 h-8 bg-white p-1 rounded-md mb-4 border border-dashed">
                  <TabsTrigger value="caught" className="text-[7px] font-black uppercase">Caught</TabsTrigger>
                  <TabsTrigger value="runout" className="text-[7px] font-black uppercase">Run Out</TabsTrigger>
                  <TabsTrigger value="stumping" className="text-[7px] font-black uppercase">Stumping</TabsTrigger>
                </TabsList>
                <TabsContent value="caught">
                  {renderMilestoneList(milestoneWatch.catches)}
                </TabsContent>
                <TabsContent value="runout">
                  {renderMilestoneList(milestoneWatch.runOuts)}
                </TabsContent>
                <TabsContent value="stumping">
                  {renderMilestoneList(milestoneWatch.stumpings)}
                </TabsContent>
              </Tabs>
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="comparison" className="space-y-6">
          <h2 className="text-xl font-black uppercase flex items-center gap-2 px-2"><ArrowUpDown className="w-5 h-5 text-primary" /> Player Duel</h2>
          <Card className="p-6 border-none shadow-xl rounded-3xl bg-white space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase">Player A</Label>
                <Select value={rival1Id} onValueChange={setRival1Id}><SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{players?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase">Player B</Label>
                <Select value={rival2Id} onValueChange={setRival2Id}><SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{players?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
              </div>
            </div>
            {rival1Id && rival2Id ? (
              <div className="space-y-4 pt-4 border-t">
                {[
                  { label: 'Total Runs', v1: getPData(rival1Id).runs, v2: getPData(rival2Id).runs, format: (v: number) => v },
                  { label: 'Balls Faced', v1: getPData(rival1Id).balls, v2: getPData(rival2Id).balls, format: (v: number) => v },
                  { label: 'Dot Balls', v1: getPData(rival1Id).battingDots, v2: getPData(rival2Id).battingDots, format: (v: number) => v },
                  { label: 'Fours (4s)', v1: getPData(rival1Id).fours, v2: getPData(rival2Id).fours, format: (v: number) => v },
                  { label: 'Sixes (6s)', v1: getPData(rival1Id).sixes, v2: getPData(rival2Id).sixes, format: (v: number) => v },
                  { label: 'Strike Rate', v1: getPData(rival1Id).balls > 0 ? (getPData(rival1Id).runs/getPData(rival1Id).balls)*100 : 0, v2: getPData(rival2Id).balls > 0 ? (getPData(rival2Id).runs/getPData(rival2Id).balls)*100 : 0, format: (v: number) => v.toFixed(1) },
                  { label: 'Wickets', v1: getPData(rival1Id).wkts, v2: getPData(rival2Id).wkts, format: (v: number) => v },
                  { label: 'Economy', v1: getPData(rival1Id).ballsB > 0 ? (getPData(rival1Id).runsCon/(getPData(rival1Id).ballsB/6)) : 99, v2: getPData(rival2Id).ballsB > 0 ? (getPData(rival2Id).runsCon/(getPData(rival2Id).ballsB/6)) : 99, reverse: true, format: (v: number) => v === 99 ? '---' : v.toFixed(2) }
                ].map((row, i) => {
                  const isV1Better = row.reverse ? row.v1 < row.v2 : row.v1 > row.v2;
                  const isV2Better = row.reverse ? row.v2 < row.v1 : row.v2 > row.v1;
                  return (
                    <div key={i} className="space-y-1.5">
                      <div className="flex justify-between text-[10px] font-black uppercase text-slate-400"><span>{row.format(row.v1)}</span><span>{row.label}</span><span>{row.format(row.v2)}</span></div>
                      <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-slate-50">
                        <div className={cn("h-full transition-all", isV1Better ? "bg-primary" : "bg-slate-200")} style={{ flex: (row.v1 || 1) }} />
                        <div className={cn("h-full transition-all", isV2Better ? "bg-secondary" : "bg-slate-200")} style={{ flex: (row.v2 || 1) }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : <div className="text-center py-12 border-2 border-dashed rounded-2xl"><p className="text-[10px] font-black uppercase text-slate-300">Select two players to begin duel</p></div>}
          </Card>
        </TabsContent>

        <TabsContent value="franchise" className="space-y-6">
          <h2 className="text-xl font-black uppercase flex items-center gap-2 px-2"><Scale className="w-5 h-5 text-secondary" /> Franchise Duel</h2>
          <Card className="p-6 border-none shadow-xl rounded-3xl bg-white space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase">Team A</Label>
                <Select value={team1DuelId} onValueChange={setTeam1DuelId}><SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{teams?.map(t => <SelectItem key={t.id} value={t.id}>{formatTeamName(t.name)}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase">Team B</Label>
                <Select value={team2DuelId} onValueChange={setTeam2DuelId}><SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{teams?.map(t => <SelectItem key={t.id} value={t.id}>{formatTeamName(t.name)}</SelectItem>)}</SelectContent></Select>
              </div>
            </div>
            {team1DuelId && team2DuelId ? (
              <div className="space-y-6 pt-4 border-t">
                {[
                  { label: 'Win Rate (%)', v1: getTData(team1DuelId).played > 0 ? (getTData(team1DuelId).won/getTData(team1DuelId).played)*100 : 0, v2: getTData(team2DuelId).played > 0 ? (getTData(team2DuelId).won/getTData(team2DuelId).played)*100 : 0 },
                  { label: 'Inning Avg', v1: getTData(team1DuelId).forB > 0 ? (getTData(team1DuelId).forR / (getTData(team1DuelId).forB/6)) : 0, v2: getTData(team2DuelId).forB > 0 ? (getTData(team2DuelId).forR / (getTData(team2DuelId).forB/6)) : 0 },
                  { label: 'Total 4s', v1: getTData(team1DuelId).fours, v2: getTData(team2DuelId).fours },
                  { label: 'Total 6s', v1: getTData(team1DuelId).sixes, v2: getTData(team2DuelId).sixes },
                  { label: 'Highest Total', v1: getTData(team1DuelId).highest, v2: getTData(team2DuelId).highest },
                  { label: 'Lowest Total', v1: getTData(team1DuelId).lowest, v2: getTData(team2DuelId).lowest, reverse: true }
                ].map((row, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className={cn("flex-1 p-3 rounded-2xl border text-center", (row.reverse ? row.v1 < row.v2 : row.v1 > row.v2) ? "bg-primary/5 border-primary/20" : "bg-slate-50")}>
                      <p className="text-xl font-black">{row.v1.toFixed(row.label.includes('Rate') || row.label.includes('Avg') ? 1 : 0)}</p>
                    </div>
                    <p className="text-[9px] font-black uppercase text-slate-400 w-20 text-center">{row.label}</p>
                    <div className={cn("flex-1 p-3 rounded-2xl border text-center", (row.reverse ? row.v2 < row.v1 : row.v2 > row.v1) ? "bg-secondary/5 border-secondary/20" : "bg-slate-50")}>
                      <p className="text-xl font-black">{row.v2.toFixed(row.label.includes('Rate') || row.label.includes('Avg') ? 1 : 0)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : <div className="text-center py-12 border-2 border-dashed rounded-2xl"><p className="text-[10px] font-black uppercase text-slate-300">Select franchises to compare dominance</p></div>}
          </Card>
        </TabsContent>

        <TabsContent value="captaincy" className="space-y-6">
          <h2 className="text-xl font-black uppercase flex items-center gap-2 px-2"><Crown className="w-5 h-5 text-amber-500" /> Leader Duel</h2>
          <Card className="p-6 border-none shadow-xl rounded-3xl bg-white space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase">Captain A</Label>
                <Select value={cap1Id} onValueChange={setCap1Id}><SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{players?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase">Captain B</Label>
                <Select value={cap2Id} onValueChange={setCap2Id}><SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{players?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
              </div>
            </div>
            {cap1Id && cap2Id ? (
              <div className="space-y-4 pt-4 border-t">
                {[
                  { label: 'Matches Led', v1: getCData(cap1Id).played, v2: getCData(cap2Id).played },
                  { label: 'Wins', v1: getCData(cap1Id).won, v2: getCData(cap2Id).won },
                  { label: 'Success Rate', v1: getCData(cap1Id).played > 0 ? (getCData(cap1Id).won/getCData(cap1Id).played)*100 : 0, v2: getCData(cap2Id).played > 0 ? (getCData(cap2Id).won/getCData(cap2Id).played)*100 : 0, unit: '%' },
                  { label: 'Total Runs', v1: getPData(cap1Id).runs, v2: getPData(cap2Id).runs },
                  { label: 'Highest Score', v1: getPData(cap1Id).highest, v2: getPData(cap2Id).highest },
                  { label: 'Lowest Score', v1: getPData(cap1Id).lowest, v2: getPData(cap2Id).lowest, reverse: true },
                  { label: 'Total 4s', v1: getPData(cap1Id).fours, v2: getPData(cap2Id).fours },
                  { label: 'Total 6s', v1: getPData(cap1Id).sixes, v2: getPData(cap2Id).sixes },
                  { label: 'Wickets', v1: getPData(cap1Id).wkts, v2: getPData(cap2Id).wkts }
                ].map((row, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl">
                    <span className={cn("text-sm font-black", (row.reverse ? row.v1 < row.v2 : row.v1 > row.v2) ? "text-primary" : "text-slate-400")}>{row.v1.toFixed(0)}{(row as any).unit || ''}</span>
                    <span className="text-[9px] font-black uppercase text-slate-500">{row.label}</span>
                    <span className={cn("text-sm font-black", (row.reverse ? row.v2 < row.v1 : row.v2 > row.v1) ? "text-secondary" : "text-slate-400")}>{row.v2.toFixed(0)}{(row as any).unit || ''}</span>
                  </div>
                ))}
              </div>
            ) : <div className="text-center py-12 border-2 border-dashed rounded-2xl"><p className="text-[10px] font-black uppercase text-slate-300">Select two captains to analyze records</p></div>}
          </Card>
        </TabsContent>

        <TabsContent value="ground" className="space-y-6">
          <h2 className="text-xl font-black uppercase flex items-center gap-2 px-2"><MapPin className="w-5 h-5 text-primary" /> Venue Intel</h2>
          <div className="space-y-4">
            {groundStats.map((g, i) => (
              <Card key={i} className="p-6 border-none shadow-xl rounded-3xl bg-white space-y-6 overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4 opacity-5"><MapPin className="w-24 h-24" /></div>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-tight text-slate-900">{g.name}</h3>
                    <Badge variant="secondary" className="text-[8px] font-black uppercase tracking-widest">{g.played} Match Official</Badge>
                  </div>
                  <div className="text-right"><p className="text-2xl font-black text-primary">{(g.totalRuns / (g.innings || 1)).toFixed(0)}</p><p className="text-[8px] font-black text-slate-400 uppercase">Avg Inning</p></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border text-center">
                    <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Batting First Win %</p>
                    <p className="text-xl font-black text-secondary">{g.played > 0 ? ((g.bat1Won / g.played) * 100).toFixed(1) : 0}%</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border text-center">
                    <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Record Total</p>
                    <p className="text-xl font-black text-slate-900">{g.highest}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
