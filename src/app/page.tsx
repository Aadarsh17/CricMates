
"use client"

import { useCollection, useMemoFirebase, useFirestore, useUser, useDoc } from '@/firebase';
import { collection, query, where, orderBy, limit, doc, collectionGroup } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Activity, Users, PlayCircle, Star, Target, Swords, Zap, TrendingUp, ChevronRight, Flame, Medal, Calendar, Crown } from 'lucide-react';
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

  // Advanced Aggregation Engine with Data Integrity
  const leagueData = useMemo(() => {
    if (!players || !allMatches || !rawDeliveries || !isMounted) return { stats: {}, orangeCapId: '', purpleCapId: '', mvpId: '' };
    const activeMatchIds = new Set(allMatches.map(m => m.id));
    const stats: Record<string, any> = {};
    const pMatchStats: Record<string, Record<string, any>> = {};
    
    // Date for MVP of the Week (Last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    players.forEach(p => {
      stats[p.id] = { id: p.id, name: p.name, runs: 0, wkts: 0, cvp: 0, cvpWeekly: 0 };
    });

    rawDeliveries.forEach(d => {
      const matchId = d.__fullPath?.split('/')[1];
      if (!matchId || !activeMatchIds.has(matchId)) return;

      const match = allMatches.find(m => m.id === matchId);
      const isWeekly = match?.matchDate && new Date(match.matchDate) >= sevenDaysAgo;

      const sId = d.strikerPlayerId;
      const bId = d.bowlerId || d.bowlerPlayerId;
      const fId = d.fielderPlayerId;

      const involved = [sId, bId, fId].filter(id => id && id !== 'none' && stats[id]);
      involved.forEach(pid => {
        if (!pMatchStats[pid]) pMatchStats[pid] = {};
        if (!pMatchStats[pid][matchId]) {
          pMatchStats[pid][matchId] = { id: pid, name: '', runs: 0, ballsFaced: 0, fours: 0, sixes: 0, wickets: 0, maidens: 0, ballsBowled: 0, runsConceded: 0, catches: 0, stumpings: 0, runOuts: 0 };
        }
      });

      if (sId && stats[sId]) {
        stats[sId].runs += (d.runsScored || 0);
        const mS = pMatchStats[sId][matchId];
        mS.runs += (d.runsScored || 0);
        if (d.extraType !== 'wide') mS.ballsFaced++;
      }
      if (bId && stats[bId]) {
        if (d.isWicket && !['runout', 'retired'].includes(d.dismissalType || '')) {
          stats[bId].wkts++;
          pMatchStats[bId][matchId].wickets++;
        }
        pMatchStats[bId][matchId].runsConceded += (d.totalRunsOnDelivery || 0);
        if (d.extraType === 'none') pMatchStats[bId][matchId].ballsBowled++;
      }
      if (fId && stats[fId]) {
        const mF = pMatchStats[fId][matchId];
        if (d.dismissalType === 'caught') mF.catches++;
        if (d.dismissalType === 'stumped') mF.stumpings++;
        if (d.dismissalType === 'runout') mF.runOuts++;
      }
    });

    Object.keys(stats).forEach(id => {
      Object.entries(pMatchStats[id] || {}).forEach(([mId, mS]) => {
        const match = allMatches.find(m => m.id === mId);
        const isWeekly = match?.matchDate && new Date(match.matchDate) >= sevenDaysAgo;
        const matchCvp = calculatePlayerCVP(mS as any);
        stats[id].cvp += matchCvp;
        if (isWeekly) stats[id].cvpWeekly += matchCvp;
      });
    });

    const orangeCapId = Object.values(stats).sort((a: any, b: any) => b.runs - a.runs)[0]?.id;
    const purpleCapId = Object.values(stats).sort((a: any, b: any) => b.wkts - a.wkts)[0]?.id;
    const mvpId = Object.values(stats).sort((a: any, b: any) => b.cvpWeekly - a.cvpWeekly)[0]?.id;

    return { stats, orangeCapId, purpleCapId, mvpId };
  }, [players, allMatches, rawDeliveries, isMounted]);

  const topPlayers = useMemo(() => {
    return Object.values(leagueData.stats).sort((a: any, b: any) => b.cvp - a.cvp).slice(0, 5);
  }, [leagueData]);

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

      {/* MVP & Caps Spotlight */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* MVP of the Week */}
        <Card className="border-none shadow-xl bg-slate-900 text-white overflow-hidden relative group">
          <div className="absolute -right-4 -top-4 opacity-10 group-hover:rotate-12 transition-transform"><Calendar className="w-24 h-24" /></div>
          <CardContent className="p-6 space-y-4 relative z-10">
            <div className="flex items-center gap-2"><Crown className="w-4 h-4 text-amber-500" /><span className="text-[10px] font-black uppercase tracking-widest text-slate-400">MVP of the Week</span></div>
            <div className="min-w-0">
              <p className="text-2xl font-black uppercase tracking-tighter truncate">{leagueData.mvpId ? leagueData.stats[leagueData.mvpId].name : 'Calculating...'}</p>
              <p className="text-[9px] font-bold text-amber-500 uppercase mt-1">Highest impact in last 7 days</p>
            </div>
            <Button variant="outline" size="sm" className="w-full border-white/10 bg-white/5 hover:bg-white/10 text-white font-black uppercase text-[9px] h-10" asChild>
              <Link href={`/players/${leagueData.mvpId}`}>View Profile</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Orange Cap */}
        <Card className="border-none shadow-xl bg-orange-500 text-white overflow-hidden relative group">
          <div className="absolute -right-4 -top-4 opacity-20"><Zap className="w-24 h-24 text-white" /></div>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2"><Trophy className="w-4 h-4 text-white" /><span className="text-[10px] font-black uppercase tracking-widest text-orange-100">Orange Cap Leader</span></div>
            <div>
              <p className="text-2xl font-black uppercase tracking-tighter truncate">{leagueData.orangeCapId ? leagueData.stats[leagueData.orangeCapId].name : '---'}</p>
              <p className="text-xl font-black text-white/80">{leagueData.orangeCapId ? leagueData.stats[leagueData.orangeCapId].runs : 0} <span className="text-[10px] uppercase">Runs</span></p>
            </div>
          </CardContent>
        </Card>

        {/* Purple Cap */}
        <Card className="border-none shadow-xl bg-indigo-600 text-white overflow-hidden relative group">
          <div className="absolute -right-4 -top-4 opacity-20"><Target className="w-24 h-24 text-white" /></div>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2"><Trophy className="w-4 h-4 text-white" /><span className="text-[10px] font-black uppercase tracking-widest text-indigo-100">Purple Cap Leader</span></div>
            <div>
              <p className="text-2xl font-black uppercase tracking-tighter truncate">{leagueData.purpleCapId ? leagueData.stats[leagueData.purpleCapId].name : '---'}</p>
              <p className="text-xl font-black text-white/80">{leagueData.purpleCapId ? leagueData.stats[leagueData.purpleCapId].wkts : 0} <span className="text-[10px] uppercase">Wickets</span></p>
            </div>
          </CardContent>
        </Card>
      </section>

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
                      <div className="flex gap-1">
                        {player.id === leagueData.orangeCapId && <Badge className="bg-orange-500 text-white text-[6px] h-3 px-1 uppercase">Orange Cap</Badge>}
                        {player.id === leagueData.purpleCapId && <Badge className="bg-indigo-600 text-white text-[6px] h-3 px-1 uppercase">Purple Cap</Badge>}
                      </div>
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
