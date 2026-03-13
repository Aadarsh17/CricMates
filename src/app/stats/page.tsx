"use client"

import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, collectionGroup } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Zap, Trophy, Target, Shield, Hand, ChevronLeft, Calendar, Swords, Users } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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
    const activeMatchIds = new Set(matches.map(m => m.id));
    const validDeliveries = rawDeliveries.filter(d => { const matchId = d.__fullPath?.split('/')[1]; return matchId && activeMatchIds.has(matchId); });
    if (validDeliveries.length === 0) return null;

    const batting: any = { highestScore: { val: 0, name: '-' }, most6s: { val: 0, name: '-' }, most4s: { val: 0, name: '-' } };
    const bowling: any = { bestFigures: { wkts: 0, runs: 999, name: '-' }, mostWkts: { val: 0, name: '-' }, bestEcon: { val: 99, name: '-' } };
    const fielding: any = { mostCatches: { val: 0, name: '-' }, mostRunOuts: { val: 0, name: '-' }, mostStumpings: { val: 0, name: '-' } };
    const pMatchStats: Record<string, Record<string, any>> = {};
    const globalPartnerships: any[] = [];
    
    matches.forEach(m => {
      if (m.status !== 'completed') return;
      const mD = validDeliveries.filter(d => d.__fullPath?.split('/')[1] === m.id);
      ['inning_1', 'inning_2'].forEach(inn => processPartnerships(mD.filter(d => d.__fullPath?.includes(inn)), globalPartnerships, m.id));
    });

    validDeliveries.forEach(d => {
      const matchId = d.__fullPath?.split('/')[1];
      const sId = d.strikerPlayerId; const bId = d.bowlerId || d.bowlerPlayerId; const fId = d.fielderPlayerId;
      [sId, bId, fId].filter(id => id && id !== 'none').forEach(pid => {
        if (!pMatchStats[pid]) pMatchStats[pid] = {};
        if (!pMatchStats[pid][matchId!]) pMatchStats[pid][matchId!] = { runs: 0, balls: 0, wkts: 0, runsCon: 0, ballsB: 0, catches: 0, runOuts: 0, stumpings: 0, fours: 0, sixes: 0 };
      });
      if (sId && pMatchStats[sId]?.[matchId!]) { const s = pMatchStats[sId][matchId!]; s.runs += (d.runsScored || 0); if (d.runsScored === 4) s.fours++; if (d.runsScored === 6) s.sixes++; }
      if (bId && pMatchStats[bId]?.[matchId!]) { const b = pMatchStats[bId][matchId!]; b.runsCon += (d.totalRunsOnDelivery || 0); if (d.extraType === 'none') b.ballsB++; if (d.isWicket && !['runout', 'retired'].includes(d.dismissalType || '')) b.wickets++; }
      if (fId && pMatchStats[fId]?.[matchId!]) { const f = pMatchStats[fId][matchId!]; if (d.dismissalType === 'caught') f.catches++; if (d.dismissalType === 'runout') f.runOuts++; if (d.dismissalType === 'stumped') f.stumpings++; }
    });

    players.forEach(p => {
      Object.values(pMatchStats[p.id] || {}).forEach((m: any) => {
        if (m.runs > batting.highestScore.val) batting.highestScore = { val: m.runs, name: p.name };
        if (m.sixes > batting.most6s.val) batting.most6s = { val: m.sixes, name: p.name };
        if (m.fours > batting.most4s.val) batting.most4s = { val: m.fours, name: p.name };
        if (m.wkts > bowling.mostWkts.val) bowling.mostWkts = { val: m.wkts, name: p.name };
        if (m.wkts > bowling.bestFigures.wkts || (m.wkts === bowling.bestFigures.wkts && m.runsCon < bowling.bestFigures.runs && m.ballsB > 0)) bowling.bestFigures = { wkts: m.wkts, runs: m.runsCon, name: p.name };
        if (m.ballsB >= 12) { const econ = m.runsCon / (m.ballsB / 6); if (econ < bowling.bestEcon.val) bowling.bestEcon = { val: econ, name: p.name }; }
        if (m.catches > fielding.mostCatches.val) fielding.mostCatches = { val: m.catches, name: p.name };
        if (m.runOuts > fielding.mostRunOuts.val) fielding.mostRunOuts = { val: m.runOuts, name: p.name };
        if (m.stumpings > fielding.mostStumpings.val) fielding.mostStumpings = { val: m.stumpings, name: p.name };
      });
    });

    return { batting, bowling, fielding, topPartnerships: globalPartnerships.sort((a,b) => b.runs - a.runs).slice(0, 5) };
  }, [players, rawDeliveries, matches]);

  function processPartnerships(deliveries: any[], list: any[], matchId: string) {
    if (deliveries.length === 0) return;
    deliveries.sort((a,b) => a.timestamp - b.timestamp);
    let curP: any = { runs: 0, balls: 0, contributions: {} as Record<string, number> };
    deliveries.forEach(d => {
      const sId = d.strikerPlayerId; if (!sId) return;
      curP.runs += (d.totalRunsOnDelivery || 0); if (d.extraType === 'none') curP.balls++;
      if (!curP.contributions[sId]) curP.contributions[sId] = 0; curP.contributions[sId] += (d.runsScored || 0);
      if (d.isWicket) {
        if (Object.keys(curP.contributions).length >= 2) list.push({ runs: curP.runs, balls: curP.balls, contributions: { ...curP.contributions }, batters: Object.keys(curP.contributions), matchId });
        curP = { runs: 0, balls: 0, contributions: {} };
      }
    });
    if (Object.keys(curP.contributions).length >= 2 && (curP.runs > 0 || curP.balls > 0)) list.push({ runs: curP.runs, balls: curP.balls, contributions: { ...curP.contributions }, batters: Object.keys(curP.contributions), matchId, isUnbroken: true });
  }

  const getPlayerName = (id: string) => players?.find(p => p.id === id)?.name || 'Unknown';

  if (!isMounted || isDeliveriesLoading) return <div className="py-20 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" /></div>;

  return (
    <div className="max-w-lg mx-auto space-y-10 pb-32 px-4">
      <div className="flex items-center gap-4"><Button variant="ghost" size="icon" onClick={() => router.push('/')} className="rounded-full"><ChevronLeft className="w-6 h-6" /></Button><h1 className="text-2xl font-black uppercase tracking-widest text-slate-900 leading-none">Records Hall</h1></div>
      <section className="space-y-6">
        <h2 className="text-lg font-black uppercase text-slate-900 flex items-center gap-2 px-2 border-l-4 border-slate-900 pl-4"><Swords className="w-5 h-5 text-slate-900" /> Elite Partnerships</h2>
        <Card className="border-none shadow-xl rounded-2xl overflow-hidden bg-white">
          <Table>
            <TableHeader className="bg-slate-50"><TableRow><TableHead className="text-[9px] font-black uppercase">Pair & Contributions</TableHead><TableHead className="text-right text-[9px] font-black uppercase">Runs</TableHead></TableRow></TableHeader>
            <TableBody>
              {records?.topPartnerships.map((p, i) => (
                <TableRow key={i}>
                  <TableCell className="py-3">
                    <p className="font-black text-[10px] uppercase truncate max-w-[220px] text-primary">{p.batters.map((id: string) => `${getPlayerName(id)} (${p.contributions[id] || 0})`).join(' & ')}</p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase italic mt-1">{p.balls} Balls {p.isUnbroken && '• Unbroken stand'}</p>
                  </TableCell>
                  <TableCell className="text-right font-black text-slate-900 text-lg">{p.runs}</TableCell>
                </TableRow>
              )) || <TableRow><TableCell colSpan={2} className="text-center py-8 text-[9px] font-black uppercase text-slate-300">No major stands recorded</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Card>
      </section>
    </div>
  );
}