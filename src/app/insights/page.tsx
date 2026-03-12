
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
  Flame, 
  Target, 
  Shield,
  Hand,
  ArrowUpDown,
  Zap,
  Crosshair,
  TrendingUp
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function InsightsPage() {
  const db = useFirestore();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  
  // Selection States
  const [cap1Id, setCap1Id] = useState<string>('');
  const [cap2Id, setCap2Id] = useState<string>('');
  const [rival1Id, setRival1Id] = useState<string>('');
  const [rival2Id, setRival2Id] = useState<string>('');
  
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

  // Cross-reference filter to remove orphaned "ghost" data from deleted matches
  const activeMatchIds = useMemo(() => new Set(matches?.map(m => m.id) || []), [matches]);
  
  const deliveries = useMemo(() => {
    if (!rawDeliveries || !activeMatchIds.size) return [];
    return rawDeliveries.filter(d => {
      const matchId = d.__fullPath?.split('/')[1];
      return matchId && activeMatchIds.has(matchId);
    });
  }, [rawDeliveries, activeMatchIds]);

  // Deep Scan Aggregation for accurate career stats (Ghost-free)
  const playerCareerAggregates = useMemo(() => {
    if (!deliveries || !players) return {};
    const stats: Record<string, any> = {};
    
    players.forEach(p => {
      stats[p.id] = { 
        runs: 0, 
        wkts: 0, 
        catches: 0, 
        stumpings: 0,
        runouts: 0
      };
    });

    deliveries.forEach(d => {
      // Batting runs
      if (d.strikerPlayerId && stats[d.strikerPlayerId]) {
        stats[d.strikerPlayerId].runs += (d.runsScored || 0);
      }

      // Bowling wickets
      const bId = d.bowlerId || d.bowlerPlayerId;
      if (bId && bId !== 'none' && stats[bId]) {
        if (d.isWicket && !['runout', 'retired'].includes(d.dismissalType || '')) {
          stats[bId].wkts++;
        }
      }

      // Fielding dismissals
      const fId = d.fielderPlayerId;
      if (fId && fId !== 'none' && stats[fId]) {
        if (d.dismissalType === 'caught') stats[fId].catches++;
        if (d.dismissalType === 'stumped') stats[fId].stumpings++;
        if (d.dismissalType === 'runout') stats[fId].runouts++;
      }
    });
    return stats;
  }, [deliveries, players]);

  const milestoneWatch = useMemo(() => {
    if (!players || players.length === 0) return { runs: [], wickets: [], catches: [], stumpings: [], runouts: [] };
    
    const RUN_MILESTONES = [25, 50, 75, 100, 150, 200, 250, 500, 750, 1000];
    const WKT_MILESTONES = Array.from({length: 20}, (_, i) => (i + 1) * 5); 
    const CATCH_MILESTONES = Array.from({length: 20}, (_, i) => (i + 1) * 5);
    const STUMP_MILESTONES = [2, 5, 10, 15, 20, 25, 30, 40, 50];
    const RUNOUT_MILESTONES = Array.from({length: 10}, (_, i) => (i + 1) * 5);

    const getProg = (val: number, milestones: number[]) => {
      const next = milestones.find(m => m > val) || (Math.floor(val / 5) + 1) * 5;
      const prev = [...milestones].reverse().find(m => m <= val) || 0;
      const diff = next - val;
      const range = next - prev;
      const progress = range > 0 ? ((val - prev) / range) * 100 : 0;
      return { next, diff, prev, progress };
    };

    const process = (type: string, milestones: number[], key: string) => {
      return players.map(p => {
        const val = playerCareerAggregates[p.id]?.[key] || 0;
        if (val === 0 && milestones[0] > 5) return null; 
        
        const { next, diff, progress } = getProg(val, milestones);
        
        let labelSuffix = type;
        if (type === 'runs') labelSuffix = 'Runs';
        if (type === 'wickets') labelSuffix = 'Wickets';
        if (type === 'catches') labelSuffix = 'Catches';
        if (type === 'stumpings') labelSuffix = 'Stumpings';
        if (type === 'runouts') labelSuffix = 'Run Outs';

        return { 
          ...p, 
          type, 
          current: val, 
          next, 
          diff, 
          progress, 
          label: `${diff} ${labelSuffix.toLowerCase()} for ${next} Career ${labelSuffix}`
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => watchlistSort === 'progress' ? b.progress - a.progress : b.current - a.current);
    };

    return {
      runs: process('runs', RUN_MILESTONES, 'runs'),
      wickets: process('wickets', WKT_MILESTONES, 'wkts'),
      catches: process('catches', CATCH_MILESTONES, 'catches'),
      stumpings: process('stumpings', STUMP_MILESTONES, 'stumpings'),
      runouts: process('runouts', RUNOUT_MILESTONES, 'runouts')
    };
  }, [players, playerCareerAggregates, watchlistSort]);

  const captainStats = useMemo(() => {
    if (!matches || !cap1Id || !cap2Id || !deliveries) return null;

    const getCapRecord = (cid: string) => {
      const rec = { played: 0, won: 0, lost: 0, tied: 0, runs: 0, wkts: 0 };
      matches.forEach(m => {
        if (m.status !== 'completed') return;
        const isC1 = m.team1CaptainId === cid;
        const isC2 = m.team2CaptainId === cid;
        if (!isC1 && !isC2) return;

        rec.played++;
        const myTeamId = isC1 ? m.team1Id : m.team2Id;
        if (m.isTie) rec.tied++;
        else if (m.winnerTeamId === myTeamId) rec.won++;
        else if (m.winnerTeamId && m.winnerTeamId !== 'none') rec.lost++;
      });

      deliveries.forEach(d => {
        if (d.strikerPlayerId === cid) rec.runs += (d.runsScored || 0);
        const bId = d.bowlerId || d.bowlerPlayerId;
        if (bId === cid) {
          if (d.isWicket && !['runout', 'retired'].includes(d.dismissalType || '')) rec.wkts++;
        }
      });

      return rec;
    };

    const h2h = { c1Won: 0, c2Won: 0, ties: 0 };
    matches.forEach(m => {
      if (m.status !== 'completed') return;
      const isC1_T1 = m.team1CaptainId === cap1Id;
      const isC1_T2 = m.team2CaptainId === cap1Id;
      const isC2_T1 = m.team1CaptainId === cap2Id;
      const isC2_T2 = m.team2CaptainId === cap2Id;

      if ((isC1_T1 && isC2_T2) || (isC1_T2 && isC2_T1)) {
        if (m.isTie) h2h.ties++;
        else if (m.winnerTeamId === (isC1_T1 ? m.team1Id : m.team2Id)) h2h.c1Won++;
        else h2h.c2Won++;
      }
    });

    return { cap1: getCapRecord(cap1Id), cap2: getCapRecord(cap2Id), h2h };
  }, [matches, cap1Id, cap2Id, deliveries]);

  const rivalryStats = useMemo(() => {
    if (!deliveries || !rival1Id || !rival2Id) return null;

    const duel = {
      r1_bat_vs_r2_bowl: { runs: 0, balls: 0, wkts: 0, fours: 0, sixes: 0, dots: 0, econ: 0 },
      r2_bat_vs_r1_bowl: { runs: 0, balls: 0, wkts: 0, fours: 0, sixes: 0, dots: 0, econ: 0 }
    };

    deliveries.forEach(d => {
      const bId = d.bowlerId || d.bowlerPlayerId;
      const sId = d.strikerPlayerId;

      if (sId === rival1Id && bId === rival2Id) {
        duel.r1_bat_vs_r2_bowl.runs += (d.totalRunsOnDelivery || 0);
        if (d.extraType !== 'wide') duel.r1_bat_vs_r2_bowl.balls++;
        if (d.runsScored === 4) duel.r1_bat_vs_r2_bowl.fours++;
        if (d.runsScored === 6) duel.r1_bat_vs_r2_bowl.sixes++;
        if (d.runsScored === 0 && d.extraType === 'none') duel.r1_bat_vs_r2_bowl.dots++;
        if (d.isWicket && d.batsmanOutPlayerId === rival1Id && !['runout', 'retired'].includes(d.dismissalType || '')) {
          duel.r1_bat_vs_r2_bowl.wkts++;
        }
      }

      if (sId === rival2Id && bId === rival1Id) {
        duel.r2_bat_vs_r1_bowl.runs += (d.totalRunsOnDelivery || 0);
        if (d.extraType !== 'wide') duel.r2_bat_vs_r1_bowl.balls++;
        if (d.runsScored === 4) duel.r2_bat_vs_r1_bowl.fours++;
        if (d.runsScored === 6) duel.r2_bat_vs_r1_bowl.sixes++;
        if (d.runsScored === 0 && d.extraType === 'none') duel.r2_bat_vs_r1_bowl.dots++;
        if (d.isWicket && d.batsmanOutPlayerId === rival2Id && !['runout', 'retired'].includes(d.dismissalType || '')) {
          duel.r2_bat_vs_r1_bowl.wkts++;
        }
      }
    });

    const calcEcon = (r: number, b: number) => b > 0 ? (r / (b / 6)).toFixed(2) : '0.00';
    duel.r1_bat_vs_r2_bowl.econ = parseFloat(calcEcon(duel.r1_bat_vs_r2_bowl.runs, duel.r1_bat_vs_r2_bowl.balls));
    duel.r2_bat_vs_r1_bowl.econ = parseFloat(calcEcon(duel.r2_bat_vs_r1_bowl.runs, duel.r2_bat_vs_r1_bowl.balls));

    return duel;
  }, [deliveries, rival1Id, rival2Id]);

  if (!isMounted || isDeliveriesLoading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <Loader2 className="w-10 h-10 text-primary animate-spin" />
      <p className="text-[10px] font-black uppercase text-slate-400">Scanning Records Hall...</p>
    </div>
  );

  const getPlayerName = (id: string) => players?.find(p => p.id === id)?.name || 'Unknown';

  const renderMilestoneCard = (p: any) => (
    <Card key={`${p.id}-${p.type}`} className="p-5 border-none shadow-lg rounded-3xl bg-white space-y-4 hover:shadow-xl transition-all group">
      <div className="flex justify-between items-start">
        <Link href={`/players/${p.id}`} className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-black uppercase truncate group-hover:text-primary transition-colors">{p.name}</p>
            {p.progress > 85 && <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500 animate-pulse" />}
          </div>
          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
            {p.label}
          </p>
        </Link>
        <div className="text-right shrink-0">
          <p className="text-xl font-black text-slate-900 leading-none">{p.current}</p>
          <p className="text-[7px] font-black text-slate-400 uppercase mt-1">Total</p>
        </div>
      </div>
      <div className="space-y-1.5">
        <Progress value={p.progress} className="h-2 bg-slate-100" />
        <div className="flex justify-between text-[7px] font-black uppercase tracking-tighter text-slate-400">
          <span>Tier Progress</span>
          <span>{p.progress.toFixed(0)}% Near {p.next}</span>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="max-w-lg mx-auto space-y-12 pb-32 px-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="rounded-full">
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <div>
          <h1 className="text-2xl font-black uppercase text-slate-900 leading-none">Pro Insights</h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Deep Scan achievement Engine</p>
        </div>
      </div>

      <Tabs defaultValue="watchlist" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-12 bg-slate-100 p-1 rounded-xl mb-8">
          <TabsTrigger value="watchlist" className="font-bold text-[10px] uppercase">Watchlist</TabsTrigger>
          <TabsTrigger value="captaincy" className="font-bold text-[10px] uppercase">Leader</TabsTrigger>
          <TabsTrigger value="comparison" className="font-bold text-[10px] uppercase">Rivalry</TabsTrigger>
        </TabsList>

        <TabsContent value="watchlist" className="space-y-8 animate-in fade-in">
          <div className="space-y-6">
            <div className="flex justify-between items-center px-2">
              <h2 className="text-xl font-black uppercase flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" /> Career Watch
              </h2>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setWatchlistSort(watchlistSort === 'progress' ? 'total' : 'progress')}
                className="h-8 font-black uppercase text-[8px] border-slate-200"
              >
                <ArrowUpDown className="w-3 h-3 mr-1" />
                {watchlistSort === 'progress' ? 'By Proximity' : 'By Volume'}
              </Button>
            </div>

            <Tabs defaultValue="runs" className="w-full">
              <TabsList className="grid w-full grid-cols-5 h-10 bg-slate-50 p-1 rounded-xl mb-6">
                <TabsTrigger value="runs" className="font-bold text-[8px] uppercase">Bat</TabsTrigger>
                <TabsTrigger value="wickets" className="font-bold text-[8px] uppercase">Bowl</TabsTrigger>
                <TabsTrigger value="catches" className="font-bold text-[8px] uppercase">Field</TabsTrigger>
                <TabsTrigger value="runouts" className="font-bold text-[8px] uppercase">Aim</TabsTrigger>
                <TabsTrigger value="stumpings" className="font-bold text-[8px] uppercase">Keep</TabsTrigger>
              </TabsList>

              {[
                { id: 'runs', icon: Zap, color: 'text-amber-500' },
                { id: 'wickets', icon: Target, color: 'text-primary' },
                { id: 'catches', icon: Hand, color: 'text-emerald-500' },
                { id: 'runouts', icon: Crosshair, color: 'text-rose-500' },
                { id: 'stumpings', icon: Shield, color: 'text-indigo-500' }
              ].map(cat => (
                <TabsContent key={cat.id} value={cat.id} className="space-y-4">
                  <div className="flex items-center gap-2 px-2 pb-2 border-b border-dashed">
                    <cat.icon className={cn("w-4 h-4", cat.color)} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      Tiered {cat.id === 'runouts' ? 'Precision' : cat.id.charAt(0).toUpperCase() + cat.id.slice(1)} Prospects
                    </span>
                  </div>
                  {milestoneWatch[cat.id as keyof typeof milestoneWatch]?.length > 0 ? (
                    <div className="space-y-4">
                      {milestoneWatch[cat.id as keyof typeof milestoneWatch].map((p: any) => renderMilestoneCard(p))}
                    </div>
                  ) : (
                    <div className="p-12 text-center border-2 border-dashed rounded-3xl bg-slate-50/50">
                      <Activity className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Registry scanning {cat.id} data...</p>
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </TabsContent>

        <TabsContent value="captaincy" className="space-y-8">
          <div className="space-y-6">
            <h2 className="text-xl font-black uppercase flex items-center gap-2 px-2"><Crown className="w-5 h-5 text-amber-500" /> Captaincy Analysis</h2>
            <Card className="border-none shadow-xl bg-white p-6 space-y-6 rounded-3xl">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Select Captain A</Label>
                  <Select value={cap1Id} onValueChange={setCap1Id}>
                    <SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Choose Captain" /></SelectTrigger>
                    <SelectContent className="max-h-[250px]">
                      {players?.map(p => <SelectItem key={p.id} value={p.id} className="font-bold">{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-center -my-2 relative z-10">
                  <div className="bg-slate-900 text-white text-[10px] font-black h-8 w-8 rounded-full flex items-center justify-center border-4 border-white shadow-lg">VS</div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Select Captain B</Label>
                  <Select value={cap2Id} onValueChange={setCap2Id}>
                    <SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Choose Captain" /></SelectTrigger>
                    <SelectContent className="max-h-[250px]">
                      {players?.map(p => <SelectItem key={p.id} value={p.id} className="font-bold">{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            {captainStats ? (
              <div className="space-y-6">
                <div className="bg-slate-900 text-white rounded-3xl overflow-hidden shadow-2xl">
                  <div className="p-4 bg-primary text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest">Leadership Head-to-Head</p>
                  </div>
                  <div className="p-6 grid grid-cols-3 items-center gap-4 text-center">
                    <div className="space-y-1">
                      <p className="text-[8px] font-black text-slate-400 uppercase">Wins</p>
                      <p className="text-3xl font-black">{captainStats.h2h.c1Won}</p>
                    </div>
                    <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
                      <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Ties</p>
                      <p className="text-xl font-black">{captainStats.h2h.ties}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[8px] font-black text-slate-400 uppercase">Wins</p>
                      <p className="text-3xl font-black">{captainStats.h2h.c2Won}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {[
                    { id: cap1Id, data: captainStats.cap1, color: 'border-primary' },
                    { id: cap2Id, data: captainStats.cap2, color: 'border-secondary' }
                  ].map((c, i) => (
                    <Card key={i} className={cn("border-t-8 shadow-lg p-5 space-y-4 rounded-3xl", c.color)}>
                      <p className="text-[10px] font-black uppercase text-slate-400 truncate">{getPlayerName(c.id)}</p>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center border-b pb-2">
                          <span className="text-[8px] font-black text-slate-400 uppercase">Played</span>
                          <span className="font-black">{c.data.played}</span>
                        </div>
                        <div className="flex justify-between items-center border-b pb-2">
                          <span className="text-[8px] font-black text-slate-400 uppercase">Win %</span>
                          <span className="font-black text-emerald-600">{c.data.played > 0 ? ((c.data.won / c.data.played) * 100).toFixed(1) : '0.0'}%</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-center pt-2">
                          <div className="bg-slate-50 p-2 rounded-xl">
                            <p className="text-[7px] font-black text-slate-400 uppercase">Runs</p>
                            <p className="text-sm font-black">{c.data.runs}</p>
                          </div>
                          <div className="bg-slate-50 p-2 rounded-xl">
                            <p className="text-[7px] font-black text-slate-400 uppercase">Wkts</p>
                            <p className="text-sm font-black">{c.data.wkts}</p>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-12 text-center border-2 border-dashed rounded-3xl bg-slate-50/50">
                <Crown className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Select two leaders to compare captaincy impact</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="comparison" className="space-y-8">
          <div className="space-y-6">
            <h2 className="text-xl font-black uppercase flex items-center gap-2 px-2"><Swords className="w-5 h-5 text-primary" /> Rivalry Scan</h2>
            <Card className="border-none shadow-xl bg-white p-6 space-y-6 rounded-3xl">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Player 1</Label>
                  <Select value={rival1Id} onValueChange={setRival1Id}>
                    <SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Choose Player" /></SelectTrigger>
                    <SelectContent className="max-h-[250px]">
                      {players?.map(p => <SelectItem key={p.id} value={p.id} className="font-bold">{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-center -my-2 relative z-10">
                  <div className="bg-slate-900 text-white text-[10px] font-black h-8 w-8 rounded-full flex items-center justify-center border-4 border-white shadow-lg">VS</div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Player 2</Label>
                  <Select value={rival2Id} onValueChange={setRival2Id}>
                    <SelectTrigger className="h-12 font-bold"><SelectValue placeholder="Choose Player" /></SelectTrigger>
                    <SelectContent className="max-h-[250px]">
                      {players?.map(p => <SelectItem key={p.id} value={p.id} className="font-bold">{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            {rivalryStats ? (
              <div className="space-y-6 animate-in zoom-in-95">
                <div className="bg-slate-900 text-white rounded-3xl overflow-hidden shadow-2xl">
                  <div className="p-4 bg-[#009688] text-center">
                    <p className="text-[10px] font-black uppercase tracking-widest">Head-to-Head Duel</p>
                  </div>
                  
                  <div className="p-6 space-y-8">
                    {/* Rival 1 Batting vs Rival 2 Bowling */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-end border-b border-white/10 pb-2">
                        <div className="min-w-0">
                          <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Batter</p>
                          <p className="font-black text-xs uppercase truncate text-[#009688]">{getPlayerName(rival1Id)}</p>
                        </div>
                        <div className="text-right min-w-0">
                          <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Bowler</p>
                          <p className="font-black text-xs uppercase truncate text-primary">{getPlayerName(rival2Id)}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 text-center gap-2">
                        <div className="bg-white/5 p-3 rounded-2xl">
                          <p className="text-[7px] font-black text-slate-500 uppercase mb-1">Runs</p>
                          <p className="text-2xl font-black">{rivalryStats.r1_bat_vs_r2_bowl.runs}</p>
                        </div>
                        <div className="bg-white/5 p-3 rounded-2xl">
                          <p className="text-[7px] font-black text-slate-500 uppercase mb-1">Balls</p>
                          <p className="text-2xl font-black">{rivalryStats.r1_bat_vs_r2_bowl.balls}</p>
                        </div>
                        <div className="bg-rose-500/20 border border-rose-500/30 p-3 rounded-2xl">
                          <p className="text-[7px] font-black text-rose-400 uppercase mb-1">Outs</p>
                          <p className="text-2xl font-black text-rose-500">{rivalryStats.r1_bat_vs_r2_bowl.wkts}</p>
                        </div>
                      </div>
                      
                      {/* Secondary Row: 4s, 6s, Dots, Econ */}
                      <div className="grid grid-cols-4 text-center gap-2">
                        <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                          <p className="text-[6px] font-black text-slate-500 uppercase mb-0.5">4s</p>
                          <p className="text-xs font-black text-blue-400">{rivalryStats.r1_bat_vs_r2_bowl.fours}</p>
                        </div>
                        <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                          <p className="text-[6px] font-black text-slate-500 uppercase mb-0.5">6s</p>
                          <p className="text-xs font-black text-primary">{rivalryStats.r1_bat_vs_r2_bowl.sixes}</p>
                        </div>
                        <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                          <p className="text-[6px] font-black text-slate-500 uppercase mb-0.5">Dots</p>
                          <p className="text-xs font-black text-slate-400">{rivalryStats.r1_bat_vs_r2_bowl.dots}</p>
                        </div>
                        <div className="bg-white/10 p-2 rounded-xl border border-primary/20">
                          <p className="text-[6px] font-black text-primary uppercase mb-0.5">Econ</p>
                          <p className="text-xs font-black text-white">{rivalryStats.r1_bat_vs_r2_bowl.econ}</p>
                        </div>
                      </div>

                      <div className="flex justify-center">
                        <Badge variant="outline" className="text-[8px] font-black text-slate-400 border-white/10">
                          S.R. {rivalryStats.r1_bat_vs_r2_bowl.balls > 0 ? ((rivalryStats.r1_bat_vs_r2_bowl.runs / rivalryStats.r1_bat_vs_r2_bowl.balls) * 100).toFixed(1) : '0.0'}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="h-px bg-white/5 flex-1"></div>
                      <TrendingUp className="w-4 h-4 text-white/20" />
                      <div className="h-px bg-white/5 flex-1"></div>
                    </div>

                    {/* Rival 2 Batting vs Rival 1 Bowling */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-end border-b border-white/10 pb-2">
                        <div className="min-w-0">
                          <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Batter</p>
                          <p className="font-black text-xs uppercase truncate text-[#009688]">{getPlayerName(rival2Id)}</p>
                        </div>
                        <div className="text-right min-w-0">
                          <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Bowler</p>
                          <p className="font-black text-xs uppercase truncate text-primary">{getPlayerName(rival1Id)}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 text-center gap-2">
                        <div className="bg-white/5 p-3 rounded-2xl">
                          <p className="text-[7px] font-black text-slate-500 uppercase mb-1">Runs</p>
                          <p className="text-2xl font-black">{rivalryStats.r2_bat_vs_r1_bowl.runs}</p>
                        </div>
                        <div className="bg-white/5 p-3 rounded-2xl">
                          <p className="text-[7px] font-black text-slate-500 uppercase mb-1">Balls</p>
                          <p className="text-2xl font-black">{rivalryStats.r2_bat_vs_r1_bowl.balls}</p>
                        </div>
                        <div className="bg-rose-500/20 border border-rose-500/30 p-3 rounded-2xl">
                          <p className="text-[7px] font-black text-rose-400 uppercase mb-1">Outs</p>
                          <p className="text-2xl font-black text-rose-500">{rivalryStats.r2_bat_vs_r1_bowl.wkts}</p>
                        </div>
                      </div>

                      {/* Secondary Row: 4s, 6s, Dots, Econ */}
                      <div className="grid grid-cols-4 text-center gap-2">
                        <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                          <p className="text-[6px] font-black text-slate-500 uppercase mb-0.5">4s</p>
                          <p className="text-xs font-black text-blue-400">{rivalryStats.r2_bat_vs_r1_bowl.fours}</p>
                        </div>
                        <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                          <p className="text-[6px] font-black text-slate-500 uppercase mb-0.5">6s</p>
                          <p className="text-xs font-black text-primary">{rivalryStats.r2_bat_vs_r1_bowl.sixes}</p>
                        </div>
                        <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                          <p className="text-[6px] font-black text-slate-500 uppercase mb-0.5">Dots</p>
                          <p className="text-xs font-black text-slate-400">{rivalryStats.r2_bat_vs_r1_bowl.dots}</p>
                        </div>
                        <div className="bg-white/10 p-2 rounded-xl border border-primary/20">
                          <p className="text-[6px] font-black text-primary uppercase mb-0.5">Econ</p>
                          <p className="text-xs font-black text-white">{rivalryStats.r2_bat_vs_r1_bowl.econ}</p>
                        </div>
                      </div>

                      <div className="flex justify-center">
                        <Badge variant="outline" className="text-[8px] font-black text-slate-400 border-white/10">
                          S.R. {rivalryStats.r2_bat_vs_r1_bowl.balls > 0 ? ((rivalryStats.r2_bat_vs_r1_bowl.runs / rivalryStats.r2_bat_vs_r1_bowl.balls) * 100).toFixed(1) : '0.0'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center border-2 border-dashed rounded-3xl bg-slate-50/50">
                <Swords className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Select two players to scan their personal rivalry</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
