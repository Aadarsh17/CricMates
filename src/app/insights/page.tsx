
"use client"

import { useState, useMemo, useEffect } from 'react';
import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, orderBy, collectionGroup } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, Zap, Target, Star, History, CheckCircle2, Clock } from 'lucide-react';

export default function InsightsPage() {
  const db = useFirestore();
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  const playersQuery = useMemoFirebase(() => query(collection(db, 'players')), [db]);
  const { data: players } = useCollection(playersQuery);

  const deliveriesQuery = useMemoFirebase(() => {
    if (!isMounted) return null;
    return query(collectionGroup(db, 'deliveryRecords'));
  }, [db, isMounted]);
  const { data: deliveries, isLoading: isDeliveriesLoading } = useCollection(deliveriesQuery);

  const milestones = useMemo(() => {
    if (!players || !deliveries) return null;
    const fastest30: any[] = [];
    const hatTricks: any[] = [];
    const winningKnocks: any[] = [];

    const pInnings: Record<string, Record<string, any>> = {};
    deliveries.forEach(d => {
      const matchId = d.__fullPath?.split('/')[1];
      const sId = d.strikerPlayerId; const bId = d.bowlerId || d.bowlerPlayerId;
      if (!pInnings[sId]) pInnings[sId] = {}; if (!pInnings[sId][matchId!]) pInnings[sId][matchId!] = { runs: 0, balls: 0 };
      const s = pInnings[sId][matchId!];
      s.runs += (d.runsScored || 0);
      if (d.extraType !== 'wide') s.balls++;
      if (s.runs >= 30 && !s.fastest30Recorded) {
        s.fastest30Recorded = true;
        fastest30.push({ name: players.find(p => p.id === sId)?.name, balls: s.balls, runs: s.runs });
      }
    });

    // Simple Hat-trick scan (Consecutive balls by same bowler in same match)
    const bBals: Record<string, Record<string, any[]>> = {};
    const sorted = [...deliveries].sort((a,b) => a.timestamp - b.timestamp);
    sorted.forEach(d => {
      const matchId = d.__fullPath?.split('/')[1];
      const bId = d.bowlerId || d.bowlerPlayerId;
      if (!bBals[bId]) bBals[bId] = {}; if (!bBals[bId][matchId!]) bBals[bId][matchId!] = [];
      const isWkt = d.isWicket && d.dismissalType !== 'runout' && d.dismissalType !== 'retired';
      bBals[bId][matchId!].push(isWkt);
      const balls = bBals[bId][matchId!];
      if (balls.length >= 3 && balls.slice(-3).every(v => v === true)) {
        hatTricks.push({ name: players.find(p => p.id === bId)?.name, matchId });
      }
    });

    return { 
      f30: fastest30.sort((a,b) => a.balls - b.balls).slice(0, 5),
      hats: hatTricks.slice(0, 5)
    };
  }, [players, deliveries]);

  if (!isMounted || isDeliveriesLoading) return (<div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4"><Loader2 className="w-10 h-10 text-primary animate-spin" /><p className="text-[10px] font-black uppercase text-slate-400">Syncing Achievements...</p></div>);

  return (
    <div className="max-w-lg mx-auto space-y-12 pb-32 px-4">
      <div className="flex items-center gap-4">
        <div className="bg-primary p-3 rounded-2xl shadow-xl shadow-primary/20"><TrendingUp className="w-6 h-6 text-white" /></div>
        <div><h1 className="text-2xl font-black uppercase text-slate-900 leading-none">Fastest Milestones</h1><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Advanced Performance Engine</p></div>
      </div>

      <section className="space-y-6">
        <h2 className="text-lg font-black uppercase text-slate-900 flex items-center gap-2 px-2"><Zap className="w-5 h-5 text-amber-500" /> Fastest 30 (T10 Style)</h2>
        <div className="space-y-3">
          {milestones?.f30.length ? milestones.f30.map((m, i) => (
            <Card key={i} className="border-none shadow-sm bg-white p-4 flex items-center justify-between">
              <div><p className="text-xs font-black uppercase text-slate-900">{m.name}</p><p className="text-[8px] font-bold text-slate-400 uppercase">Reached {m.runs} Runs</p></div>
              <Badge className="bg-amber-100 text-amber-700 font-black">{m.balls} BALLS</Badge>
            </Card>
          )) : <div className="p-8 text-center text-slate-300 font-bold uppercase text-[10px]">No Player Has Achieved This Yet</div>}
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-lg font-black uppercase text-slate-900 flex items-center gap-2 px-2"><Target className="w-5 h-5 text-red-500" /> Fastest Hat-tricks</h2>
        <div className="space-y-3">
          {milestones?.hats.length ? milestones.hats.map((m, i) => (
            <Card key={i} className="border-none shadow-sm bg-white p-4 flex items-center justify-between">
              <div><p className="text-xs font-black uppercase text-slate-900">{m.name}</p><p className="text-[8px] font-bold text-slate-400 uppercase">3 Wickets in 3 Balls</p></div>
              <Badge className="bg-red-100 text-red-700 font-black">VALIDATED</Badge>
            </Card>
          )) : <div className="p-8 text-center text-slate-300 font-bold uppercase text-[10px]">No Player Has Achieved This Yet</div>}
        </div>
      </section>
    </div>
  );
}
