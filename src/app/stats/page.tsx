
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
    let total4s = 0;
    let total6s = 0;

    const dayRuns: Record<string, number> = {};

    rawDeliveries.forEach(d => {
      const matchId = d.__fullPath?.split('/')[1];
      if (!matchId || !validMatchIds.has(matchId)) return;

      const match = matches.find(m => m.id === matchId);
      if (match?.matchDate) {
        const dateStr = new Date(match.matchDate).toDateString();
        dayRuns[dateStr] = (dayRuns[dateStr] || 0) + (d.totalRunsOnDelivery || 0);
      }

      if (d.runsScored === 4) total4s++;
      if (d.runsScored === 6) total6s++;

      const sId = d.strikerPlayerId;
      const bId = d.bowlerId || d.bowlerPlayerId;
      const fId = d.fielderPlayerId;

      const ids = [sId, bId, fId].filter(id => id && id !== 'none');
      ids.forEach(id => {
        if (!pStats[id]) pStats[id] = {};
        if (!pStats[id][matchId]) {
          pStats[id][matchId] = { id, runs: 0, ballsFaced: 0, fours: 0, sixes: 0, wickets: 0, maidens: 0, ballsBowled: 0, runsConceded: 0, catches: 0, stumpings: 0, runOuts: 0, out: false };
        }
      });

      if (pStats[sId]?.[matchId]) {
        pStats[sId][matchId].runs += (d.runsScored || 0);
        if (d.extraType !== 'wide') pStats[sId][matchId].ballsFaced++;
        if (d.runsScored === 4) pStats[sId][matchId].fours++;
        if (d.runsScored === 6) pStats[sId][matchId].sixes++;
      }

      if (d.isWicket && pStats[d.batsmanOutPlayerId || sId]?.[matchId]) {
        pStats[d.batsmanOutPlayerId || sId][matchId].out = true;
      }

      if (bId && pStats[bId]?.[matchId]) {
        pStats[bId][matchId].runsConceded += (d.totalRunsOnDelivery || 0);
        if (d.extraType !== 'wide' && d.extraType !== 'noball') pStats[bId][matchId].ballsBowled++;
        if (d.isWicket && d.dismissalType !== 'runout' && d.dismissalType !== 'retired') pStats[bId][matchId].wickets++;
      }

      if (fId && pStats[fId]?.[matchId]) {
        if (d.dismissalType === 'caught') pStats[fId][matchId].catches++;
        if (d.dismissalType === 'stumped') pStats[fId][matchId].stumpings++;
        if (d.dismissalType === 'runout') pStats[fId][matchId].runOuts++;
      }
    });

    const playerLeaderboard = players.map(p => {
      const matchHistory = pStats[p.id] || {};
      const career = { 
        id: p.id, name: p.name, teamId: p.teamId, role: p.role, imageUrl: p.imageUrl,
        runs: 0, ballsFaced: 0, wickets: 0, ballsBowled: 0, runsConceded: 0, cvp: 0, inningsBatted: 0, inningsBowled: 0, timesOut: 0, batCvp: 0,
        maxScore: 0, max6s: 0, max4s: 0, maxWkts: 0, bestBowling: { wkts: 0, runs: 0, display: '0/0' }, maxCatches: 0, maxRunOuts: 0
      };

      Object.values(matchHistory).forEach((ms: any) => {
        career.runs += ms.runs;
        career.ballsFaced += ms.ballsFaced;
        career.wickets += ms.wickets;
        career.ballsBowled += ms.ballsBowled;
        career.runsConceded += ms.runsConceded;
        if (ms.ballsFaced > 0 || ms.out) career.inningsBatted++;
        if (ms.ballsBowled > 0) career.inningsBowled++;
        if (ms.out) career.timesOut++;
        
        career.maxScore = Math.max(career.maxScore, ms.runs);
        career.max6s = Math.max(career.max6s, ms.sixes);
        career.max4s = Math.max(career.max4s, ms.fours);
        career.maxWkts = Math.max(career.maxWkts, ms.wickets);
        career.maxCatches = Math.max(career.maxCatches, ms.catches);
        career.maxRunOuts = Math.max(career.maxRunOuts, ms.runOuts);

        if (ms.wickets > career.bestBowling.wkts || (ms.wickets === career.bestBowling.wkts && ms.runsConceded < career.bestBowling.runs)) {
          career.bestBowling = { wkts: ms.wickets, runs: ms.runsConceded, display: `${ms.wickets}/${ms.runsConceded}` };
        }

        const matchCvp = calculatePlayerCVP(ms);
        career.cvp += matchCvp;
        
        const batOnly = { ...ms, wickets: 0, ballsBowled: 0, runsConceded: 0, catches: 0, stumpings: 0, runOuts: 0 };
        career.batCvp += calculatePlayerCVP(batOnly);
      });

      return {
        ...career,
        batAvg: career.timesOut > 0 ? (career.runs / career.timesOut) : (career.inningsBatted > 0 ? career.runs : 0),
        batSR: career.ballsFaced > 0 ? (career.runs / career.ballsFaced) * 100 : 0,
        bowlEcon: career.ballsBowled > 0 ? (career.runsConceded / (career.ballsBowled / 6)) : 0,
        bowlAvg: career.wickets > 0 ? (career.runsConceded / career.wickets) : 0
      };
    });

    return { total4s, total6s, playerLeaderboard, dayRuns };
  }, [players, matches, rawDeliveries]);

  if (!isMounted || isDeliveriesLoading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <Loader2 className="w-10 h-10 text-primary animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Syncing Tournament Intelligence...</p>
    </div>
  );

  const getTeamCode = (tid: string) => {
    const team = teams?.find(t => t.id === tid);
    return team ? team.name.substring(0, 3).toUpperCase() : 'UNK';
  };

  const records = {
    highestScore: [...(aggregatedStats?.playerLeaderboard || [])].sort((a,b) => b.maxScore - a.maxScore)[0],
    mostRunsDay: Object.entries(aggregatedStats?.dayRuns || {}).sort((a,b) => b[1] - a[1])[0],
    mostSixes: [...(aggregatedStats?.playerLeaderboard || [])].sort((a,b) => b.max6s - a.max6s)[0],
    mostFours: [...(aggregatedStats?.playerLeaderboard || [])].sort((a,b) => b.max4s - a.max4s)[0],
    bestBowling: [...(aggregatedStats?.playerLeaderboard || [])].sort((a,b) => {
      if (b.bestBowling.wkts !== a.bestBowling.wkts) return b.bestBowling.wkts - a.bestBowling.wkts;
      return a.bestBowling.runs - b.bestBowling.runs;
    })[0],
    mostCatches: [...(aggregatedStats?.playerLeaderboard || [])].sort((a,b) => b.maxCatches - a.maxCatches)[0],
    mostRunOuts: [...(aggregatedStats?.playerLeaderboard || [])].sort((a,b) => b.maxRunOuts - a.maxRunOuts)[0],
  };

  const leaders = {
    runs: aggregatedStats?.playerLeaderboard.filter(p => p.runs > 0).sort((a, b) => b.runs - a.runs).slice(0, 3) || [],
    wickets: aggregatedStats?.playerLeaderboard.filter(p => p.wickets > 0).sort((a, b) => b.wickets - a.wickets).slice(0, 3) || [],
    sr: aggregatedStats?.playerLeaderboard.filter(p => p.ballsFaced >= 20).sort((a, b) => b.batSR - a.batSR).slice(0, 3) || [],
    econ: aggregatedStats?.playerLeaderboard.filter(p => p.ballsBowled >= 6).sort((a, b) => a.bowlEcon - b.bowlEcon).slice(0, 3) || [],
    impact: aggregatedStats?.playerLeaderboard.filter(p => p.cvp > 0).sort((a, b) => b.cvp - a.cvp).slice(0, 3) || [],
    batImpact: aggregatedStats?.playerLeaderboard.filter(p => p.batCvp > 0).sort((a, b) => b.batCvp - a.batCvp).slice(0, 3) || []
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-24 px-1 md:px-4">
      {/* INFO BANNER */}
      <div className="bg-slate-900 text-white p-4 rounded-xl shadow-lg border-l-8 border-l-primary flex items-start gap-4">
        <Info className="w-6 h-6 text-primary shrink-0 mt-1" />
        <div className="space-y-1">
          <h3 className="font-black uppercase text-[10px] tracking-widest text-primary">Tournament Stats Policy</h3>
          <p className="text-[9px] font-bold text-slate-400 uppercase leading-relaxed">
            Matches are calculated based on a 6-over format. All bowling economy rates and records are subject to a minimum requirement of 1 complete over (6 legal balls) to ensure statistical accuracy and data integrity.
          </p>
        </div>
      </div>

      {/* RECORDS SECTION */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Medal className="w-6 h-6 text-amber-500" />
          <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">League Hall of Fame</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-t-4 border-t-primary shadow-sm bg-white overflow-hidden group">
            <CardHeader className="py-3 bg-slate-50 border-b"><CardTitle className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Batting Records</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="p-4 border-b space-y-1">
                <p className="text-[8px] font-black text-slate-400 uppercase">Highest Score (Match)</p>
                <div className="flex justify-between items-center">
                  <p className="font-black text-lg text-slate-900">{records.highestScore?.maxScore}</p>
                  <p className="text-[9px] font-bold text-primary uppercase">{records.highestScore?.name}</p>
                </div>
              </div>
              <div className="p-4 border-b space-y-1">
                <p className="text-[8px] font-black text-slate-400 uppercase">Most Runs in a Day</p>
                <div className="flex justify-between items-center">
                  <p className="font-black text-lg text-slate-900">{records.mostRunsDay?.[1] || 0}</p>
                  <p className="text-[9px] font-bold text-primary uppercase">{records.mostRunsDay?.[0] || '---'}</p>
                </div>
              </div>
              <div className="p-4 space-y-1">
                <p className="text-[8px] font-black text-slate-400 uppercase">Most Match Boundaries</p>
                <div className="flex gap-4">
                  <div><span className="text-xs font-black">{records.mostSixes?.max6s}</span> <span className="text-[8px] font-bold text-slate-400 uppercase">Sixes</span></div>
                  <div><span className="text-xs font-black">{records.mostFours?.max4s}</span> <span className="text-[8px] font-bold text-slate-400 uppercase">Fours</span></div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-secondary shadow-sm bg-white overflow-hidden group">
            <CardHeader className="py-3 bg-slate-50 border-b"><CardTitle className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Bowling Records</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="p-4 border-b space-y-1">
                <p className="text-[8px] font-black text-slate-400 uppercase">Best Figures (BBF)</p>
                <div className="flex justify-between items-center">
                  <p className="font-black text-lg text-secondary">{records.bestBowling?.bestBowling.display}</p>
                  <p className="text-[9px] font-bold text-secondary uppercase">{records.bestBowling?.name}</p>
                </div>
              </div>
              <div className="p-4 border-b space-y-1">
                <p className="text-[8px] font-black text-slate-400 uppercase">Most Wickets (Match)</p>
                <div className="flex justify-between items-center">
                  <p className="font-black text-lg text-slate-900">{records.bestBowling?.maxWkts}</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">Wickets</p>
                </div>
              </div>
              <div className="p-4 space-y-1">
                <p className="text-[8px] font-black text-slate-400 uppercase">Best Economy (Min 1ov)</p>
                <div className="flex justify-between items-center">
                  <p className="font-black text-lg text-slate-900">{aggregatedStats?.playerLeaderboard.filter(p => p.ballsBowled >= 6).sort((a,b) => a.bowlEcon - b.bowlEcon)[0]?.bowlEcon.toFixed(2) || '0.00'}</p>
                  <Badge variant="outline" className="text-[8px] font-black">STRICT ECON</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-destructive shadow-sm bg-white overflow-hidden group">
            <CardHeader className="py-3 bg-slate-50 border-b"><CardTitle className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Fielding Records</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="p-4 border-b space-y-1">
                <p className="text-[8px] font-black text-slate-400 uppercase">Most Catches (Match)</p>
                <div className="flex justify-between items-center">
                  <p className="font-black text-lg text-destructive">{records.mostCatches?.maxCatches}</p>
                  <p className="text-[9px] font-bold text-destructive uppercase">{records.mostCatches?.name}</p>
                </div>
              </div>
              <div className="p-4 space-y-1">
                <p className="text-[8px] font-black text-slate-400 uppercase">Most Run Outs (Match)</p>
                <div className="flex justify-between items-center">
                  <p className="font-black text-lg text-destructive">{records.mostRunOuts?.maxRunOuts}</p>
                  <p className="text-[9px] font-bold text-destructive uppercase">{records.mostRunOuts?.name}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="border shadow-sm overflow-hidden">
        <div className="bg-slate-50 px-4 py-3 border-b flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">League Boundary Meter</span>
        </div>
        <div className="grid grid-cols-2">
          <div className="p-4 md:p-6 border-r flex flex-col md:flex-row items-center justify-between hover:bg-slate-50 transition-colors gap-2">
            <div className="flex items-center gap-4">
              <div className="bg-purple-600 w-10 h-10 rounded-lg flex items-center justify-center text-white font-black">6s</div>
              <span className="text-2xl md:text-3xl font-black text-slate-900">{aggregatedStats?.total6s || 0}</span>
            </div>
            <Link href="/rankings" className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">Most 6s <ChevronRight className="w-3 h-3"/></Link>
          </div>
          <div className="p-4 md:p-6 flex flex-col md:flex-row items-center justify-between hover:bg-slate-50 transition-colors gap-2">
            <div className="flex items-center gap-4">
              <div className="bg-emerald-500 w-10 h-10 rounded-lg flex items-center justify-center text-white font-black">4s</div>
              <span className="text-2xl md:text-3xl font-black text-slate-900">{aggregatedStats?.total4s || 0}</span>
            </div>
            <Link href="/rankings" className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">Most 4s <ChevronRight className="w-3 h-3"/></Link>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-secondary" />
          <h2 className="text-lg font-black uppercase tracking-tight">Top Performances</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border shadow-sm overflow-hidden">
            <CardHeader className="py-3 px-4 border-b bg-slate-50/50"><CardTitle className="text-[10px] font-black uppercase text-slate-500">Top Run Scorers</CardTitle></CardHeader>
            <CardContent className="p-0">
              {leaders.runs.map((player) => (
                <Link key={player.id} href={`/players/${player.id}`} className="flex items-center gap-4 p-4 border-b last:border-none hover:bg-slate-50 transition-colors group">
                  <Avatar className="w-12 h-12 rounded-xl border group-hover:border-primary transition-colors shrink-0"><AvatarImage src={player.imageUrl} className="object-cover"/><AvatarFallback>{player.name[0]}</AvatarFallback></Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm truncate uppercase tracking-tight">{player.name} <span className="text-[8px] text-slate-400 font-bold ml-1">{getTeamCode(player.teamId)}</span></p>
                    <p className="text-2xl font-black text-slate-900">{player.runs}</p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Innings: {player.inningsBatted} | AVG: {player.batAvg.toFixed(2)}</p>
                  </div>
                </Link>
              ))}
              <div className="p-3 text-center border-t"><Link href="/rankings" className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">View full list</Link></div>
            </CardContent>
          </Card>

          <Card className="border shadow-sm overflow-hidden">
            <CardHeader className="py-3 px-4 border-b bg-slate-50/50"><CardTitle className="text-[10px] font-black uppercase text-slate-500">Top Wicket Takers</CardTitle></CardHeader>
            <CardContent className="p-0">
              {leaders.wickets.map((player) => (
                <Link key={player.id} href={`/players/${player.id}`} className="flex items-center gap-4 p-4 border-b last:border-none hover:bg-slate-50 transition-colors group">
                  <Avatar className="w-12 h-12 rounded-xl border group-hover:border-primary transition-colors shrink-0"><AvatarImage src={player.imageUrl} className="object-cover"/><AvatarFallback>{player.name[0]}</AvatarFallback></Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm truncate uppercase tracking-tight">{player.name} <span className="text-[8px] text-slate-400 font-bold ml-1">{getTeamCode(player.teamId)}</span></p>
                    <p className="text-2xl font-black text-slate-900">{player.wickets}</p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Innings: {player.inningsBowled} | AVG: {player.bowlAvg.toFixed(2)}</p>
                  </div>
                </Link>
              ))}
              <div className="p-3 text-center border-t"><Link href="/rankings" className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">View full list</Link></div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border shadow-sm overflow-hidden">
          <CardHeader className="py-3 px-4 border-b bg-slate-50/50"><CardTitle className="text-[10px] font-black uppercase text-slate-500">Best Batting Strike Rates</CardTitle></CardHeader>
          <CardContent className="p-0">
            {leaders.sr.map((player) => (
              <Link key={player.id} href={`/players/${player.id}`} className="flex items-center gap-4 p-4 border-b last:border-none hover:bg-slate-50 transition-colors group">
                <Avatar className="w-12 h-12 rounded-xl border shrink-0"><AvatarImage src={player.imageUrl} className="object-cover"/><AvatarFallback>{player.name[0]}</AvatarFallback></Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm truncate uppercase tracking-tight">{player.name} <span className="text-[8px] text-slate-400 font-bold ml-1">{getTeamCode(player.teamId)}</span></p>
                  <p className="text-2xl font-black text-slate-900">{player.batSR.toFixed(2)}</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">SR Leaders (Min 20 balls faced)</p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="border shadow-sm overflow-hidden">
          <CardHeader className="py-3 px-4 border-b bg-slate-50/50"><CardTitle className="text-[10px] font-black uppercase text-slate-500">Best Bowling Economy</CardTitle></CardHeader>
          <CardContent className="p-0">
            {leaders.econ.map((player) => (
              <Link key={player.id} href={`/players/${player.id}`} className="flex items-center gap-4 p-4 border-b last:border-none hover:bg-slate-50 transition-colors group">
                <Avatar className="w-12 h-12 rounded-xl border shrink-0"><AvatarImage src={player.imageUrl} className="object-cover"/><AvatarFallback>{player.name[0]}</AvatarFallback></Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm truncate uppercase tracking-tight">{player.name} <span className="text-[8px] text-slate-400 font-bold ml-1">{getTeamCode(player.teamId)}</span></p>
                  <p className="text-2xl font-black text-slate-900">{player.bowlEcon.toFixed(2)}</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">ECON Leaders (Min 1 over bowled)</p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-500" />
          <h2 className="text-lg font-black uppercase tracking-tight">Smart Stats</h2>
        </div>
        <div className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Total Impact</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {leaders.impact.map((player) => (
                <Link key={player.id} href={`/players/${player.id}`} className="group relative bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex items-center gap-4">
                  <Avatar className="w-14 h-14 rounded-full border-2 border-slate-100 group-hover:border-primary transition-colors overflow-hidden shrink-0"><AvatarImage src={player.imageUrl} className="object-cover"/><AvatarFallback>{player.name[0]}</AvatarFallback></Avatar>
                  <div className="min-w-0">
                    <p className="font-black text-[10px] truncate uppercase text-slate-400">{player.name}</p>
                    <p className="text-xl font-black text-slate-900">{player.cvp.toFixed(1)}</p>
                    <p className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter">Impact pts | R: {player.runs} W: {player.wickets}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Bat Impact</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {leaders.batImpact.map((player) => (
                <Link key={player.id} href={`/players/${player.id}`} className="group relative bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex items-center gap-4">
                  <Avatar className="w-14 h-14 rounded-full border-2 border-slate-100 group-hover:border-primary transition-colors overflow-hidden shrink-0"><AvatarImage src={player.imageUrl} className="object-cover"/><AvatarFallback>{player.name[0]}</AvatarFallback></Avatar>
                  <div className="min-w-0">
                    <p className="font-black text-[10px] truncate uppercase text-slate-400">{player.name}</p>
                    <p className="text-xl font-black text-slate-900">{player.batCvp.toFixed(1)}</p>
                    <p className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter">Batting Impact | Runs: {player.runs}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
