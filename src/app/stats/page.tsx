
"use client"

import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, collectionGroup } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Zap, Trophy, Target, Shield, Hand, ChevronLeft, Calendar } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function StatsPage() {
  const db = useFirestore();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  const playersQuery = useMemoFirebase(() => query(collection(db, 'players')), [db]);
  const { data: players } = useCollection(playersQuery);

  const matchesQuery = useMemoFirebase(() => query(collection(db, 'matches')), [db]);
  const { data: matches } = useCollection(matchesQuery);

  const deliveriesQuery = useMemoFirebase(() => {
    if (!isMounted) return null;
    return query(collectionGroup(db, 'deliveryRecords'));
  }, [db, isMounted]);
  const { data: rawDeliveries, isLoading: isDeliveriesLoading } = useCollection(deliveriesQuery);

  const records = useMemo(() => {
    if (!players || !rawDeliveries || !matches || matches.length === 0) return null;
    
    // Create a set of active match IDs to filter out "ghost" data from deleted matches
    const activeMatchIds = new Set(matches.map(m => m.id));

    const batting: any = { 
      highestScore: { val: 0, name: '-' }, 
      most6s: { val: 0, name: '-' }, 
      most4s: { val: 0, name: '-' }
    };
    const bowling: any = { 
      bestFigures: { wkts: 0, runs: 999, name: '-' }, 
      mostWkts: { val: 0, name: '-' }, 
      bestEcon: { val: 99, name: '-' } 
    };
    const fielding: any = { 
      mostCatches: { val: 0, name: '-' }, 
      mostRunOuts: { val: 0, name: '-' } 
    };

    const pMatchStats: Record<string, Record<string, any>> = {};
    
    // Filter deliveries to only include those belonging to existing matches
    const validDeliveries = rawDeliveries.filter(d => {
      const matchId = d.__fullPath?.split('/')[1];
      return matchId && activeMatchIds.has(matchId);
    });

    if (validDeliveries.length === 0) return null;

    validDeliveries.forEach(d => {
      const matchId = d.__fullPath?.split('/')[1];
      const sId = d.strikerPlayerId; 
      const bId = d.bowlerId || d.bowlerPlayerId; 
      const fId = d.fielderPlayerId;
      
      if (!matchId) return;

      const pIds = [sId, bId, fId].filter(id => id && id !== 'none');
      pIds.forEach(pid => {
        if (!pMatchStats[pid]) pMatchStats[pid] = {};
        if (!pMatchStats[pid][matchId]) {
          pMatchStats[pid][matchId] = { runs: 0, balls: 0, wkts: 0, runsCon: 0, ballsB: 0, catches: 0, runouts: 0, fours: 0, sixes: 0 };
        }
      });

      if (sId && pMatchStats[sId]) {
        const s = pMatchStats[sId][matchId];
        if (s) {
          s.runs += (d.runsScored || 0);
          if (d.runsScored === 4) s.fours++;
          if (d.runsScored === 6) s.sixes++;
        }
      }
      if (bId && pMatchStats[bId]) {
        const b = pMatchStats[bId][matchId];
        if (b) {
          b.runsCon += (d.totalRunsOnDelivery || 0);
          if (d.extraType !== 'wide' && d.extraType !== 'noball') b.ballsB++;
          if (d.isWicket && !['runout', 'retired'].includes(d.dismissalType || '')) b.wickets++;
        }
      }
      if (fId && pMatchStats[fId] && pMatchStats[fId][matchId]) {
        if (d.dismissalType === 'caught') pMatchStats[fId][matchId].catches++;
        if (d.dismissalType === 'runout') pMatchStats[fId][matchId].runouts++;
      }
    });

    players.forEach(p => {
      const history = pMatchStats[p.id] || {};
      Object.values(history).forEach((m: any) => {
        if (m.runs > batting.highestScore.val) batting.highestScore = { val: m.runs, name: p.name };
        if (m.sixes > batting.most6s.val) batting.most6s = { val: m.sixes, name: p.name };
        if (m.fours > batting.most4s.val) batting.most4s = { val: m.fours, name: p.name };
        
        if (m.wkts > bowling.mostWkts.val) bowling.mostWkts = { val: m.wkts, name: p.name };
        if (m.wkts > bowling.bestFigures.wkts || (m.wkts === bowling.bestFigures.wkts && m.runsCon < bowling.bestFigures.runs && m.ballsB > 0)) {
          bowling.bestFigures = { wkts: m.wkts, runs: m.runsCon, name: p.name };
        }
        
        if (m.ballsB >= 12) {
          const econ = m.runsCon / (m.ballsB / 6);
          if (econ < bowling.bestEcon.val) bowling.bestEcon = { val: econ, name: p.name };
        }
        
        if (m.catches > fielding.mostCatches.val) fielding.mostCatches = { val: m.catches, name: p.name };
        if (m.runouts > fielding.mostRunOuts.val) fielding.mostRunOuts = { val: m.runouts, name: p.name };
      });
    });

    if (bowling.bestFigures.runs === 999) bowling.bestFigures = { wkts: 0, runs: 0, name: '-' };

    return { batting, bowling, fielding };
  }, [players, rawDeliveries, matches]);

  if (!isMounted || isDeliveriesLoading) return <div className="py-20 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" /></div>;

  return (
    <div className="max-w-lg mx-auto space-y-10 pb-32 px-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="rounded-full">
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <h1 className="text-2xl font-black uppercase tracking-widest text-slate-900 leading-none">Records Hall</h1>
      </div>

      <section className="space-y-6">
        <h2 className="text-lg font-black uppercase text-slate-900 flex items-center gap-2 px-2 border-l-4 border-primary pl-4">
          <Zap className="w-5 h-5 text-primary" /> Batting Peaks
        </h2>
        <div className="grid grid-cols-1 gap-3">
          {[
            { label: 'Highest Match Score', val: records?.batting.highestScore.val || 0, name: records?.batting.highestScore.name || '-', icon: Trophy },
            { label: 'Most Sixes (Match)', val: records?.batting.most6s.val || 0, name: records?.batting.most6s.name || '-', icon: Zap },
            { label: 'Most Fours (Match)', val: records?.batting.most4s.val || 0, name: records?.batting.most4s.name || '-', icon: Zap },
          ].map((r, i) => (
            <Card key={i} className="border-none shadow-sm bg-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-primary/5 rounded-lg"><r.icon className="w-4 h-4 text-primary" /></div>
                <div><p className="text-[10px] font-black uppercase text-slate-400">{r.label}</p><p className="font-black text-slate-900 uppercase text-xs">{r.name}</p></div>
              </div>
              <Badge className="text-lg font-black bg-primary/10 text-primary border-none rounded-lg h-10 px-4">{r.val}</Badge>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-lg font-black uppercase text-slate-900 flex items-center gap-2 px-2 border-l-4 border-secondary pl-4">
          <Target className="w-5 h-5 text-secondary" /> Bowling Peaks
        </h2>
        <div className="grid grid-cols-1 gap-3">
          <Card className="border-none shadow-sm bg-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-secondary/5 rounded-xl"><Shield className="w-4 h-4 text-secondary" /></div>
              <div><p className="text-[10px] font-black uppercase text-slate-400">Best Figures</p><p className="font-black text-slate-900 uppercase text-xs">{records?.bowling.bestFigures.name || '-'}</p></div>
            </div>
            <Badge className="text-lg font-black bg-secondary/10 text-secondary border-none h-10 px-4">{records?.bowling.bestFigures.wkts || 0}/{records?.bowling.bestFigures.runs || 0}</Badge>
          </Card>
          <Card className="border-none shadow-sm bg-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-secondary/5 rounded-xl"><Shield className="w-4 h-4 text-secondary" /></div>
              <div><p className="text-[10px] font-black uppercase text-slate-400">Best Economy (Min 2 Ov)</p><p className="font-black text-slate-900 uppercase text-xs">{records?.bowling.bestEcon.name || '-'}</p></div>
            </div>
            <Badge className="text-lg font-black bg-secondary/10 text-secondary border-none h-10 px-4">{(records?.bowling.bestEcon.val === 99 || !records) ? '0.00' : records.bowling.bestEcon.val.toFixed(2)}</Badge>
          </Card>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-lg font-black uppercase text-slate-900 flex items-center gap-2 px-2 border-l-4 border-emerald-500 pl-4">
          <Hand className="w-5 h-5 text-emerald-500" /> Fielding Peaks
        </h2>
        <div className="grid grid-cols-1 gap-3">
          {[
            { label: 'Most Catches (Match)', val: records?.fielding.mostCatches.val || 0, name: records?.fielding.mostCatches.name || '-' },
            { label: 'Most Run Outs (Match)', val: records?.fielding.mostRunOuts.val || 0, name: records?.fielding.mostRunOuts.name || '-' },
          ].map((r, i) => (
            <Card key={i} className="border-none shadow-sm bg-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-emerald-50 rounded-lg"><Hand className="w-4 h-4 text-emerald-500" /></div>
                <div><p className="text-[10px] font-black uppercase text-slate-400">{r.label}</p><p className="font-black text-slate-900 uppercase text-xs">{r.name}</p></div>
              </div>
              <Badge className="text-lg font-black bg-emerald-50 text-emerald-700 border-none h-10 px-4">{r.val}</Badge>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
