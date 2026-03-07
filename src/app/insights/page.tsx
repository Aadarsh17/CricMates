
"use client"

import { useState, useMemo, useEffect } from 'react';
import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, orderBy, collectionGroup } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeftRight, Trophy, Zap, Target, Star, History, TrendingUp, CheckCircle2, Award, Activity, FastForward, Clock, Timer, UserCheck, Swords, ShieldAlert, UserCircle } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const RUN_MILESTONES = [50, 100, 200, 500, 1000];
const WICKET_MILESTONES = [25, 50, 100];

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

  const sortedDeliveries = useMemo(() => {
    if (!deliveries) return [];
    return [...deliveries].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  }, [deliveries]);

  const processedData = useMemo(() => {
    if (!players || !matches || !sortedDeliveries) return null;
    const playerInsights: Record<string, any> = {};
    players.forEach(p => {
      playerInsights[p.id] = { id: p.id, name: p.name, imageUrl: p.imageUrl, timeline: [] as any[], stats: { played: 0, runs: 0, ballsFaced: 0, fours: 0, sixes: 0, wickets: 0, ballsBowled: 0, runsConceded: 0, catches: 0, timesOut: 0 }, milestones: { r10: 0, r20: 0, r30: 0, r50: 0, w1: 0, w2: 0, w3: 0 } };
    });

    const matchPerformances: Record<string, Record<string, any>> = {};
    sortedDeliveries.forEach(d => {
      const matchId = d.__fullPath?.split('/')[1]; if (!matchId) return;
      if (!matchPerformances[matchId]) matchPerformances[matchId] = {};
      const pIds = [d.strikerPlayerId, d.bowlerId || d.bowlerPlayerId, d.fielderPlayerId, d.batsmanOutPlayerId].filter(id => id && id !== 'none');
      pIds.forEach(pid => { if (!matchPerformances[matchId][pid]) matchPerformances[matchId][pid] = { runs: 0, balls: 0, fours: 0, sixes: 0, wkts: 0, runsCon: 0, ballsB: 0, catches: 0, out: false }; });
      const s = matchPerformances[matchId][d.strikerPlayerId]; if (s) { s.runs += (d.runsScored || 0); if (d.extraType !== 'wide') s.balls += 1; if (d.runsScored === 4) s.fours += 1; if (d.runsScored === 6) s.sixes += 1; }
      const bId = d.bowlerId || d.bowlerPlayerId; const b = matchPerformances[matchId][bId]; if (b) { b.runsCon += (d.totalRunsOnDelivery || 0); if (d.extraType !== 'wide' && d.extraType !== 'noball') b.ballsB += 1; if (d.isWicket && d.dismissalType !== 'runout' && d.dismissalType !== 'retired') b.wkts += 1; }
      if (d.fielderPlayerId && matchPerformances[matchId][d.fielderPlayerId]) { if (d.dismissalType === 'caught') matchPerformances[matchId][d.fielderPlayerId].catches += 1; }
      if (d.isWicket && d.batsmanOutPlayerId && matchPerformances[matchId][d.batsmanOutPlayerId]) matchPerformances[matchId][d.batsmanOutPlayerId].out = true;
    });

    players.forEach(p => {
      const insight = playerInsights[p.id]; let careerRuns = 0; let careerWickets = 0;
      matches.forEach(m => {
        const perf = matchPerformances[m.id]?.[p.id]; if (!perf) return;
        insight.stats.played++; insight.stats.runs += perf.runs; insight.stats.ballsFaced += perf.balls; insight.stats.fours += perf.fours; insight.stats.sixes += perf.sixes; insight.stats.wickets += perf.wkts; insight.stats.runsConceded += perf.runsCon; insight.stats.ballsBowled += perf.ballsB; insight.stats.catches += perf.catches; if (perf.out) insight.stats.timesOut++;
        careerRuns += perf.runs; careerWickets += perf.wkts;
        if (perf.runs >= 10) insight.milestones.r10++; if (perf.runs >= 30) insight.milestones.r30++; if (perf.runs >= 50) { insight.milestones.r50++; insight.timeline.push({ label: '50 Runs in a Match', date: m.matchDate }); }
        if (perf.wkts >= 1) insight.milestones.w1++; if (perf.wkts >= 3) { insight.milestones.w3++; insight.timeline.push({ label: '3 Wickets in a Match', date: m.matchDate }); }
      });
    });
    return playerInsights;
  }, [players, matches, sortedDeliveries]);

  const rivalryStats = useMemo(() => {
    if (!p1Id || !p2Id || !sortedDeliveries) return null;
    const stats = { p1BatVsP2Bowl: { runs: 0, balls: 0, outs: 0 }, p2BatVsP1Bowl: { runs: 0, balls: 0, outs: 0 } };
    sortedDeliveries.forEach(d => {
      const bId = d.bowlerId || d.bowlerPlayerId;
      if (d.strikerPlayerId === p1Id && bId === p2Id) { stats.p1BatVsP2Bowl.runs += (d.runsScored || 0); if (d.extraType !== 'wide') stats.p1BatVsP2Bowl.balls++; if (d.isWicket && d.batsmanOutPlayerId === p1Id) stats.p1BatVsP2Bowl.outs++; }
      if (d.strikerPlayerId === p2Id && bId === p1Id) { stats.p2BatVsP1Bowl.runs += (d.runsScored || 0); if (d.extraType !== 'wide') stats.p2BatVsP1Bowl.balls++; if (d.isWicket && d.batsmanOutPlayerId === p2Id) stats.p2BatVsP1Bowl.outs++; }
    });
    return stats;
  }, [p1Id, p2Id, sortedDeliveries]);

  if (!isMounted || isPlayersLoading || isMatchesLoading || isDeliveriesLoading) return (<div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4"><Loader2 className="w-10 h-10 text-primary animate-spin" /><p className="text-[10px] font-black uppercase text-slate-400">Syncing Intelligence...</p></div>);

  const getStats = (id: string) => processedData?.[id] || null;

  return (
    <div className="max-w-lg mx-auto space-y-12 pb-32 px-4">
      <div className="flex items-center gap-4">
        <div className="bg-primary p-3 rounded-2xl shadow-xl shadow-primary/20"><TrendingUp className="w-6 h-6 text-white" /></div>
        <div><h1 className="text-2xl font-black uppercase text-slate-900 leading-none">Advanced Insights</h1><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">League Intelligence v2.0</p></div>
      </div>

      {/* RIVALRY SECTION - INTEGRATED */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 px-2"><Swords className="w-5 h-5 text-red-500" /><h2 className="text-lg font-black uppercase text-slate-900">Battle Comparison</h2></div>
        <div className="grid grid-cols-1 gap-4">
          <Select value={p1Id} onValueChange={setP1Id}><SelectTrigger className="h-14 font-black rounded-xl border-2"><SelectValue placeholder="Pick Player A" /></SelectTrigger><SelectContent>{players?.map(p => <SelectItem key={p.id} value={p.id} className="font-bold">{p.name}</SelectItem>)}</SelectContent></Select>
          <Select value={p2Id} onValueChange={setP2Id}><SelectTrigger className="h-14 font-black rounded-xl border-2"><SelectValue placeholder="Pick Player B" /></SelectTrigger><SelectContent>{players?.map(p => <SelectItem key={p.id} value={p.id} className="font-bold">{p.name}</SelectItem>)}</SelectContent></Select>
        </div>

        {p1Id && p2Id && (
          <Card className="border-none shadow-2xl rounded-3xl overflow-hidden bg-white animate-in slide-in-from-bottom-4">
            <div className="bg-slate-950 text-white p-6 grid grid-cols-3 items-center text-center">
              <div className="space-y-2"><Avatar className="w-16 h-16 border-2 border-primary mx-auto rounded-xl"><AvatarImage src={getStats(p1Id)?.imageUrl} /><AvatarFallback>{getStats(p1Id)?.name[0]}</AvatarFallback></Avatar><p className="font-black text-[10px] uppercase truncate">{getStats(p1Id)?.name}</p></div>
              <div className="text-red-500 font-black text-xl italic">VS</div>
              <div className="space-y-2"><Avatar className="w-16 h-16 border-2 border-secondary mx-auto rounded-xl"><AvatarImage src={getStats(p2Id)?.imageUrl} /><AvatarFallback>{getStats(p2Id)?.name[0]}</AvatarFallback></Avatar><p className="font-black text-[10px] uppercase truncate">{getStats(p2Id)?.name}</p></div>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl text-center"><p className="text-[8px] font-black text-slate-400 uppercase">Runs Scored</p><div className="flex justify-center gap-2 items-baseline"><span className="text-xl font-black">{getStats(p1Id)?.stats.runs}</span><span className="text-xs text-slate-300">/</span><span className="text-xl font-black">{getStats(p2Id)?.stats.runs}</span></div></div>
                <div className="p-4 bg-slate-50 rounded-2xl text-center"><p className="text-[8px] font-black text-slate-400 uppercase">Wickets</p><div className="flex justify-center gap-2 items-baseline"><span className="text-xl font-black text-primary">{getStats(p1Id)?.stats.wickets}</span><span className="text-xs text-slate-300">/</span><span className="text-xl font-black text-secondary">{getStats(p2Id)?.stats.wickets}</span></div></div>
              </div>
              <div className="bg-red-50 p-4 rounded-2xl border-2 border-red-100">
                <p className="text-[9px] font-black text-red-500 uppercase text-center mb-3 tracking-widest">Head-to-Head Encounters</p>
                <div className="grid grid-cols-2 divide-x divide-red-200">
                  <div className="text-center px-2"><p className="text-[8px] font-bold text-slate-400 uppercase">{getStats(p1Id)?.name.split(' ')[0]} (Bat) vs {getStats(p2Id)?.name.split(' ')[0]} (Bowl)</p><p className="text-lg font-black text-slate-900">{rivalryStats?.p1BatVsP2Bowl.runs}<span className="text-[10px] text-slate-400 ml-1">Runs</span></p><p className="text-[10px] font-black text-red-600">{rivalryStats?.p1BatVsP2Bowl.outs} Out</p></div>
                  <div className="text-center px-2"><p className="text-[8px] font-bold text-slate-400 uppercase">{getStats(p2Id)?.name.split(' ')[0]} (Bat) vs {getStats(p1Id)?.name.split(' ')[0]} (Bowl)</p><p className="text-lg font-black text-slate-900">{rivalryStats?.p2BatVsP1Bowl.runs}<span className="text-[10px] text-slate-400 ml-1">Runs</span></p><p className="text-[10px] font-black text-red-600">{rivalryStats?.p2BatVsP1Bowl.outs} Out</p></div>
                </div>
              </div>
            </div>
          </Card>
        )}
      </section>

      {/* ACHIEVEMENT TRACKER SECTION */}
      <section className="space-y-6 pt-6 border-t border-dashed">
        <div className="flex items-center gap-2 px-2"><History className="w-5 h-5 text-amber-500" /><h2 className="text-lg font-black uppercase text-slate-900">Achievement Records</h2></div>
        <Select value={milestonePid} onValueChange={setMilestonePid}><SelectTrigger className="h-14 font-black rounded-xl border-2"><SelectValue placeholder="Pick Player to View Legacy" /></SelectTrigger><SelectContent>{players?.map(p => <SelectItem key={p.id} value={p.id} className="font-bold">{p.name}</SelectItem>)}</SelectContent></Select>

        {milestonePid && getStats(milestonePid) && (
          <div className="space-y-6 animate-in zoom-in-95">
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl border-b-4 border-primary">
                <p className="text-[8px] font-black uppercase text-primary tracking-widest">Career Runs</p>
                <p className="text-4xl font-black tracking-tighter">{getStats(milestonePid).stats.runs}</p>
              </Card>
              <Card className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl border-b-4 border-secondary">
                <p className="text-[8px] font-black uppercase text-secondary tracking-widest">Career Wkts</p>
                <p className="text-4xl font-black tracking-tighter">{getStats(milestonePid).stats.wickets}</p>
              </Card>
            </div>
            <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
              <div className="bg-slate-50 p-4 border-b text-[10px] font-black uppercase text-slate-500 text-center tracking-widest">Milestone Timeline</div>
              <div className="p-6 space-y-6">
                {getStats(milestonePid).timeline.length > 0 ? getStats(milestonePid).timeline.map((event: any, i: number) => (
                  <div key={i} className="flex gap-4 items-start relative before:absolute before:left-3 before:top-8 before:bottom-[-20px] before:w-0.5 before:bg-slate-100 last:before:hidden">
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0 z-10 shadow-lg shadow-primary/20"><CheckCircle2 className="w-3 h-3 text-white" /></div>
                    <div className="min-w-0">
                      <p className="font-black text-sm uppercase tracking-tight text-slate-900">{event.label}</p>
                      <p className="text-[10px] font-bold text-slate-400">{new Date(event.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-12"><Clock className="w-10 h-10 text-slate-100 mx-auto mb-2" /><p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No milestones yet</p></div>
                )}
              </div>
            </Card>
          </div>
        )}
      </section>
    </div>
  );
}
