
"use client"

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useMemoFirebase, useFirestore, useCollection, updateDocumentNonBlocking } from '@/firebase';
import { doc, collectionGroup, query, collection } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, Loader2, Calendar, Activity, Zap, Medal, TrendingUp, Swords, Shield, Target, Hand, Skull, Edit2, Camera, ShieldCheck, Trophy, X, Hash, Crosshair } from 'lucide-react';
import { calculatePlayerCVP } from '@/lib/cvp-utils';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { useApp } from '@/context/AppContext';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { cn } from '@/lib/utils';

export default function PlayerProfilePage() {
  const params = useParams();
  const playerId = params.playerId as string;
  const db = useFirestore();
  const router = useRouter();
  const { isUmpire } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isMounted, setIsMounted] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', role: 'Batsman', imageUrl: '', battingStyle: 'Right Handed Bat', isWicketKeeper: false });

  useEffect(() => { setIsMounted(true); }, []);

  const playerRef = useMemoFirebase(() => isMounted && playerId ? doc(db, 'players', playerId) : null, [db, playerId, isMounted]);
  const { data: player, isLoading: isPlayerLoading } = useDoc(playerRef);

  useEffect(() => {
    if (player) setEditForm({ name: player.name, role: player.role, imageUrl: player.imageUrl || '', battingStyle: player.battingStyle || 'Right Handed Bat', isWicketKeeper: !!player.isWicketKeeper });
  }, [player]);

  const allMatchesQuery = useMemoFirebase(() => query(collection(db, 'matches')), [db]);
  const { data: allMatches } = useCollection(allMatchesQuery);

  const historyQuery = useMemoFirebase(() => isMounted && playerId ? query(collectionGroup(db, 'deliveryRecords')) : null, [db, playerId, isMounted]);
  const { data: rawDeliveries, isLoading: isHistoryLoading } = useCollection(historyQuery);

  const activeMatchIds = useMemo(() => new Set(allMatches?.map(m => m.id) || []), [allMatches]);

  const matchWiseLog = useMemo(() => {
    if (!isMounted || !player || !rawDeliveries || !allMatches) return [];
    const logs: Record<string, any> = {};
    
    allMatches.forEach(m => {
      const isInSquad = (m.team1SquadPlayerIds || []).includes(playerId) || (m.team2SquadPlayerIds || []).includes(playerId);
      if (isInSquad && activeMatchIds.has(m.id)) {
        logs[m.id] = { matchId: m.id, matchName: m.matchNumber || 'Match', status: m.status || 'completed', date: m.matchDate || '', batting: { runs: 0, ballsFaced: 0, fours: 0, sixes: 0, out: false, dots: 0 }, bowling: { wickets: 0, runsConceded: 0, ballsBowled: 0, dots: 0, maidens: 0 }, fielding: { catches: 0, stumpings: 0, runOuts: 0 }, hasParticipated: false };
      }
    });

    rawDeliveries.forEach(d => {
      const matchId = d.__fullPath?.split('/')[1];
      if (!matchId || !activeMatchIds.has(matchId) || !logs[matchId]) return;
      const log = logs[matchId];
      if (d.strikerPlayerId === playerId || d.nonStrikerPlayerId === playerId) log.hasParticipated = true;
      if (d.strikerPlayerId === playerId) { 
        log.batting.runs += (d.runsScored || 0); 
        if (d.runsScored === 4) log.batting.fours++;
        if (d.runsScored === 6) log.batting.sixes++;
        if (d.extraType !== 'wide') { log.batting.ballsFaced++; if (d.runsScored === 0) log.batting.dots++; }
      }
      if (d.isWicket && d.batsmanOutPlayerId === playerId && d.dismissalType !== 'retired') log.batting.out = true;
      const bId = d.bowlerId || d.bowlerPlayerId;
      if (bId === playerId) { 
        log.hasParticipated = true;
        log.bowling.runsConceded += (d.totalRunsOnDelivery || 0); 
        if (d.extraType === 'none') { log.bowling.ballsBowled++; if (d.totalRunsOnDelivery === 0) log.bowling.dots++; }
        if (d.isWicket && !['runout', 'retired'].includes(d.dismissalType || '')) log.bowling.wickets++;
      }
      if (d.fielderPlayerId === playerId) {
        log.hasParticipated = true;
        if (d.dismissalType === 'caught') log.fielding.catches++;
        if (d.dismissalType === 'stumped') log.fielding.stumpings++;
        if (d.dismissalType === 'runout') log.fielding.runOuts++;
      }
    });

    return Object.values(logs).map((log: any) => ({ ...log, totalCVP: calculatePlayerCVP({ ...log.batting, ...log.bowling, ...log.fielding, id: player.id, name: player.name, maidens: log.bowling.maidens, ballsBowled: log.bowling.ballsBowled, runsConceded: log.bowling.runsConceded }) })).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [rawDeliveries, allMatches, player, isMounted, playerId, activeMatchIds]);

  const careerStats = useMemo(() => {
    const s = { 
      matches: 0, cvp: 0,
      batting: { innings: 0, runs: 0, balls: 0, fours: 0, sixes: 0, outs: 0, high: 0, sr: 0, avg: 0, dots: 0, milestones: { tens: 0, twenties: 0, thirties: 0, forties: 0, fifties: 0, hundreds: 0 }, ducks: { regular: 0, golden: 0, diamond: 0 } },
      bowling: { innings: 0, overs: 0, balls: 0, runs: 0, wkts: 0, dots: 0, best: { wkts: 0, runs: 0 }, econ: 0, sr: 0, avg: 0, mil: { oneW: 0, twoW: 0, threeW: 0, fourW: 0, fiveW: 0 } },
      fielding: { catches: 0, stumpings: 0, runOuts: 0 }
    };
    let firstBowl = true;
    matchWiseLog.forEach(log => {
      s.matches++; s.cvp += log.totalCVP;
      if (log.batting.ballsFaced > 0 || log.batting.out) {
        s.batting.innings++; s.batting.runs += log.batting.runs; s.batting.balls += log.batting.ballsFaced; s.batting.fours += log.batting.fours; s.batting.sixes += log.batting.sixes; s.batting.dots += log.batting.dots;
        if (log.batting.out) { s.batting.outs++; if (log.batting.runs === 0) { if (log.batting.ballsFaced === 0) s.batting.ducks.diamond++; else if (log.batting.ballsFaced === 1) s.batting.ducks.golden++; else s.batting.ducks.regular++; } }
        if (log.batting.runs > s.batting.high) s.batting.high = log.batting.runs;
        const r = log.batting.runs; if (r >= 100) s.batting.milestones.hundreds++; else if (r >= 50) s.batting.milestones.fifties++; else if (r >= 40) s.batting.milestones.forties++; else if (r >= 30) s.batting.milestones.thirties++; else if (r >= 20) s.batting.milestones.twenties++; else if (r >= 10) s.batting.milestones.tens++;
      }
      if (log.bowling.ballsBowled > 0) {
        s.bowling.innings++; s.bowling.balls += log.bowling.ballsBowled; s.bowling.runs += log.bowling.runsConceded; s.bowling.wkts += log.bowling.wickets; s.bowling.dots += log.bowling.dots;
        if (firstBowl) { s.bowling.best = { wkts: log.bowling.wickets, runs: log.bowling.runsConceded }; firstBowl = false; }
        else { if (log.bowling.wickets > s.bowling.best.wkts || (log.bowling.wickets === s.bowling.best.wkts && log.bowling.runsConceded < s.bowling.best.runs)) s.bowling.best = { wkts: log.bowling.wickets, runs: log.bowling.runsConceded }; }
        const w = log.bowling.wickets; if (w >= 5) s.bowling.mil.fiveW++; else if (w === 4) s.bowling.mil.fourW++; else if (w === 3) s.bowling.mil.threeW++; else if (w === 2) s.bowling.mil.twoW++; else if (w === 1) s.bowling.mil.oneW++;
      }
      s.fielding.catches += log.fielding.catches; s.fielding.stumpings += log.fielding.stumpings; s.fielding.runOuts += log.fielding.runOuts;
    });
    s.batting.avg = s.batting.outs > 0 ? s.batting.runs / s.batting.outs : (s.batting.innings > 0 ? s.batting.runs : 0);
    s.batting.sr = s.batting.balls > 0 ? (s.batting.runs / s.batting.balls) * 100 : 0;
    s.bowling.overs = Math.floor(s.bowling.balls / 6) + (s.bowling.balls % 6) / 10;
    s.bowling.econ = s.bowling.balls >= 6 ? (s.bowling.runs / (s.bowling.balls / 6)) : 0;
    s.bowling.avg = s.bowling.wkts > 0 ? s.bowling.runs / s.bowling.wkts : 0;
    s.bowling.sr = s.bowling.wkts > 0 ? s.bowling.balls / s.bowling.wkts : 0;
    return s;
  }, [matchWiseLog]);

  const handleUpdatePlayer = () => { if (playerId) updateDocumentNonBlocking(doc(db, 'players', playerId), editForm); setIsEditOpen(false); toast({ title: "Profile Updated" }); };

  if (!isMounted || isPlayerLoading || isHistoryLoading) return (<div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4"><Loader2 className="w-10 h-10 text-primary animate-spin" /><p className="text-[10px] font-black uppercase text-slate-400">Syncing Career Data...</p></div>);
  if (!player) return <div className="p-20 text-center font-black uppercase text-slate-400">Player profile missing.</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-32 px-4 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center gap-4"><Button variant="ghost" size="icon" onClick={() => router.push('/players')} className="rounded-full h-10 w-10"><ChevronLeft className="w-6 h-6" /></Button><h1 className="text-xl font-black uppercase tracking-widest text-slate-900">Player Record</h1></div>
      <section className="bg-slate-950 text-white rounded-3xl p-8 shadow-2xl relative overflow-hidden ring-1 ring-white/10">
        <div className="absolute top-0 right-0 p-4 opacity-10"><Zap className="w-32 h-32" /></div>
        <div className="flex flex-col md:flex-row items-center gap-6 relative z-10 text-center md:text-left">
          <Avatar className="w-28 h-28 border-4 border-white/10 rounded-3xl overflow-hidden shrink-0"><AvatarImage src={player.imageUrl} className="object-cover" /><AvatarFallback className="text-4xl font-black bg-white/5">{player.name[0]}</AvatarFallback></Avatar>
          <div className="min-w-0 flex-1"><div className="flex items-center justify-center md:justify-start gap-2 mb-2"><h1 className="text-3xl font-black uppercase tracking-tighter truncate leading-tight">{player.name}</h1>{isUmpire && <Button variant="ghost" size="icon" onClick={() => setIsEditOpen(true)} className="h-8 w-8 text-white/40 hover:text-white"><Edit2 className="w-4 h-4" /></Button>}</div><div className="flex flex-wrap justify-center md:justify-start gap-2"><Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest border-white/20 text-white h-6 px-3">{player.role}</Badge>{player.isWicketKeeper && <Badge className="bg-secondary text-white font-black text-[9px] h-6">WK</Badge>}</div></div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-8 relative z-10"><div className="bg-white/5 p-4 rounded-2xl backdrop-blur-sm border border-white/5 text-center"><p className="text-[8px] font-black uppercase text-slate-500 mb-1 tracking-widest">Career CVP</p><p className="text-2xl font-black text-primary">{careerStats.cvp.toFixed(1)}</p></div><div className="bg-white/5 p-4 rounded-2xl backdrop-blur-sm border border-white/5 text-center"><p className="text-[8px] font-black uppercase text-slate-500 mb-1 tracking-widest">Matches</p><p className="text-2xl font-black">{careerStats.matches}</p></div><div className="hidden md:block bg-white/5 p-4 rounded-2xl backdrop-blur-sm border border-white/5 text-center"><p className="text-[8px] font-black uppercase text-slate-500 mb-1 tracking-widest">Status</p><p className="text-sm font-black uppercase truncate">League Pro</p></div></div>
      </section>

      <Tabs defaultValue="career" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-12 bg-slate-100 p-1 rounded-xl mb-6"><TabsTrigger value="career" className="font-black text-[10px] uppercase">Career</TabsTrigger><TabsTrigger value="form" className="font-black text-[10px] uppercase">Form</TabsTrigger><TabsTrigger value="history" className="font-black text-[10px] uppercase">Logs</TabsTrigger></TabsList>
        <TabsContent value="career" className="space-y-8">
          <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden"><div className="bg-slate-900 text-white p-4 flex items-center justify-between"><div className="flex items-center gap-2"><Swords className="w-4 h-4 text-primary" /><span className="text-[10px] font-black uppercase tracking-widest">Batting Summary</span></div><Badge variant="outline" className="text-[8px] font-black border-white/20 text-white uppercase">{careerStats.batting.innings} Innings</Badge></div><div className="p-6"><div className="grid grid-cols-3 md:grid-cols-5 gap-4 text-center"><div><p className="text-[8px] font-black text-slate-400 uppercase mb-1">Runs</p><p className="text-xl font-black text-slate-900">{careerStats.batting.runs}</p></div><div><p className="text-[8px] font-black text-slate-400 uppercase mb-1">Balls</p><p className="text-xl font-black text-slate-900">{careerStats.batting.balls}</p></div><div><p className="text-[8px] font-black text-slate-400 uppercase mb-1">4s / 6s</p><p className="text-xl font-black text-slate-900">{careerStats.batting.fours} / {careerStats.batting.sixes}</p></div><div><p className="text-[8px] font-black text-slate-400 uppercase mb-1">Avg</p><p className="text-xl font-black text-slate-900">{careerStats.batting.avg.toFixed(2)}</p></div><div><p className="text-[8px] font-black text-slate-400 uppercase mb-1">S.R.</p><p className="text-xl font-black text-slate-900">{careerStats.batting.sr.toFixed(1)}</p></div></div><div className="mt-6 pt-6 border-t"><p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 text-center">Score Milestones</p><div className="grid grid-cols-3 md:grid-cols-6 gap-2">{[{label:'10s',val:careerStats.batting.milestones.tens},{label:'20s',val:careerStats.batting.milestones.twenties},{label:'30s',val:careerStats.batting.milestones.thirties},{label:'40s',val:careerStats.batting.milestones.forties},{label:'50s',val:careerStats.batting.milestones.fifties},{label:'100s',val:careerStats.batting.milestones.hundreds}].map(m=>(<div key={m.label} className="bg-slate-50 p-2 rounded-xl text-center border"><p className="text-sm font-black text-slate-900">{m.val}</p><p className="text-[8px] font-black text-slate-400 uppercase">{m.label}</p></div>))}</div></div><div className="mt-6 pt-6 border-t"><p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 text-center">Duck Registry</p><div className="grid grid-cols-3 gap-2"><div className="bg-rose-50 p-3 rounded-xl text-center border border-rose-100"><p className="text-lg font-black text-rose-600">{careerStats.batting.ducks.regular}</p><p className="text-[8px] font-black text-rose-400 uppercase">Regular</p></div><div className="bg-rose-100 p-3 rounded-xl text-center border border-rose-200"><p className="text-lg font-black text-rose-700">{careerStats.batting.ducks.golden}</p><p className="text-[8px] font-black text-rose-500 uppercase">Golden</p></div><div className="bg-slate-900 p-3 rounded-xl text-center border border-slate-800"><p className="text-lg font-black text-white">{careerStats.batting.ducks.diamond}</p><p className="text-[8px] font-black text-slate-400 uppercase">Diamond</p></div></div></div></div></Card>
          <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden"><div className="bg-slate-900 text-white p-4 flex items-center justify-between"><div className="flex items-center gap-2"><Target className="w-4 h-4 text-secondary" /><span className="text-[10px] font-black uppercase tracking-widest">Bowling Summary</span></div><Badge variant="outline" className="text-[8px] font-black border-white/20 text-white uppercase">{careerStats.bowling.innings} Innings</Badge></div><div className="p-6"><div className="grid grid-cols-3 md:grid-cols-7 gap-4 text-center"><div><p className="text-[8px] font-black text-slate-400 uppercase mb-1">Wickets</p><p className="text-xl font-black text-secondary">{careerStats.bowling.wkts}</p></div><div><p className="text-[8px] font-black text-slate-400 uppercase mb-1">Balls</p><p className="text-xl font-black text-slate-900">{careerStats.bowling.balls}</p></div><div><p className="text-[8px] font-black text-slate-400 uppercase mb-1">Dots</p><p className="text-xl font-black text-slate-900">{careerStats.bowling.dots}</p></div><div><p className="text-[8px] font-black text-slate-400 uppercase mb-1">Runs</p><p className="text-xl font-black text-slate-900">{careerStats.bowling.runs}</p></div><div><p className="text-[8px] font-black text-slate-400 uppercase mb-1">ER</p><p className="text-xl font-black text-slate-900">{careerStats.bowling.econ.toFixed(2)}</p></div><div><p className="text-[8px] font-black text-slate-400 uppercase mb-1">Avg</p><p className="text-xl font-black text-slate-900">{careerStats.bowling.avg.toFixed(2)}</p></div><div><p className="text-[8px] font-black text-slate-400 uppercase mb-1">SR</p><p className="text-xl font-black text-slate-900">{careerStats.bowling.sr.toFixed(1)}</p></div></div><div className="mt-6 pt-6 border-t"><p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 text-center">Wicket Landmarks</p><div className="flex flex-wrap justify-center gap-3">{[10,20,30,40,50,100].map(l=>{const reached=careerStats.bowling.wkts>=l;return(<div key={l} className={cn("flex items-center gap-2 px-4 py-2 rounded-2xl border transition-all",reached?"bg-secondary/10 border-secondary text-secondary shadow-sm":"bg-slate-50 border-slate-100 text-slate-300")}><Trophy className={cn("w-4 h-4",reached?"fill-secondary":"")}/><span className="text-xs font-black uppercase tracking-widest">{l}Ws</span></div>);})}</div></div></div></Card>
          
          <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hand className="w-4 h-4 text-emerald-500" />
                <span className="text-[10px] font-black uppercase tracking-widest">Fielding Summary</span>
              </div>
              <Badge variant="outline" className="text-[8px] font-black border-white/20 text-white uppercase">
                {careerStats.fielding.catches + careerStats.fielding.stumpings + careerStats.fielding.runOuts} Dismissals
              </Badge>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Catches</p>
                  <div className="flex flex-col items-center gap-1">
                    <Hand className="w-4 h-4 text-emerald-500/50" />
                    <p className="text-xl font-black text-slate-900">{careerStats.fielding.catches}</p>
                  </div>
                </div>
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Stumpings</p>
                  <div className="flex flex-col items-center gap-1">
                    <ShieldCheck className="w-4 h-4 text-indigo-500/50" />
                    <p className="text-xl font-black text-slate-900">{careerStats.fielding.stumpings}</p>
                  </div>
                </div>
                <div>
                  <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Run Outs</p>
                  <div className="flex flex-col items-center gap-1">
                    <Crosshair className="w-4 h-4 text-rose-500/50" />
                    <p className="text-xl font-black text-slate-900">{careerStats.fielding.runOuts}</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="form" className="space-y-4"><h2 className="text-lg font-black uppercase text-slate-900 flex items-center gap-2 px-2"><Activity className="w-5 h-5 text-primary" /> Recent Form</h2><div className="space-y-3">{matchWiseLog.filter(l=>l.hasParticipated).slice(0,5).map((log,idx)=>(<Card key={idx} className="border-none shadow-sm rounded-2xl bg-white overflow-hidden"><div className="p-4 flex items-center justify-between"><div className="flex items-center gap-4"><div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col items-center justify-center min-w-[50px]"><Calendar className="w-3 h-3 text-slate-400 mb-1"/><span className="text-[8px] font-black text-slate-500 uppercase">{log.date ? new Date(log.date).toLocaleDateString('en-GB',{day:'numeric',month:'short'}) : '---'}</span></div><div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{log.matchName}</p><div className="flex items-baseline gap-2"><span className="text-xl font-black text-slate-900">{log.batting.runs} <span className="text-[8px] text-slate-400">R</span></span><span className="text-sm font-black text-secondary">{log.bowling.wickets} <span className="text-[8px] text-slate-400">W</span></span></div></div></div><div className="text-right"><p className="text-[8px] font-black text-slate-400 uppercase mb-1">Impact</p><Badge variant="secondary" className="font-black text-xs h-6">{log.totalCVP.toFixed(1)}</Badge></div></div></Card>))}</div></TabsContent>
        <TabsContent value="history" className="space-y-3">
          {matchWiseLog.length > 0 ? (
            <Card className="border-none shadow-sm rounded-2xl overflow-hidden"><Table><TableHeader className="bg-slate-50"><TableRow><TableHead className="text-[10px] font-black uppercase">Match Detail</TableHead><TableHead className="text-right text-[10px] font-black uppercase">R</TableHead><TableHead className="text-right text-[10px] font-black uppercase">W</TableHead><TableHead className="text-right text-[10px] font-black uppercase">CVP</TableHead></TableRow></TableHeader><TableBody>{matchWiseLog.map((log,idx)=>(<TableRow key={idx}><TableCell className="py-3"><p className="text-[10px] font-black uppercase text-slate-900">{log.matchName}</p><div className="flex items-center gap-2 mt-0.5"><span className="text-[8px] font-bold text-slate-400 uppercase">{log.date ? new Date(log.date).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : 'No Date'}</span><Badge variant="outline" className={cn("h-3 text-[6px] px-1 font-black",log.status==='live'?"text-red-500 border-red-200":"text-slate-400 border-slate-200")}>{log.status.toUpperCase()}</Badge>{!log.hasParticipated && <span className="text-[6px] font-black text-slate-300 uppercase tracking-tighter">(Squad Member)</span>}</div></TableCell><TableCell className="text-right font-black text-xs">{log.batting.runs}</TableCell><TableCell className="text-right font-black text-xs text-secondary">{log.bowling.wickets}</TableCell><TableCell className="text-right font-black text-xs text-primary">{log.totalCVP.toFixed(1)}</TableCell></TableRow>))}</TableBody></Table></Card>
          ) : (<div className="text-center py-12 border-2 border-dashed rounded-2xl bg-slate-50/50"><p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No match records found</p></div>)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
