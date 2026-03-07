
"use client"

import { useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { collection, query, collectionGroup, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Zap, Trophy, Target, TrendingUp, ChevronRight, Medal, Calendar, Award, Info } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { calculatePlayerCVP } from '@/lib/cvp-utils';
import Link from 'next/link';

export default function StatsPage() {
  const db = useFirestore();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  const playersQuery = useMemoFirebase(() => query(collection(db, 'players')), [db]);
  const { data: players } = useCollection(playersQuery);

  const teamsQuery = useMemoFirebase(() => query(collection(db, 'teams')), [db]);
  const { data: teams } = useCollection(teamsQuery);

  const matchesQuery = useMemoFirebase(() => query(collection(db, 'matches')), [db]);
  const { data: matches } = useCollection(matchesQuery);

  const allDeliveriesQuery = useMemoFirebase(() => {
    if (!isMounted) return null;
    return query(collectionGroup(db, 'deliveryRecords'));
  }, [db, isMounted]);
  const { data: rawDeliveries, isLoading: isDeliveriesLoading } = useCollection(allDeliveriesQuery);

  const aggregatedStats = useMemo(() => {
    if (!players || !matches || !rawDeliveries) return null;
    const validMatchIds = new Set(matches.map(m => m.id));
    const pStats: Record<string, Record<string, any>> = {};
    let total4s = 0; let total6s = 0;
    rawDeliveries.forEach(d => {
      const matchId = d.__fullPath?.split('/')[1]; if (!matchId || !validMatchIds.has(matchId)) return;
      if (d.runsScored === 4) total4s++; if (d.runsScored === 6) total6s++;
      const sId = d.strikerPlayerId; const bId = d.bowlerId || d.bowlerPlayerId; const fId = d.fielderPlayerId;
      const ids = [sId, bId, fId].filter(id => id && id !== 'none');
      ids.forEach(id => { if (!pStats[id]) pStats[id] = {}; if (!pStats[id][matchId]) { pStats[id][matchId] = { id, runs: 0, ballsFaced: 0, fours: 0, sixes: 0, wickets: 0, maidens: 0, ballsBowled: 0, runsConceded: 0, catches: 0, out: false }; } });
      if (pStats[sId]?.[matchId]) { pStats[sId][matchId].runs += (d.runsScored || 0); if (d.extraType !== 'wide') pStats[sId][matchId].ballsFaced++; if (d.runsScored === 4) pStats[sId][matchId].fours++; if (d.runsScored === 6) pStats[sId][matchId].sixes++; }
      if (d.isWicket && pStats[d.batsmanOutPlayerId || sId]?.[matchId]) pStats[d.batsmanOutPlayerId || sId][matchId].out = true;
      if (bId && pStats[bId]?.[matchId]) { pStats[bId][matchId].runsConceded += d.totalRunsOnDelivery || 0; if (d.extraType !== 'wide' && d.extraType !== 'noball') pStats[bId][matchId].ballsBowled++; if (d.isWicket && d.dismissalType !== 'runout' && d.dismissalType !== 'retired') pStats[bId][matchId].wickets++; }
      if (fId && pStats[fId]?.[matchId]) { if (d.dismissalType === 'caught') pStats[fId][matchId].catches++; }
    });

    const playerLeaderboard = players.map(p => {
      const matchHistory = pStats[p.id] || {};
      const career = { id: p.id, name: p.name, teamId: p.teamId, imageUrl: p.imageUrl, runs: 0, wickets: 0, cvp: 0, maxScore: 0, maxWkts: 0 };
      Object.values(matchHistory).forEach((ms: any) => { career.runs += ms.runs; career.wickets += ms.wickets; career.maxScore = Math.max(career.maxScore, ms.runs); career.maxWkts = Math.max(career.maxWkts, ms.wickets); career.cvp += calculatePlayerCVP(ms); });
      return career;
    });
    return { total4s, total6s, playerLeaderboard };
  }, [players, matches, rawDeliveries]);

  if (!isMounted || isDeliveriesLoading) return (<div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4"><Loader2 className="w-10 h-10 text-primary animate-spin" /><p className="text-[10px] font-black uppercase text-slate-400">Syncing Tournament Intelligence...</p></div>);

  const topRuns = [...(aggregatedStats?.playerLeaderboard || [])].sort((a,b) => b.runs - a.runs).slice(0, 5);
  const topWkts = [...(aggregatedStats?.playerLeaderboard || [])].sort((a,b) => b.wickets - a.wickets).slice(0, 5);

  return (
    <div className="max-w-lg mx-auto space-y-10 pb-32 px-4">
      <div className="flex items-center gap-4"><Medal className="w-8 h-8 text-amber-500" /><h1 className="text-3xl font-black uppercase tracking-tight text-slate-900">League Leaders</h1></div>

      <Card className="bg-slate-950 text-white rounded-3xl overflow-hidden shadow-2xl p-6">
        <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-4">Boundary Pulse</p>
        <div className="grid grid-cols-2 gap-6 items-center">
          <div className="text-center space-y-1"><p className="text-4xl font-black text-emerald-500">{aggregatedStats?.total4s}</p><p className="text-[8px] font-bold uppercase text-slate-500">Total Fours</p></div>
          <div className="text-center space-y-1"><p className="text-4xl font-black text-purple-500">{aggregatedStats?.total6s}</p><p className="text-[8px] font-bold uppercase text-slate-500">Total Sixes</p></div>
        </div>
      </Card>

      <section className="space-y-6">
        <h2 className="text-lg font-black uppercase text-slate-900 flex items-center gap-2 px-2"><Zap className="w-5 h-5 text-primary" /> Batting Elite</h2>
        <div className="space-y-3">
          {topRuns.map((p, idx) => (
            <Link key={p.id} href={`/players/${p.id}`}>
              <Card className="border-none shadow-sm hover:shadow-md transition-all rounded-2xl overflow-hidden group bg-white">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="font-black text-slate-200 text-xl">{idx + 1}</span>
                    <Avatar className="w-10 h-10 rounded-xl border group-hover:border-primary transition-colors"><AvatarImage src={p.imageUrl} /><AvatarFallback>{p.name[0]}</AvatarFallback></Avatar>
                    <div className="min-w-0"><p className="font-black text-xs uppercase tracking-tight truncate max-w-[120px]">{p.name}</p><p className="text-[8px] font-bold text-slate-400 uppercase">Career Runs</p></div>
                  </div>
                  <div className="text-right"><p className="text-xl font-black text-slate-900">{p.runs}</p><Badge variant="outline" className="text-[8px] font-black px-1.5 h-4">MAX {p.maxScore}</Badge></div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-lg font-black uppercase text-slate-900 flex items-center gap-2 px-2"><Target className="w-5 h-5 text-secondary" /> Bowling Titans</h2>
        <div className="space-y-3">
          {topWkts.map((p, idx) => (
            <Link key={p.id} href={`/players/${p.id}`}>
              <Card className="border-none shadow-sm hover:shadow-md transition-all rounded-2xl overflow-hidden group bg-white">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="font-black text-slate-200 text-xl">{idx + 1}</span>
                    <Avatar className="w-10 h-10 rounded-xl border group-hover:border-secondary transition-colors"><AvatarImage src={p.imageUrl} /><AvatarFallback>{p.name[0]}</AvatarFallback></Avatar>
                    <div className="min-w-0"><p className="font-black text-xs uppercase tracking-tight truncate max-w-[120px]">{p.name}</p><p className="text-[8px] font-bold text-slate-400 uppercase">Career Wickets</p></div>
                  </div>
                  <div className="text-right"><p className="text-xl font-black text-secondary">{p.wickets}</p><Badge variant="outline" className="text-[8px] font-black px-1.5 h-4 border-secondary/20 text-secondary">MAX {p.maxWkts}</Badge></div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
