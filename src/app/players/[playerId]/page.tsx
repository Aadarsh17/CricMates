
"use client"

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useMemoFirebase, useFirestore, updateDocumentNonBlocking, useCollection } from '@/firebase';
import { doc, collectionGroup, query, collection } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Flag, Edit2, Loader2, Calendar, Camera, Upload, Activity, Trophy, Star, ShieldCheck, Zap, Award, Target, UserCheck, ChevronRight, TrendingUp, Medal } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { toast } from '@/hooks/use-toast';
import { calculatePlayerCVP } from '@/lib/cvp-utils';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function PlayerProfilePage() {
  const params = useParams();
  const playerId = params.playerId as string;
  const db = useFirestore();
  const router = useRouter();
  const { isUmpire } = useApp();
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  const playerRef = useMemoFirebase(() => isMounted && playerId ? doc(db, 'players', playerId) : null, [db, playerId, isMounted]);
  const { data: player, isLoading: isPlayerLoading } = useDoc(playerRef);

  const allMatchesQuery = useMemoFirebase(() => query(collection(db, 'matches')), [db]);
  const { data: allMatches } = useCollection(allMatchesQuery);

  const historyQuery = useMemoFirebase(() => isMounted && playerId ? query(collectionGroup(db, 'deliveryRecords')) : null, [db, playerId, isMounted]);
  const { data: allDeliveries, isLoading: isHistoryLoading } = useCollection(historyQuery);

  const activeMatchIds = useMemo(() => new Set(allMatches?.map(m => m.id) || []), [allMatches]);

  const matchWiseLog = useMemo(() => {
    if (!isMounted || !player || !allDeliveries || !allMatches) return [];
    const logs: Record<string, any> = {};
    allDeliveries.forEach(d => {
      const matchId = d.__fullPath?.split('/')[1];
      if (!matchId || !activeMatchIds.has(matchId)) return;
      if (!logs[matchId]) {
        const m = allMatches.find(match => match.id === matchId); if (!m) return;
        logs[matchId] = { matchId, date: m.matchDate || '', batting: { runs: 0, ballsFaced: 0, fours: 0, sixes: 0, out: false }, bowling: { wickets: 0, runsConceded: 0, ballsBowled: 0 }, fielding: { catches: 0, stumpings: 0, runOuts: 0 } };
      }
      const log = logs[matchId];
      if (d.strikerPlayerId === playerId) { 
        log.batting.runs += d.runsScored || 0; 
        if (d.runsScored === 4) log.batting.fours++;
        if (d.runsScored === 6) log.batting.sixes++;
        if (d.extraType !== 'wide') log.batting.ballsFaced++; 
      }
      if (d.isWicket && d.batsmanOutPlayerId === playerId) log.batting.out = true;
      if ((d.bowlerId || d.bowlerPlayerId) === playerId) { 
        log.bowling.runsConceded += d.totalRunsOnDelivery || 0; 
        if (d.extraType !== 'wide' && d.extraType !== 'noball') log.bowling.ballsBowled++; 
        if (d.isWicket && !['runout', 'retired'].includes(d.dismissalType || '')) log.bowling.wickets++; 
      }
      if (d.fielderPlayerId === playerId) {
        if (d.dismissalType === 'caught') log.fielding.catches++;
        if (d.dismissalType === 'stumped') log.fielding.stumpings++;
        if (d.dismissalType === 'runout') log.fielding.runOuts++;
      }
    });
    return Object.values(logs).map((log: any) => ({ ...log, totalCVP: calculatePlayerCVP({ ...log.batting, ...log.bowling, ...log.fielding, id: player.id, name: player.name, maidens: 0 }) })).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allDeliveries, allMatches, player, isMounted, playerId, activeMatchIds]);

  const milestones = useMemo(() => {
    const s = { 
      runs: 0, wkts: 0, matches: 0, cvp: 0,
      tens: 0, twenties: 0, thirties: 0, forties: 0, fifties: 0, hundreds: 0,
      oneWkts: 0, threeWkts: 0, fiveWkts: 0
    };
    matchWiseLog.forEach(log => { 
      s.runs += log.batting.runs; 
      s.wkts += log.bowling.wickets; 
      s.matches++; 
      s.cvp += log.totalCVP; 
      
      const r = log.batting.runs;
      if (r >= 100) s.hundreds++;
      else if (r >= 50) s.fifties++;
      else if (r >= 40) s.forties++;
      else if (r >= 30) s.thirties++;
      else if (r >= 20) s.twenties++;
      else if (r >= 10) s.tens++;

      const w = log.bowling.wickets;
      if (w >= 5) s.fiveWkts++;
      else if (w >= 3) s.threeWkts++;
      else if (w >= 1) s.oneWkts++;
    });
    return s;
  }, [matchWiseLog]);

  if (!isMounted || isPlayerLoading || isHistoryLoading) return (<div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4"><Loader2 className="w-10 h-10 text-primary animate-spin" /><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Syncing Career Data...</p></div>);
  if (!player) return <div className="p-20 text-center">Player missing.</div>;

  return (
    <div className="max-w-lg mx-auto space-y-8 pb-32 px-4">
      <section className="bg-slate-950 text-white rounded-3xl p-8 shadow-2xl relative overflow-hidden ring-1 ring-white/10">
        <div className="absolute top-0 right-0 p-4 opacity-10"><Zap className="w-32 h-32" /></div>
        <div className="flex items-center gap-6 relative z-10">
          <Avatar className="w-24 h-24 border-4 border-white/10 rounded-3xl shadow-xl overflow-hidden shrink-0"><AvatarImage src={player.imageUrl} className="object-cover" /><AvatarFallback className="text-3xl font-black bg-white/5">{player.name[0]}</AvatarFallback></Avatar>
          <div className="min-w-0">
            <h1 className="text-2xl font-black uppercase tracking-tighter truncate leading-tight">{player.name}</h1>
            <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest border-white/20 text-white h-6 px-3">{player.role}</Badge>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-8 relative z-10">
          <div className="bg-white/5 p-4 rounded-2xl backdrop-blur-sm border border-white/5 text-center"><p className="text-[8px] font-black uppercase text-slate-500 mb-1 tracking-widest">Career CVP</p><p className="text-2xl font-black text-primary">{milestones.cvp.toFixed(1)}</p></div>
          <div className="bg-white/5 p-4 rounded-2xl backdrop-blur-sm border border-white/5 text-center"><p className="text-[8px] font-black uppercase text-slate-500 mb-1 tracking-widest">Matches</p><p className="text-2xl font-black">{milestones.matches}</p></div>
        </div>
      </section>

      <Tabs defaultValue="milestones" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-12 bg-slate-100 p-1 rounded-xl mb-6">
          <TabsTrigger value="milestones" className="font-black text-[10px] uppercase">Honors</TabsTrigger>
          <TabsTrigger value="form" className="font-black text-[10px] uppercase">Form</TabsTrigger>
          <TabsTrigger value="history" className="font-black text-[10px] uppercase">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="milestones" className="space-y-6">
          <Card className="border-none shadow-xl rounded-3xl bg-white p-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2"><Medal className="w-4 h-4 text-amber-500" /> Career Milestones</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div><p className="text-2xl font-black text-slate-900">{milestones.fifties}</p><p className="text-[8px] font-black text-slate-400 uppercase">50s</p></div>
              <div><p className="text-2xl font-black text-slate-900">{milestones.thirties}</p><p className="text-[8px] font-black text-slate-400 uppercase">30s</p></div>
              <div><p className="text-2xl font-black text-slate-900">{milestones.hundreds}</p><p className="text-[8px] font-black text-slate-400 uppercase">100s</p></div>
              <div className="pt-4"><p className="text-2xl font-black text-secondary">{milestones.threeWkts}</p><p className="text-[8px] font-black text-slate-400 uppercase">3W Hauls</p></div>
              <div className="pt-4"><p className="text-2xl font-black text-secondary">{milestones.oneWkts}</p><p className="text-[8px] font-black text-slate-400 uppercase">1W Hauls</p></div>
              <div className="pt-4"><p className="text-2xl font-black text-secondary">{milestones.fiveWkts}</p><p className="text-[8px] font-black text-slate-400 uppercase">5W Hauls</p></div>
            </div>
          </Card>
          <Card className="border-none shadow-xl rounded-3xl bg-white p-6 grid grid-cols-2 gap-6">
            <div className="space-y-1"><p className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Total Runs</p><p className="text-3xl font-black text-slate-900">{milestones.runs}</p></div>
            <div className="space-y-1"><p className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Total Wickets</p><p className="text-3xl font-black text-secondary">{milestones.wkts}</p></div>
          </Card>
        </TabsContent>

        <TabsContent value="form" className="space-y-4">
          <h2 className="text-lg font-black uppercase text-slate-900 flex items-center gap-2 px-2"><Activity className="w-5 h-5 text-primary" /> Recent Form (Last 5)</h2>
          <div className="space-y-3">
            {matchWiseLog.slice(0, 5).map((log, idx) => (
              <Card key={idx} className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col items-center justify-center min-w-[50px]"><Calendar className="w-3 h-3 text-slate-400 mb-1" /><span className="text-[8px] font-black text-slate-500 uppercase">{new Date(log.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span></div>
                    <div className="min-w-0"><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Match Impact</p><div className="flex items-baseline gap-2"><span className="text-xl font-black text-slate-900">{log.batting.runs} <span className="text-[8px] text-slate-400">R</span></span><span className="text-sm font-black text-secondary">{log.bowling.wickets} <span className="text-[8px] text-slate-400">W</span></span></div></div>
                  </div>
                  <div className="text-right"><p className="text-[8px] font-black text-slate-400 uppercase mb-1">CVP</p><Badge variant="secondary" className="font-black text-xs h-6">{log.totalCVP.toFixed(1)}</Badge></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-3">
          {matchWiseLog.length > 0 ? matchWiseLog.map((log, idx) => (
            <div key={idx} className="flex items-center justify-between p-4 bg-white rounded-2xl border shadow-sm">
              <span className="text-xs font-black uppercase text-slate-600">{new Date(log.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              <div className="flex gap-4">
                <span className="text-xs font-bold text-slate-400">{log.batting.runs} runs</span>
                <span className="text-xs font-bold text-slate-400">{log.bowling.wickets} wkts</span>
              </div>
            </div>
          )) : (
            <div className="text-center py-12 border-2 border-dashed rounded-2xl bg-slate-50/50"><TrendingUp className="w-10 h-10 text-slate-200 mx-auto mb-2" /><p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No match records yet</p></div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
