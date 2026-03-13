
"use client"

import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, collectionGroup } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Loader2, 
  Zap, 
  Trophy, 
  Target, 
  Shield, 
  Hand, 
  ChevronLeft, 
  Calendar, 
  Swords, 
  Users, 
  Timer, 
  Skull, 
  Star,
  CircleDot,
  AlertCircle,
  Activity
} from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

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
    const validDeliveries = rawDeliveries.filter(d => { 
      const matchId = d.__fullPath?.split('/')[1]; 
      return matchId && activeMatchIds.has(matchId); 
    });
    
    if (validDeliveries.length === 0) return null;

    const batting: any = { 
      highestScore: { val: 0, name: '-', matchId: '' }, 
      most6s: { val: 0, name: '-', matchId: '' }, 
      most4s: { val: 0, name: '-', matchId: '' },
      ballEater: { val: 0, name: '-', matchId: '' },
      fastestFifty: { val: 999, name: '-', matchId: '' }
    };
    const bowling: any = { 
      bestFigures: { wkts: 0, runs: 999, name: '-', matchId: '' }, 
      mostWkts: { val: 0, name: '-', matchId: '' }, 
      bestEcon: { val: 99, name: '-', matchId: '' },
      dotBallKing: { val: 0, name: '-', matchId: '' },
      extraGiver: { val: 0, name: '-', matchId: '' },
      careerMaidens: { val: 0, name: '-' }
    };
    const fielding: any = { 
      mostCatches: { val: 0, name: '-' }, 
      mostRunOuts: { val: 0, name: '-' }, 
      mostStumpings: { val: 0, name: '-' } 
    };

    const pMatchStats: Record<string, Record<string, any>> = {};
    const careerAgg: Record<string, any> = {};
    const globalPartnerships: any[] = [];
    
    // Process Career Totals and Match-wise stats
    players.forEach(p => {
      careerAgg[p.id] = { catches: 0, runOuts: 0, stumpings: 0, maidens: 0 };
    });

    matches.forEach(m => {
      if (m.status !== 'completed') return;
      const mD = validDeliveries.filter(d => d.__fullPath?.split('/')[1] === m.id);
      ['inning_1', 'inning_2'].forEach(inn => processPartnerships(mD.filter(d => d.__fullPath?.includes(inn)), globalPartnerships, m.id));
    });

    validDeliveries.forEach(d => {
      const matchId = d.__fullPath?.split('/')[1];
      const sId = d.strikerPlayerId; 
      const bId = d.bowlerId || d.bowlerPlayerId; 
      const fId = d.fielderPlayerId;

      [sId, bId, fId].filter(id => id && id !== 'none' && careerAgg[id]).forEach(pid => {
        if (!pMatchStats[pid]) pMatchStats[pid] = {};
        if (!pMatchStats[pid][matchId!]) pMatchStats[pid][matchId!] = { runs: 0, balls: 0, wkts: 0, runsCon: 0, ballsB: 0, catches: 0, runOuts: 0, stumpings: 0, fours: 0, sixes: 0, dotsB: 0, dotsF: 0, extras: 0 };
      });

      if (sId && pMatchStats[sId]?.[matchId!]) { 
        const s = pMatchStats[sId][matchId!]; 
        s.runs += (d.runsScored || 0); 
        if (d.extraType !== 'wide') s.balls++;
        if (d.runsScored === 4) s.fours++; 
        if (d.runsScored === 6) s.sixes++; 
        if (d.runsScored === 0 && d.extraType === 'none') s.dotsF++;
      }

      if (bId && pMatchStats[bId]?.[matchId!]) { 
        const b = pMatchStats[bId][matchId!]; 
        b.runsCon += (d.totalRunsOnDelivery || 0); 
        if (d.extraType === 'none') b.ballsB++; 
        if (d.isWicket && !['runout', 'retired'].includes(d.dismissalType || '')) b.wkts++; 
        if (d.totalRunsOnDelivery === 0 && d.extraType === 'none') b.dotsB++;
        if (d.extraType !== 'none') b.extras++;
      }

      if (fId && careerAgg[fId]) { 
        if (d.dismissalType === 'caught') careerAgg[fId].catches++; 
        if (d.dismissalType === 'runout') careerAgg[fId].runOuts++; 
        if (d.dismissalType === 'stumped') careerAgg[fId].stumpings++; 
      }
    });

    players.forEach(p => {
      Object.entries(pMatchStats[p.id] || {}).forEach(([mId, m]: [string, any]) => {
        // Batting Records
        if (m.runs > batting.highestScore.val) batting.highestScore = { val: m.runs, name: p.name, matchId: mId };
        if (m.sixes > batting.most6s.val) batting.most6s = { val: m.sixes, name: p.name, matchId: mId };
        if (m.fours > batting.most4s.val) batting.most4s = { val: m.fours, name: p.name, matchId: mId };
        if (m.balls > batting.ballEater.val) batting.ballEater = { val: m.balls, name: p.name, matchId: mId };
        
        // Bowling Records
        if (m.wkts > bowling.mostWkts.val) bowling.mostWkts = { val: m.wkts, name: p.name, matchId: mId };
        if (m.wkts > bowling.bestFigures.wkts || (m.wkts === bowling.bestFigures.wkts && m.runsCon < bowling.bestFigures.runs && m.ballsB > 0)) {
          bowling.bestFigures = { wkts: m.wkts, runs: m.runsCon, name: p.name, matchId: mId };
        }
        if (m.ballsB >= 12) { 
          const econ = m.runsCon / (m.ballsB / 6); 
          if (econ < bowling.bestEcon.val) bowling.bestEcon = { val: econ, name: p.name, matchId: mId }; 
        }
        if (m.dotsB > bowling.dotBallKing.val) bowling.dotBallKing = { val: m.dotsB, name: p.name, matchId: mId };
        if (m.extras > bowling.extraGiver.val) bowling.extraGiver = { val: m.extras, name: p.name, matchId: mId };
      });

      // Fielding (Career)
      if (careerAgg[p.id].catches > fielding.mostCatches.val) fielding.mostCatches = { val: careerAgg[p.id].catches, name: p.name };
      if (careerAgg[p.id].runOuts > fielding.mostRunOuts.val) fielding.mostRunOuts = { val: careerAgg[p.id].runOuts, name: p.name };
      if (careerAgg[p.id].stumpings > fielding.mostStumpings.val) fielding.mostStumpings = { val: careerAgg[p.id].stumpings, name: p.name };
    });

    return { batting, bowling, fielding, topPartnerships: globalPartnerships.sort((a,b) => b.runs - a.runs).slice(0, 5) };
  }, [players, rawDeliveries, matches, isMounted]);

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
    if (Object.keys(curP.contributions).length >= 2 && (curP.runs > 0 || curP.balls > 0)) {
      list.push({ runs: curP.runs, balls: curP.balls, contributions: { ...curP.contributions }, batters: Object.keys(curP.contributions), matchId, isUnbroken: true });
    }
  }

  const getPlayerName = (id: string) => players?.find(p => p.id === id)?.name || 'Unknown';

  if (!isMounted || isDeliveriesLoading) return <div className="py-20 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" /></div>;

  const RecordCard = ({ title, value, subtitle, icon: Icon, color }: any) => (
    <Card className="border-none shadow-lg bg-white overflow-hidden hover:translate-y-[-2px] transition-all">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={cn("p-3 rounded-2xl shrink-0", color || "bg-slate-50")}>
          <Icon className={cn("w-5 h-5", color ? "text-white" : "text-slate-600")} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
          <p className="text-sm font-black uppercase truncate text-slate-900">{subtitle}</p>
          <p className="text-lg font-black text-primary leading-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-32 px-4 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="rounded-full"><ChevronLeft className="w-6 h-6" /></Button>
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900 leading-none">Hall of Records</h1>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mt-1">Official League Milestones</p>
        </div>
      </div>

      <section className="space-y-6">
        <h2 className="text-xl font-black uppercase flex items-center gap-2 px-2"><Swords className="w-6 h-6 text-primary" /> Batting Elite</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <RecordCard title="Highest Score" value={`${records?.batting.highestScore.val} Runs`} subtitle={records?.batting.highestScore.name} icon={Trophy} color="bg-orange-500" />
          <RecordCard title="Most 6s (Match)" value={`${records?.batting.most6s.val} Sixes`} subtitle={records?.batting.most6s.name} icon={Zap} color="bg-indigo-600" />
          <RecordCard title="Most 4s (Match)" value={`${records?.batting.most4s.val} Fours`} subtitle={records?.batting.most4s.name} icon={Star} color="bg-amber-500" />
          <RecordCard title="Ball Eater (Match)" value={`${records?.batting.ballEater.val} Balls`} subtitle={records?.batting.ballEater.name} icon={Timer} />
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-xl font-black uppercase flex items-center gap-2 px-2"><Target className="w-6 h-6 text-secondary" /> Bowling Kings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <RecordCard title="Best Figures" value={`${records?.bowling.bestFigures.wkts}/${records?.bowling.bestFigures.runs}`} subtitle={records?.bowling.bestFigures.name} icon={Target} color="bg-secondary" />
          <RecordCard title="Best Economy" value={`${records?.bowling.bestEcon.val.toFixed(2)}`} subtitle={records?.bowling.bestEcon.name} icon={Activity} color="bg-emerald-600" />
          <RecordCard title="Dot Ball King" value={`${records?.bowling.dotBallKing.val} Dots`} subtitle={records?.bowling.dotBallKing.name} icon={CircleDot} color="bg-slate-900" />
          <RecordCard title="Extra Giver" value={`${records?.bowling.extraGiver.val} Extras`} subtitle={records?.bowling.extraGiver.name} icon={AlertCircle} color="bg-rose-500" />
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-xl font-black uppercase flex items-center gap-2 px-2"><Shield className="w-6 h-6 text-slate-900" /> Safe Hands (Fielding)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <RecordCard title="Career Catches" value={`${records?.fielding.mostCatches.val} Catches`} subtitle={records?.fielding.mostCatches.name} icon={Hand} />
          <RecordCard title="Direct Hits" value={`${records?.fielding.mostRunOuts.val} Run Outs`} subtitle={records?.fielding.mostRunOuts.name} icon={Swords} />
          <RecordCard title="Keeper's Pride" value={`${records?.fielding.mostStumpings.val} Stumpings`} subtitle={records?.fielding.mostStumpings.name} icon={Shield} />
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-xl font-black uppercase flex items-center gap-2 px-2"><Users className="w-6 h-6 text-primary" /> Elite Partnerships</h2>
        <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="text-[10px] font-black uppercase">Pair & Contributions</TableHead>
                <TableHead className="text-right text-[10px] font-black uppercase">Runs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records?.topPartnerships.map((p, i) => (
                <TableRow key={i} className="hover:bg-slate-50 transition-colors">
                  <TableCell className="py-4">
                    <p className="font-black text-[11px] uppercase truncate max-w-[280px] text-primary">
                      {p.batters.map((id: string) => `${getPlayerName(id)} (${p.contributions[id] || 0})`).join(' & ')}
                    </p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase italic mt-1 flex items-center gap-2">
                      <Timer className="w-3 h-3" /> {p.balls} Balls {p.isUnbroken && <span className="text-emerald-500 font-black">• UNBROKEN STAND</span>}
                    </p>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-black text-slate-900 text-2xl tracking-tighter">{p.runs}</span>
                  </TableCell>
                </TableRow>
              )) || (
                <TableRow>
                  <TableCell colSpan={2} className="text-center py-12">
                    <Users className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                    <p className="text-[10px] font-black uppercase text-slate-300">No major stands recorded</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </section>
    </div>
  );
}
