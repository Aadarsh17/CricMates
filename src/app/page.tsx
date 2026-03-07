"use client"

import { useCollection, useMemoFirebase, useFirestore, useUser, useDoc } from '@/firebase';
import { collection, query, where, orderBy, limit, doc, collectionGroup } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Activity, Users, ArrowRight, PlayCircle, ShieldCheck, Loader2, Star, Target, Swords, Zap } from 'lucide-react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { useMemo, useState, useEffect } from 'react';
import { calculatePlayerCVP } from '@/lib/cvp-utils';

export default function Home() {
  const db = useFirestore();
  const { isUmpire } = useApp();
  const { user } = useUser();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  const umpireRef = useMemoFirebase(() => 
    isUmpire && user?.uid ? doc(db, 'umpires', user.uid) : null, 
  [db, isUmpire, user?.uid]);
  const { data: umpireProfile } = useDoc(umpireRef);

  const liveMatchesQuery = useMemoFirebase(() => 
    query(collection(db, 'matches'), where('status', '==', 'live'), limit(1)), 
  [db]);
  const { data: liveMatches } = useCollection(liveMatchesQuery);
  const liveMatch = liveMatches?.[0];

  const playersQuery = useMemoFirebase(() => query(collection(db, 'players')), [db]);
  const { data: players } = useCollection(playersQuery);

  const allMatchesQuery = useMemoFirebase(() => query(collection(db, 'matches')), [db]);
  const { data: allMatches } = useCollection(allMatchesQuery);

  const deliveriesQuery = useMemoFirebase(() => {
    if (!isMounted) return null;
    return query(collectionGroup(db, 'deliveryRecords'));
  }, [db, isMounted]);
  const { data: rawDeliveries, isLoading: isDeliveriesLoading } = useCollection(deliveriesQuery);

  const topPlayers = useMemo(() => {
    if (!players || !allMatches || !rawDeliveries || !isMounted) return [];
    
    const activeMatchIds = new Set(allMatches.map(m => m.id));
    const playerMatchStats: Record<string, Record<string, any>> = {};

    rawDeliveries.forEach(d => {
      const matchId = d.__fullPath?.split('/')[1];
      if (!matchId || !activeMatchIds.has(matchId)) return;

      const pIds = [d.strikerPlayerId, d.bowlerId || d.bowlerPlayerId, d.fielderPlayerId].filter(id => id && id !== 'none');
      
      pIds.forEach(pid => {
        if (!playerMatchStats[pid]) playerMatchStats[pid] = {};
        if (!playerMatchStats[pid][matchId]) {
          playerMatchStats[pid][matchId] = { id: pid, name: '', runs: 0, wickets: 0, ballsFaced: 0, ballsBowled: 0, catches: 0, stumpings: 0, runOuts: 0, fours: 0, sixes: 0, maidens: 0, runsConceded: 0 };
        }
      });

      const sStats = playerMatchStats[d.strikerPlayerId]?.[matchId];
      if (sStats) {
        sStats.runs += d.runsScored || 0;
        if (d.extraType !== 'wide') sStats.ballsFaced += 1;
      }

      const bId = d.bowlerId || d.bowlerPlayerId;
      const bStats = playerMatchStats[bId]?.[matchId];
      if (bStats) {
        bStats.runsConceded += d.totalRunsOnDelivery || 0;
        if (d.extraType !== 'wide' && d.extraType !== 'noball') bStats.ballsBowled += 1;
        if (d.isWicket && d.dismissalType !== 'runout' && d.dismissalType !== 'retired') bStats.wickets += 1;
      }

      if (d.fielderPlayerId && playerMatchStats[d.fielderPlayerId]?.[matchId]) {
        const fStats = playerMatchStats[d.fielderPlayerId][matchId];
        if (d.dismissalType === 'caught') fStats.catches += 1;
        if (d.dismissalType === 'stumped') fStats.stumpings += 1;
        if (d.dismissalType === 'runout') fStats.runOuts += 1;
      }
    });

    return players.map(p => {
      const mStats = playerMatchStats[p.id] || {};
      let totalCvp = 0;
      Object.values(mStats).forEach(ms => {
        totalCvp += calculatePlayerCVP(ms);
      });
      return { ...p, cvp: totalCvp };
    })
    .filter(s => s.cvp > 0)
    .sort((a, b) => b.cvp - a.cvp)
    .slice(0, 5);
  }, [players, allMatches, rawDeliveries, isMounted]);

  const teamsQuery = useMemoFirebase(() => query(collection(db, 'teams')), [db]);
  const { data: teams } = useCollection(teamsQuery);

  const getTeamName = (teamId: string) => {
    const team = teams?.find(t => t.id === teamId);
    return team ? team.name : 'Unknown Team';
  };

  if (!isMounted) return null;

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-24">
      {/* HERO SECTION: PROFESSIONAL SPORTS BROADCAST STYLE */}
      <section className="relative rounded-[2.5rem] overflow-hidden min-h-[500px] flex items-center shadow-2xl border-4 border-white">
        <div 
          className="absolute inset-0 bg-cover bg-center z-0 scale-105 hover:scale-100 transition-transform duration-1000" 
          style={{ backgroundImage: `url('https://picsum.photos/seed/crickethero/1200/800')` }}
          data-ai-hint="cricket stadium floodlights"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900/80 to-transparent z-10" />
        <div className="relative z-20 text-white px-8 md:px-16 py-12 max-w-3xl space-y-8">
          <Badge className="bg-primary hover:bg-primary text-white border-none uppercase tracking-[0.3em] font-black text-[10px] px-4 py-1.5 rounded-full shadow-lg flex items-center gap-2 w-fit">
            {isUmpire ? <><ShieldCheck className="w-3.5 h-3.5" /> OFFICIAL UMPIRE SYSTEM</> : 'PREMIUM LEAGUE INTERFACE'}
          </Badge>
          <div className="space-y-4">
            <h1 className="text-5xl md:text-7xl font-black font-headline tracking-tighter leading-none">
              {isUmpire && umpireProfile?.name ? `WELCOME, ${umpireProfile.name.split(' ')[0]}` : 'CRICMATES PRO'}
            </h1>
            <p className="text-xl md:text-2xl text-slate-300 font-medium leading-relaxed max-w-xl">
              Precision ball-by-ball scoring, real-time analytics, and comprehensive league intelligence.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 pt-4">
            <Button size="lg" className="bg-secondary hover:bg-secondary/90 hover:scale-105 transition-all h-16 px-10 font-black uppercase text-xs tracking-[0.2em] shadow-2xl rounded-2xl" asChild>
              <Link href="/matches">Live Match Center</Link>
            </Button>
            {isUmpire ? (
              <Button size="lg" variant="outline" className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/20 h-16 px-10 font-black uppercase text-xs tracking-[0.2em] rounded-2xl" asChild>
                <Link href="/match/new">Setup New Match</Link>
              </Button>
            ) : (
              <Button size="lg" variant="outline" className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/20 h-16 px-10 font-black uppercase text-xs tracking-[0.2em] rounded-2xl" asChild>
                <Link href="/teams">Manage Franchises</Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* DASHBOARD GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LIVE ACTION COLUMN */}
        <div className="lg:col-span-8 space-y-8">
          <Card className="border-none shadow-2xl rounded-[2rem] overflow-hidden bg-white">
            <CardHeader className="bg-slate-50 border-b py-6 px-8 flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-destructive/10 p-2 rounded-xl animate-pulse"><Activity className="text-destructive w-6 h-6" /></div>
                <CardTitle className="font-black uppercase text-sm tracking-[0.2em] text-slate-500">Live Broadcast</CardTitle>
              </div>
              {liveMatch && <Badge variant="destructive" className="animate-pulse uppercase text-[10px] font-black px-3 py-1 rounded-full shadow-lg shadow-destructive/20">LIVE NOW</Badge>}
            </CardHeader>
            <CardContent className="p-8">
              {liveMatch ? (
                <div className="bg-slate-900 rounded-[2rem] p-10 text-white relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity"><Swords className="w-40 h-40" /></div>
                  <div className="flex flex-col md:flex-row justify-between items-center gap-10 relative z-10">
                    <div className="flex-1 text-center space-y-2">
                      <p className="font-black text-2xl md:text-3xl uppercase tracking-tighter leading-tight">{getTeamName(liveMatch.team1Id)}</p>
                      <p className="text-[10px] text-primary uppercase font-black tracking-[0.3em]">Home Unit</p>
                    </div>
                    <div className="bg-white/10 h-16 w-16 md:h-20 md:w-20 rounded-full flex items-center justify-center font-black text-2xl border border-white/20 shadow-2xl">VS</div>
                    <div className="flex-1 text-center space-y-2">
                      <p className="font-black text-2xl md:text-3xl uppercase tracking-tighter leading-tight">{getTeamName(liveMatch.team2Id)}</p>
                      <p className="text-[10px] text-secondary uppercase font-black tracking-[0.3em]">Away Unit</p>
                    </div>
                  </div>
                  <div className="mt-12 flex justify-center">
                    <Button variant="secondary" className="h-14 px-8 font-black uppercase text-xs tracking-widest rounded-xl hover:scale-105 transition-all shadow-xl" asChild>
                      <Link href={`/match/${liveMatch.id}`}>ENTER SCOREBOARD <ArrowRight className="ml-3 w-5 h-5" /></Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-20 border-4 border-dashed rounded-[2rem] bg-slate-50/50 flex flex-col items-center">
                  <PlayCircle className="w-16 h-16 text-slate-200 mb-4" />
                  <p className="text-slate-400 text-xs font-black uppercase tracking-[0.3em]">No Active Broadcasts</p>
                  <Button variant="ghost" className="mt-6 text-primary font-black uppercase text-[10px] tracking-widest" asChild><Link href="/matches">View Schedule</Link></Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              { title: 'Franchise Hub', desc: 'Squad & Asset management', icon: Users, href: '/teams', color: 'bg-blue-600' },
              { title: 'Victory Vault', desc: 'Ball-by-ball archives', icon: Trophy, href: '/matches', color: 'bg-secondary' },
            ].map((item) => (
              <Link href={item.href} key={item.title} className="group">
                <Card className="hover:shadow-2xl transition-all border-none bg-white rounded-3xl p-8 flex flex-col items-center text-center space-y-4 hover:-translate-y-1">
                  <div className={`${item.color}/10 p-5 rounded-2xl group-hover:scale-110 transition-transform shadow-inner`}>
                    <item.icon className={`w-10 h-10 ${item.color.replace('bg-', 'text-')}`} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-black text-lg uppercase tracking-tight">{item.title}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">{item.desc}</p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* RANKINGS COLUMN */}
        <div className="lg:col-span-4 space-y-8">
          <Card className="shadow-2xl border-none rounded-[2rem] bg-white overflow-hidden h-full">
            <CardHeader className="bg-slate-900 text-white py-6 px-8 border-b-4 border-primary">
              <CardTitle className="flex items-center gap-3 text-sm font-black uppercase tracking-[0.2em]">
                <Target className="text-primary w-6 h-6" />
                <span>MVP Leaderboard</span>
              </CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">Validated Career CVP Points</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {isDeliveriesLoading ? (
                <div className="flex flex-col items-center py-20 gap-4">
                  <Loader2 className="w-10 h-10 animate-spin text-primary" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Calculating Intelligence...</p>
                </div>
              ) : topPlayers && topPlayers.length > 0 ? topPlayers.map((player, idx) => (
                <div key={player.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-all rounded-2xl border border-transparent hover:border-slate-100 group">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-slate-900 text-white text-[10px] font-black shadow-lg">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="font-black text-sm uppercase tracking-tight group-hover:text-primary transition-colors">{player.name}</p>
                      <Badge variant="outline" className="text-[8px] font-black uppercase px-1.5 h-4 border-slate-200 text-slate-400">{player.role}</Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-slate-900">{player.cvp.toFixed(1)}</p>
                    <p className="text-[8px] uppercase font-black text-primary tracking-widest">CVP PTS</p>
                  </div>
                </div>
              )) : (
                <div className="text-center py-20 border-2 border-dashed rounded-[2rem]">
                  <Zap className="w-12 h-12 text-slate-100 mx-auto mb-2" />
                  <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Awaiting Season Data</p>
                </div>
              )}
              <div className="pt-6 border-t mt-4">
                <Button variant="ghost" className="w-full h-12 text-primary font-black uppercase text-[10px] tracking-widest hover:bg-primary/5 rounded-xl" asChild>
                  <Link href="/rankings">Full Global Rankings <ArrowRight className="ml-2 w-4 h-4" /></Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* QUICK ACCESS FOOTER */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { title: 'INSIGHTS', icon: TrendingUp, href: '/insights', color: 'text-indigo-600' },
          { title: 'ANALYTICS', icon: Zap, href: '/stats', color: 'text-amber-600' },
          { title: 'STREET PRO', icon: PlayCircle, href: '/number-game', color: 'text-rose-600' },
          { title: 'CREDENTIALS', icon: ShieldCheck, href: isUmpire ? '/profile' : '/auth', color: 'text-slate-900' },
        ].map((item) => (
          <Link href={item.href} key={item.title}>
            <Card className="hover:border-primary transition-all cursor-pointer h-full border-2 border-transparent shadow-sm bg-white rounded-2xl group overflow-hidden">
              <CardContent className="p-6 flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 group-hover:text-primary transition-colors">{item.title}</h3>
                  <div className={cn("font-black text-xs uppercase tracking-tight", item.color)}>Launch Module</div>
                </div>
                <item.icon className="w-6 h-6 text-slate-200 group-hover:text-primary transition-all group-hover:scale-110" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}