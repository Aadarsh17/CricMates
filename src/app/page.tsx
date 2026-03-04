
"use client"

import { useCollection, useMemoFirebase, useFirestore, useUser, useDoc } from '@/firebase';
import { collection, query, where, orderBy, limit, doc, collectionGroup } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Activity, Users, ArrowRight, PlayCircle, ShieldCheck, Loader2 } from 'lucide-react';
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
    .slice(0, 3);
  }, [players, allMatches, rawDeliveries, isMounted]);

  const teamsQuery = useMemoFirebase(() => query(collection(db, 'teams')), [db]);
  const { data: teams } = useCollection(teamsQuery);

  const getTeamName = (teamId: string) => {
    const team = teams?.find(t => t.id === teamId);
    return team ? team.name : 'Unknown Team';
  };

  if (!isMounted) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <section className="relative rounded-2xl overflow-hidden h-[400px] flex items-center justify-center text-center">
        <div 
          className="absolute inset-0 bg-cover bg-center z-0" 
          style={{ backgroundImage: `url('https://picsum.photos/seed/crickethero/1200/600')` }}
          data-ai-hint="cricket stadium"
        />
        <div className="absolute inset-0 bg-primary/70 z-10" />
        <div className="relative z-20 text-white px-4">
          <Badge className="mb-4 bg-secondary text-white border-none uppercase tracking-widest font-black text-[10px] flex items-center gap-2 mx-auto w-fit">
            {isUmpire ? <><ShieldCheck className="w-3 h-3" /> Official Umpire Mode</> : 'Professional Scoring Suite'}
          </Badge>
          <h1 className="text-4xl md:text-6xl font-black font-headline mb-4 tracking-tight">
            {isUmpire && umpireProfile?.name ? `Welcome, ${umpireProfile.name}` : 'CricMates Tracker'}
          </h1>
          <p className="text-lg md:text-xl opacity-90 mb-8 max-w-2xl mx-auto font-medium">Ball-by-ball precision, real-time analytics, and comprehensive league management.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button size="lg" className="bg-secondary hover:bg-secondary/90 h-12 px-8 font-black uppercase text-xs tracking-widest shadow-xl" asChild>
              <Link href="/matches">Match Center</Link>
            </Button>
            {isUmpire ? (
              <Button size="lg" variant="outline" className="bg-white/10 border-white hover:bg-white/20 h-12 px-8 font-black uppercase text-xs tracking-widest" asChild>
                <Link href="/match/new">Start New Match</Link>
              </Button>
            ) : (
              <Button size="lg" variant="outline" className="bg-white/10 border-white hover:bg-white/20 h-12 px-8 font-black uppercase text-xs tracking-widest" asChild>
                <Link href="/teams">Manage Squads</Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-l-4 border-l-secondary shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center space-x-2">
              <Activity className="text-destructive w-5 h-5 animate-pulse" />
              <CardTitle className="font-black uppercase text-sm tracking-widest">Live Updates</CardTitle>
            </div>
            {liveMatch && <Badge variant="destructive" className="animate-pulse uppercase text-[9px] font-black">LIVE NOW</Badge>}
          </CardHeader>
          <CardContent>
            {liveMatch ? (
              <div className="p-6 bg-muted/50 rounded-xl border border-border/50">
                <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
                  <div className="flex-1 text-center min-w-0">
                    <p className="font-black text-xl mb-1 truncate">{getTeamName(liveMatch.team1Id)}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Home</p>
                  </div>
                  <div className="px-6 font-black text-slate-300">VS</div>
                  <div className="flex-1 text-center min-w-0">
                    <p className="font-black text-xl mb-1 truncate">{getTeamName(liveMatch.team2Id)}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Away</p>
                  </div>
                </div>
                <div className="mt-6 flex justify-center">
                  <Button variant="secondary" className="font-black uppercase text-[10px] tracking-widest" asChild>
                    <Link href={`/match/${liveMatch.id}`}>Watch Full Scorecard <ArrowRight className="ml-2 w-4 h-4" /></Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 border-2 border-dashed rounded-xl bg-slate-50/50">
                <Activity className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">No matches are currently active</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-sm font-black uppercase tracking-widest">
              <Trophy className="text-secondary w-5 h-5" />
              <span>MVP Rankings</span>
            </CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase">Top Career CVP Points (Validated)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isDeliveriesLoading ? (
              <div className="flex flex-col items-center py-12 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <p className="text-[10px] font-black text-slate-400 uppercase">Validating History...</p>
              </div>
            ) : topPlayers && topPlayers.length > 0 ? topPlayers.map((player, idx) => (
              <div key={player.id} className="flex items-center justify-between p-3 hover:bg-muted transition-colors rounded-lg border border-transparent hover:border-border">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-[10px] font-black text-primary">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="font-black text-sm">{player.name}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter">{player.role}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-primary">{player.cvp.toFixed(1)}</p>
                  <p className="text-[8px] uppercase font-black text-muted-foreground">Points</p>
                </div>
              </div>
            )) : (
              <div className="text-center py-12">
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">No leaderboard data</p>
              </div>
            )}
            <Button variant="ghost" className="w-full mt-2 text-primary font-black uppercase text-[10px] tracking-widest hover:bg-primary/5" asChild>
              <Link href="/rankings">Global Leaderboard <ArrowRight className="ml-2 w-4 h-4" /></Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pb-12">
        {[
          { title: 'Squad Hub', desc: 'Manage teams & players', icon: Users, href: '/teams', color: 'bg-blue-500' },
          { title: 'History', desc: 'Archive of past glories', icon: Activity, href: '/matches', color: 'bg-secondary' },
          { title: 'Number Game', desc: 'Casual street cricket', icon: PlayCircle, href: '/number-game', color: 'bg-destructive' },
          { title: 'Official', desc: isUmpire ? 'Manage Credentials' : 'Umpire Login', icon: ShieldCheck, href: isUmpire ? '/profile' : '/auth', color: 'bg-primary' },
        ].map((item) => (
          <Link href={item.href} key={item.title} className="group">
            <Card className="hover:border-primary transition-all cursor-pointer h-full border-b-4 border-b-transparent hover:border-b-primary shadow-sm bg-white">
              <CardContent className="p-6 flex flex-col items-center text-center space-y-3">
                <div className={`${item.color}/10 p-3 rounded-xl group-hover:scale-110 transition-transform`}>
                  <item.icon className={`w-8 h-8 ${item.color.replace('bg-', 'text-')}`} />
                </div>
                <h3 className="font-black text-sm uppercase tracking-widest">{item.title}</h3>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">{item.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}
