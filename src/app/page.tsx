
"use client"

import { useCollection, useMemoFirebase, useFirestore, useUser, useDoc } from '@/firebase';
import { collection, query, where, orderBy, limit, doc, collectionGroup } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Activity, Users, PlayCircle, Star, Target, Swords, Zap, TrendingUp, ChevronRight, Flame, Medal } from 'lucide-react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { useMemo, useState, useEffect } from 'react';
import { calculatePlayerCVP } from '@/lib/cvp-utils';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { cn } from '@/lib/utils';

export default function Home() {
  const db = useFirestore();
  const { isUmpire } = useApp();
  const { user } = useUser();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);
  
  const umpireRef = useMemoFirebase(() => isUmpire && user?.uid ? doc(db, 'umpires', user.uid) : null, [db, isUmpire, user?.uid]);
  const { data: umpireProfile } = useDoc(umpireRef);

  const liveMatchesQuery = useMemoFirebase(() => query(collection(db, 'matches'), where('status', '==', 'live'), limit(1)), [db]);
  const { data: liveMatches } = useCollection(liveMatchesQuery);
  const liveMatch = liveMatches?.[0];

  const playersQuery = useMemoFirebase(() => query(collection(db, 'players')), [db]);
  const { data: players } = useCollection(playersQuery);

  const teamsQuery = useMemoFirebase(() => query(collection(db, 'teams')), [db]);
  const { data: allTeams } = useCollection(teamsQuery);

  const allMatchesQuery = useMemoFirebase(() => query(collection(db, 'matches')), [db]);
  const { data: allMatches } = useCollection(allMatchesQuery);

  const deliveriesQuery = useMemoFirebase(() => { if (!isMounted) return null; return query(collectionGroup(db, 'deliveryRecords')); }, [db, isMounted]);
  const { data: rawDeliveries, isLoading: isDeliveriesLoading } = useCollection(deliveriesQuery);

  const getTeamName = (id: string) => allTeams?.find(t => t.id === id)?.name || id.substring(0, 8) + '...';

  const heroImage = PlaceHolderImages.find(img => img.id === 'hero-cricket')?.imageUrl || '';

  // Standardized Aggregation for Home View with Ghost-Filter
  const playerAggregates = useMemo(() => {
    if (!players || !allMatches || !rawDeliveries || !isMounted) return {};
    const activeMatchIds = new Set(allMatches.map(m => m.id));
    const stats: Record<string, any> = {};
    
    players.forEach(p => {
      stats[p.id] = { id: p.id, name: p.name, runs: 0, wkts: 0, ballsFaced: 0, ballsBowled: 0, fours: 0, sixes: 0, runsConceded: 0, catches: 0, stumpings: 0, runOuts: 0, cvp: 0 };
    });

    rawDeliveries.forEach(d => {
      const matchId = d.__fullPath?.split('/')[1];
      if (!matchId || !activeMatchIds.has(matchId)) return;

      const sId = d.strikerPlayerId;
      const bId = d.bowlerId || d.bowlerPlayerId;
      const fId = d.fielderPlayerId;

      if (sId && stats[sId]) {
        stats[sId].runs += (d.runsScored || 0);
        if (d.extraType !== 'wide') stats[sId].ballsFaced++;
        if (d.runsScored === 4) stats[sId].fours++;
        if (d.runsScored === 6) stats[sId].sixes++;
      }
      if (bId && stats[bId]) {
        stats[bId].runsConceded += (d.totalRunsOnDelivery || 0);
        if (d.extraType === 'none') stats[bId].ballsBowled++;
        if (d.isWicket && !['runout', 'retired'].includes(d.dismissalType || '')) stats[bId].wkts++;
      }
      if (fId && stats[fId]) {
        if (d.dismissalType === 'caught') stats[fId].catches++;
        if (d.dismissalType === 'stumped') stats[fId].stumpings++;
        if (d.dismissalType === 'runout') stats[fId].runOuts++;
      }
    });

    Object.keys(stats).forEach(id => {
      stats[id].cvp = calculatePlayerCVP(stats[id]);
    });

    return stats;
  }, [players, allMatches, rawDeliveries, isMounted]);

  const topPlayers = useMemo(() => {
    return Object.values(playerAggregates).sort((a: any, b: any) => b.cvp - a.cvp).slice(0, 5);
  }, [playerAggregates]);

  const milestoneAlerts = useMemo(() => {
    if (!playerAggregates) return [];
    const RUN_MILESTONES = [25, 50, 75, 100, 150, 200, 250, 500, 1000];
    const WKT_MILESTONES = Array.from({length: 20}, (_, i) => (i + 1) * 5);

    const alerts: any[] = [];
    Object.values(playerAggregates).forEach((p: any) => {
      // Batting Near-Hits
      const nextRun = RUN_MILESTONES.find(m => m > p.runs);
      if (nextRun) {
        const diff = nextRun - p.runs;
        if (diff <= 5 && p.runs > 0) alerts.push({ name: p.name, id: p.id, type: 'runs', val: p.runs, next: nextRun, diff, icon: Zap, color: 'text-amber-500' });
      }
      // Bowling Near-Hits
      const nextWkt = WKT_MILESTONES.find(m => m > p.wkts);
      if (nextWkt) {
        const diff = nextWkt - p.wkts;
        if (diff <= 1 && p.wkts > 0) alerts.push({ name: p.name, id: p.id, type: 'wickets', val: p.wkts, next: nextWkt, diff, icon: Target, color: 'text-primary' });
      }
    });
    return alerts.sort((a,b) => a.diff - b.diff).slice(0, 3);
  }, [playerAggregates]);

  if (!isMounted) return null;

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-32">
      <section className="relative rounded-3xl overflow-hidden min-h-[400px] flex flex-col justify-end p-8 shadow-2xl border-4 border-white">
        <div className="absolute inset-0 bg-cover bg-center z-0" style={{ backgroundImage: `url('${heroImage}')` }} />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/60 to-transparent z-10" />
        <div className="relative z-20 space-y-4">
          <Badge className="bg-primary text-white uppercase tracking-[0.2em] font-black text-[10px] px-3 py-1 rounded-full">{isUmpire ? 'OFFICIAL UMPIRE MODE' : 'PRO LEAGUE INTERFACE'}</Badge>
          <h1 className="text-4xl font-black font-headline tracking-tighter leading-none text-white">{isUmpire && umpireProfile?.name ? `HELLO, ${umpireProfile.name.split(' ')[0]}` : 'CRICMATES PRO'}</h1>
          <div className="flex gap-2">
            <Button size="sm" className="bg-secondary text-white font-black uppercase text-[10px] rounded-xl h-10 px-6" asChild><Link href="/matches">Live Center</Link></Button>
            {isUmpire && <Button size="sm" variant="outline" className="bg-white/10 text-white border-white/20 font-black uppercase text-[10px] rounded-xl h-10 px-6" asChild><Link href="/match/new">New Match</Link></Button>}
          </div>
        </div>
      </section>

      {milestoneAlerts.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <Flame className="w-5 h-5 text-orange-500 animate-bounce" />
            <h2 className="text-xl font-black uppercase text-slate-900">Milestone Watch</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {milestoneAlerts.map((alert, i) => (
              <Link key={i} href={`/players/${alert.id}`}>
                <Card className="border-none shadow-lg bg-white overflow-hidden hover:scale-[1.02] transition-transform">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-50 rounded-lg"><alert.icon className={cn("w-4 h-4", alert.color)} /></div>
                      <div className="min-w-0">
                        <p className="font-black text-xs uppercase truncate text-slate-900">{alert.name}</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{alert.diff} {alert.type === 'runs' ? 'runs' : 'wicket'} away</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="font-black text-[10px]">NEAR {alert.next}</Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-8">
        <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
          <CardHeader className="bg-slate-50 border-b py-4 px-6 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="text-destructive w-5 h-5 animate-pulse" />
              <CardTitle className="font-black uppercase text-[10px] tracking-widest text-slate-500">Live Broadcast</CardTitle>
            </div>
            {liveMatch && <Badge variant="destructive" className="animate-pulse text-[8px] font-black px-2 py-0.5">LIVE</Badge>}
          </CardHeader>
          <CardContent className="p-6">
            {liveMatch ? (
              <Link href={`/match/${liveMatch.id}`}>
                <div className="bg-slate-900 rounded-2xl p-8 text-white relative overflow-hidden group shadow-2xl">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-transform"><Swords className="w-24 h-24" /></div>
                  <div className="flex justify-between items-center relative z-10 gap-4 mb-8">
                    <p className="font-black text-xl uppercase tracking-tighter leading-tight truncate max-w-[140px] flex-1">
                      {getTeamName(liveMatch.team1Id)}
                    </p>
                    <div className="bg-white/10 h-12 w-12 rounded-full flex items-center justify-center font-black text-sm border border-white/20 shadow-inner shrink-0">VS</div>
                    <p className="font-black text-xl uppercase tracking-tighter leading-tight text-right truncate max-w-[140px] flex-1">
                      {getTeamName(liveMatch.team2Id)}
                    </p>
                  </div>
                  <div className="mt-6 flex justify-center relative z-10">
                    <Button variant="secondary" className="h-12 px-8 font-black uppercase text-xs tracking-widest rounded-xl bg-[#009688] hover:bg-[#00796b] text-white shadow-xl group">
                      Enter Scoreboard <ChevronRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                </div>
              </Link>
            ) : (
              <div className="text-center py-12 border-2 border-dashed rounded-2xl bg-slate-50/50 flex flex-col items-center">
                <PlayCircle className="w-10 h-10 text-slate-200 mb-2" /><p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">No Active Matches</p>
              </div>
            )}
          </CardContent>
        </Card>

        <section className="space-y-4">
          <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 flex items-center gap-2 px-2"><Target className="w-5 h-5 text-primary" /> Top Performers</h2>
          <Card className="shadow-xl border-none rounded-3xl bg-white overflow-hidden">
            <CardContent className="p-2 space-y-1">
              {topPlayers.map((player: any, idx) => (
                <Link key={player.id} href={`/players/${player.id}`} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-all rounded-2xl group">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-900 text-white text-[10px] font-black">{idx + 1}</div>
                    <div className="min-w-0">
                      <p className="font-black text-xs uppercase tracking-tight truncate group-hover:text-primary transition-colors">{player.name}</p>
                      <Badge variant="outline" className="text-[8px] font-black uppercase px-1.5 h-4">Ranked Impact</Badge>
                    </div>
                  </div>
                  <div className="text-right"><p className="text-lg font-black text-slate-900">{player.cvp.toFixed(1)}</p><p className="text-[8px] uppercase font-black text-primary tracking-widest">CVP PTS</p></div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-2 gap-4">
          {[
            { title: 'Teams', icon: Users, href: '/teams', color: 'bg-blue-600' },
            { title: 'Analytics', icon: Zap, href: '/stats', color: 'bg-amber-600' },
            { title: 'Street Pro', icon: PlayCircle, href: '/number-game', color: 'bg-rose-600' },
            { title: 'Insights', icon: TrendingUp, href: '/insights', color: 'bg-indigo-600' },
          ].map((item) => (
            <Link href={item.href} key={item.title}>
              <Card className="hover:shadow-lg transition-all border-none bg-white rounded-2xl p-6 flex flex-col items-center text-center space-y-3">
                <div className={`${item.color}/10 p-4 rounded-xl shadow-inner`}><item.icon className={`w-6 h-6 ${item.color.replace('bg-', 'text-')}`} /></div>
                <h3 className="font-black text-[10px] uppercase tracking-widest text-slate-900">{item.title}</h3>
              </Card>
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}
