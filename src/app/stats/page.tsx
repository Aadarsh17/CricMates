
"use client"

import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, collectionGroup } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Zap, Trophy, Target, TrendingUp, ChevronRight, Medal, Calendar, Award, Info, Shield, Hand } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { calculatePlayerCVP } from '@/lib/cvp-utils';
import Link from 'next/link';

export default function StatsPage() {
  const db = useFirestore();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  const playersQuery = useMemoFirebase(() => query(collection(db, 'players')), [db]);
  const { data: players } = useCollection(playersQuery);

  const matchesQuery = useMemoFirebase(() => query(collection(db, 'matches')), [db]);
  const { data: matches } = useCollection(matchesQuery);

  const allDeliveriesQuery = useMemoFirebase(() => {
    if (!isMounted) return null;
    return query(collectionGroup(db, 'deliveryRecords'));
  }, [db, isMounted]);
  const { data: rawDeliveries, isLoading: isDeliveriesLoading } = useCollection(allDeliveriesQuery);

  const records = useMemo(() => {
    if (!players || !matches || !rawDeliveries) return null;
    const batting: any = { highestScore: { val: 0, name: '-' }, most6s: { val: 0, name: '-' }, most4s: { val: 0, name: '-' } };
    const bowling: any = { bestFigures: { wkts: 0, runs: 999, name: '-' }, mostWkts: { val: 0, name: '-' }, bestEcon: { val: 99, name: '-' } };
    const fielding: any = { mostCatches: { val: 0, name: '-' }, mostRunOuts: { val: 0, name: '-' } };

    const pMatchStats: Record<string, Record<string, any>> = {};
    rawDeliveries.forEach(d => {
      const matchId = d.__fullPath?.split('/')[1];
      const sId = d.strikerPlayerId; const bId = d.bowlerId || d.bowlerPlayerId; const fId = d.fielderPlayerId;
      const pIds = [sId, bId, fId].filter(id => id && id !== 'none');
      pIds.forEach(pid => {
        if (!pMatchStats[pid]) pMatchStats[pid] = {};
        if (!pMatchStats[pid][matchId!]) pMatchStats[pid][matchId!] = { runs: 0, balls: 0, wkts: 0, runsCon: 0, ballsB: 0, catches: 0, runouts: 0, fours: 0, sixes: 0 };
      });

      if (pMatchStats[sId]) {
        const s = pMatchStats[sId][matchId!];
        s.runs += (d.runsScored || 0);
        if (d.runsScored === 4) s.fours++; if (d.runsScored === 6) s.sixes++;
      }
      if (bId && pMatchStats[bId]) {
        const b = pMatchStats[bId][matchId!];
        b.runsCon += (d.totalRunsOnDelivery || 0);
        if (d.extraType !== 'wide' && d.extraType !== 'noball') b.ballsB++;
        if (d.isWicket && d.dismissalType !== 'runout' && d.dismissalType !== 'retired') b.wkts++;
      }
      if (fId && pMatchStats[fId]) {
        if (d.dismissalType === 'caught') pMatchStats[fId][matchId!].catches++;
        if (d.dismissalType === 'runout') pMatchStats[fId][matchId!].runouts++;
      }
    });

    players.forEach(p => {
      const history = pMatchStats[p.id] || {};
      Object.values(history).forEach((m: any) => {
        if (m.runs > batting.highestScore.val) { batting.highestScore = { val: m.runs, name: p.name }; }
        if (m.sixes > batting.most6s.val) { batting.most6s = { val: m.sixes, name: p.name }; }
        if (m.fours > batting.most4s.val) { batting.most4s = { val: m.fours, name: p.name }; }
        if (m.wkts > bowling.mostWkts.val) { bowling.mostWkts = { val: m.wkts, name: p.name }; }
        if (m.wkts >= bowling.bestFigures.wkts) {
          if (m.wkts > bowling.bestFigures.wkts || m.runsCon < bowling.bestFigures.runs) {
            bowling.bestFigures = { wkts: m.wkts, runs: m.runsCon, name: p.name };
          }
        }
        if (m.ballsB >= 12) {
          const econ = m.runsCon / (m.ballsB / 6);
          if (econ < bowling.bestEcon.val) { bowling.bestEcon = { val: econ, name: p.name }; }
        }
        if (m.catches > fielding.mostCatches.val) { fielding.mostCatches = { val: m.catches, name: p.name }; }
        if (m.runouts > fielding.mostRunOuts.val) { fielding.mostRunOuts = { val: m.runouts, name: p.name }; }
      });
    });

    return { batting, bowling, fielding };
  }, [players, matches, rawDeliveries]);

  if (!isMounted || isDeliveriesLoading) return (<div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4"><Loader2 className="w-10 h-10 text-primary animate-spin" /><p className="text-[10px] font-black uppercase text-slate-400">Syncing Intelligence...</p></div>);

  return (
    <div className="max-w-lg mx-auto space-y-10 pb-32 px-4">
      <div className="flex items-center gap-4"><Medal className="w-8 h-8 text-amber-500" /><h1 className="text-3xl font-black uppercase tracking-tight text-slate-900">Records Hall</h1></div>

      <section className="space-y-6">
        <h2 className="text-lg font-black uppercase text-slate-900 flex items-center gap-2 px-2"><Zap className="w-5 h-5 text-primary" /> Batting Records</h2>
        <div className="grid grid-cols-1 gap-3">
          {[
            { label: 'Highest Score', val: records?.batting.highestScore.val, name: records?.batting.highestScore.name, icon: Trophy },
            { label: 'Most Sixes (Innings)', val: records?.batting.most6s.val, name: records?.batting.most6s.name, icon: Zap },
            { label: 'Most Fours (Innings)', val: records?.batting.most4s.val, name: records?.batting.most4s.name, icon: Zap },
          ].map((r, i) => (
            <Card key={i} className="border-none shadow-sm bg-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-4"><r.icon className="w-5 h-5 text-primary" /><div><p className="text-[10px] font-black uppercase text-slate-400">{r.label}</p><p className="font-black text-slate-900">{r.name}</p></div></div>
              <Badge className="text-lg font-black bg-primary/10 text-primary border-none">{r.val}</Badge>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-lg font-black uppercase text-slate-900 flex items-center gap-2 px-2"><Target className="w-5 h-5 text-secondary" /> Bowling Records</h2>
        <div className="grid grid-cols-1 gap-3">
          <Card className="border-none shadow-sm bg-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-4"><Shield className="w-5 h-5 text-secondary" /><div><p className="text-[10px] font-black uppercase text-slate-400">Best Figures</p><p className="font-black text-slate-900">{records?.bowling.bestFigures.name}</p></div></div>
            <Badge className="text-lg font-black bg-secondary/10 text-secondary border-none">{records?.bowling.bestFigures.wkts}/{records?.bowling.bestFigures.runs}</Badge>
          </Card>
          <Card className="border-none shadow-sm bg-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-4"><Shield className="w-5 h-5 text-secondary" /><div><p className="text-[10px] font-black uppercase text-slate-400">Best Econ (Min 2 Overs)</p><p className="font-black text-slate-900">{records?.bowling.bestEcon.name}</p></div></div>
            <Badge className="text-lg font-black bg-secondary/10 text-secondary border-none">{records?.bowling.bestEcon.val.toFixed(2)}</Badge>
          </Card>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-lg font-black uppercase text-slate-900 flex items-center gap-2 px-2"><Hand className="w-5 h-5 text-emerald-500" /> Fielding Records</h2>
        <div className="grid grid-cols-1 gap-3">
          <Card className="border-none shadow-sm bg-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-4"><Hand className="w-5 h-5 text-emerald-500" /><div><p className="text-[10px] font-black uppercase text-slate-400">Most Catches (Innings)</p><p className="font-black text-slate-900">{records?.fielding.mostCatches.name}</p></div></div>
            <Badge className="text-lg font-black bg-emerald-100 text-emerald-700 border-none">{records?.fielding.mostCatches.val}</Badge>
          </Card>
        </div>
      </section>
    </div>
  );
}
