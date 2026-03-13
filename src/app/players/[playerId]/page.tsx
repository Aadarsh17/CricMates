
"use client"

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useMemoFirebase, useFirestore, useCollection, updateDocumentNonBlocking } from '@/firebase';
import { doc, collectionGroup, query, collection } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, Loader2, Calendar, Activity, Zap, Medal, TrendingUp, Swords, Shield, Target, Hand, Skull, Edit2, Camera, ShieldCheck, Trophy, X, Hash, Crosshair, Crown, Star } from 'lucide-react';
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

  const deliveriesQuery = useMemoFirebase(() => isMounted && playerId ? query(collectionGroup(db, 'deliveryRecords')) : null, [db, playerId, isMounted]);
  const { data: rawDeliveries, isLoading: isHistoryLoading } = useCollection(deliveriesQuery);

  const activeMatchIds = useMemo(() => new Set(allMatches?.map(m => m.id) || []), [allMatches]);

  const matchWiseLog = useMemo(() => {
    if (!isMounted || !player || !rawDeliveries || !allMatches) return [];
    const logs: Record<string, any> = {};
    
    allMatches.forEach(m => {
      const isInSquad = (m.team1SquadPlayerIds || []).includes(playerId) || (m.team2SquadPlayerIds || []).includes(playerId);
      if (isInSquad && activeMatchIds.has(m.id)) {
        logs[m.id] = { 
          matchId: m.id, 
          matchName: m.matchNumber || 'Match', 
          status: m.status || 'completed', 
          date: m.matchDate || '', 
          batting: { runs: 0, ballsFaced: 0, fours: 0, sixes: 0, out: false, dots: 0, isGolden: false, isDiamond: false }, 
          bowling: { wickets: 0, runsConceded: 0, ballsBowled: 0, dots: 0, maidens: 0, wktsList: [] }, 
          fielding: { catches: 0, stumpings: 0, runOuts: 0 }, 
          hasParticipated: false, 
          isWinningStriker: false 
        };
      }
    });

    const sortedD = [...rawDeliveries].sort((a,b) => a.timestamp - b.timestamp);

    sortedD.forEach(d => {
      const matchId = d.__fullPath?.split('/')[1];
      if (!matchId || !activeMatchIds.has(matchId) || !logs[matchId]) return;
      const log = logs[matchId];
      const match = allMatches.find(m => m.id === matchId);

      if (d.strikerPlayerId === playerId || d.nonStrikerPlayerId === playerId) log.hasParticipated = true;
      
      if (d.strikerPlayerId === playerId) { 
        log.batting.runs += (d.runsScored || 0); 
        if (d.runsScored === 4) log.batting.fours++;
        if (d.runsScored === 6) log.batting.sixes++;
        if (d.extraType !== 'wide') { 
          log.batting.ballsFaced++; 
          if (d.runsScored === 0) log.batting.dots++; 
        }
        
        if (match?.status === 'completed' && match.winnerTeamId) {
          const inn2BatId = match.tossWinnerTeamId === match.team1Id ? (match.tossDecision === 'bat' ? match.team2Id : match.team1Id) : (match.tossDecision === 'bat' ? match.team1Id : match.team2Id);
          // Very basic winning run detection
          if (match.winnerTeamId === inn2BatId && d.__fullPath?.includes('inning_2')) {
            log.isWinningStriker = true; 
          }
        }
      }

      if (d.isWicket && d.batsmanOutPlayerId === playerId && d.dismissalType !== 'retired') {
        log.batting.out = true;
        if (log.batting.runs === 0) {
          if (log.batting.ballsFaced === 0) log.batting.isDiamond = true;
          else if (log.batting.ballsFaced === 1) log.batting.isGolden = true;
        }
      }

      const bId = d.bowlerId || d.bowlerPlayerId;
      if (bId === playerId) { 
        log.hasParticipated = true;
        log.bowling.runsConceded += (d.totalRunsOnDelivery || 0); 
        if (d.extraType === 'none' && d.dismissalType !== 'retired') { 
          log.bowling.ballsBowled++; 
          if (d.totalRunsOnDelivery === 0) log.bowling.dots++; 
        }
        if (d.isWicket && !['runout', 'retired'].includes(d.dismissalType || '')) {
          log.bowling.wickets++;
          log.bowling.wktsList.push(d.timestamp);
        }
      }

      if (d.fielderPlayerId === playerId) {
        log.hasParticipated = true;
        if (d.dismissalType === 'caught') log.fielding.catches++;
        if (d.dismissalType === 'stumped') log.fielding.stumpings++;
        if (d.dismissalType === 'runout') log.fielding.runOuts++;
      }
    });

    return Object.values(logs).map((log: any) => ({ 
      ...log, 
      totalCVP: calculatePlayerCVP({ ...log.batting, ...log.bowling, ...log.fielding, id: player.id, name: player.name, maidens: log.bowling.maidens, ballsBowled: log.bowling.ballsBowled, runsConceded: log.bowling.runsConceded }) 
    })).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [rawDeliveries, allMatches, player, isMounted, playerId, activeMatchIds]);

  const careerStats = useMemo(() => {
    const s = { 
      matches: 0, cvp: 0,
      batting: { innings: 0, runs: 0, balls: 0, fours: 0, sixes: 0, outs: 0, high: 0, milestones: { hundreds: 0, fifties: 0, thirties: 0, twenties: 0, tens: 0 }, ducks: { regular: 0, golden: 0, diamond: 0 }, dots: 0 },
      bowling: { innings: 0, wkts: 0, hauls: { w1: 0, w2: 0, w3: 0, w4: 0, w5: 0 }, milestones: { fiveW: 0, threeW: 0 }, dots: 0 },
      fielding: { catches: 0, stumpings: 0, runOuts: 0 },
      badges: { finisher: 0, sixMachine: 0, hattricks: 0 }
    };
    
    matchWiseLog.forEach(log => {
      s.matches++; s.cvp += log.totalCVP;
      if (log.batting.ballsFaced > 0 || log.batting.out) {
        s.batting.innings++; s.batting.runs += log.batting.runs; s.batting.balls += log.batting.ballsFaced; s.batting.fours += log.batting.fours; s.batting.sixes += log.batting.sixes; s.batting.dots += log.batting.dots;
        if (log.batting.out) { 
          s.batting.outs++; 
          if (log.batting.runs === 0) {
            if (log.batting.isDiamond) s.batting.ducks.diamond++;
            else if (log.batting.isGolden) s.batting.ducks.golden++;
            else s.batting.ducks.regular++;
          }
        }
        if (log.batting.runs > s.batting.high) s.batting.high = log.batting.runs;
        if (log.batting.runs >= 100) s.batting.milestones.hundreds++;
        else if (log.batting.runs >= 50) s.batting.milestones.fifties++;
        else if (log.batting.runs >= 30) s.batting.milestones.thirties++;
        else if (log.batting.runs >= 20) s.batting.milestones.twenties++;
        else if (log.batting.runs >= 10) s.batting.milestones.tens++;
        
        if (log.batting.sixes >= 5) s.badges.sixMachine++;
        if (log.isWinningStriker) s.badges.finisher++;
      }
      if (log.bowling.ballsBowled > 0) {
        s.bowling.innings++; s.bowling.wkts += log.bowling.wickets; s.bowling.dots += log.bowling.dots;
        if (log.bowling.wickets === 1) s.bowling.hauls.w1++;
        else if (log.bowling.wickets === 2) s.bowling.hauls.w2++;
        else if (log.bowling.wickets === 3) { s.bowling.hauls.w3++; s.bowling.milestones.threeW++; }
        else if (log.bowling.wickets === 4) { s.bowling.hauls.w4++; s.bowling.milestones.threeW++; }
        else if (log.bowling.wickets >= 5) { s.bowling.hauls.w5++; s.bowling.milestones.fiveW++; }
      }
      s.fielding.catches += log.fielding.catches; s.fielding.stumpings += log.fielding.stumpings; s.fielding.runOuts += log.fielding.runOuts;
    });
    return s;
  }, [matchWiseLog]);

  const leagueCaps = useMemo(() => {
    if (!allMatches || !rawDeliveries || !isMounted) return { isOrange: false, isPurple: false };
    const activeIds = new Set(allMatches.map(m => m.id));
    const allR: Record<string, number> = {};
    const allW: Record<string, number> = {};
    
    rawDeliveries.forEach(d => {
      const mid = d.__fullPath?.split('/')[1];
      if (!mid || !activeIds.has(mid)) return;
      if (d.strikerPlayerId) allR[d.strikerPlayerId] = (allR[d.strikerPlayerId] || 0) + (d.runsScored || 0);
      const bId = d.bowlerId || d.bowlerPlayerId;
      if (bId && bId !== 'none' && d.isWicket && !['runout', 'retired'].includes(d.dismissalType || '')) {
        allW[bId] = (allW[bId] || 0) + 1;
      }
    });

    const topR = Object.entries(allR).sort((a,b) => b[1] - a[1])[0]?.[0];
    const topW = Object.entries(allW).sort((a,b) => b[1] - a[1])[0]?.[0];

    return { isOrange: topR === playerId, isPurple: topW === playerId };
  }, [allMatches, rawDeliveries, isMounted, playerId]);

  const handleUpdatePlayer = () => { if (playerId) updateDocumentNonBlocking(doc(db, 'players', playerId), editForm); setIsEditOpen(false); toast({ title: "Profile Updated" }); };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader(); reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image(); img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas'); const size = 200;
          let width = img.width; let height = img.height;
          if (width > height) { if (width > size) { height *= size / width; width = size; } }
          else { if (height > size) { width *= size / height; height = size; } }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d'); ctx?.drawImage(img, 0, 0, width, height);
          setEditForm(prev => ({ ...prev, imageUrl: canvas.toDataURL('image/jpeg', 0.8) }));
          toast({ title: "Photo Ready" });
        };
      };
    }
  };

  if (!isMounted || isPlayerLoading || isHistoryLoading) return <div className="py-20 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" /></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-32 px-4 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-center gap-4"><Button variant="ghost" size="icon" onClick={() => router.push('/players')} className="rounded-full h-10 w-10"><ChevronLeft className="w-6 h-6" /></Button><h1 className="text-xl font-black uppercase tracking-widest text-slate-900">Player Record</h1></div>
      
      <section className="bg-slate-950 text-white rounded-3xl p-8 shadow-2xl relative overflow-hidden ring-1 ring-white/10">
        <div className="absolute top-0 right-0 p-4 opacity-10"><Zap className="w-32 h-32" /></div>
        <div className="flex flex-col md:flex-row items-center gap-6 relative z-10 text-center md:text-left">
          <Avatar className="w-28 h-28 border-4 border-white/10 rounded-3xl overflow-hidden shrink-0">
            <AvatarImage src={player.imageUrl} className="object-cover" />
            <AvatarFallback className="text-4xl font-black bg-white/5">{player.name[0]}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
              <h1 className="text-3xl font-black uppercase tracking-tighter truncate leading-tight">{player.name}</h1>
              {isUmpire && <Button variant="ghost" size="icon" onClick={() => setIsEditOpen(true)} className="h-8 w-8 text-white/40 hover:text-white"><Edit2 className="w-4 h-4" /></Button>}
              <div className="flex gap-1">
                {leagueCaps.isOrange && <div className="bg-orange-500 p-1.5 rounded-lg shadow-lg animate-bounce" title="Orange Cap Holder"><Trophy className="w-4 h-4 text-white" /></div>}
                {leagueCaps.isPurple && <div className="bg-indigo-600 p-1.5 rounded-lg shadow-lg animate-bounce" title="Purple Cap Holder"><Target className="w-4 h-4 text-white" /></div>}
              </div>
            </div>
            <div className="flex flex-wrap justify-center md:justify-start gap-2">
              <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest border-white/20 text-white h-6 px-3">{player.role}</Badge>
              {player.isWicketKeeper && <Badge className="bg-secondary text-white font-black text-[9px] h-6">WK</Badge>}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-8 relative z-10">
          <div className="bg-white/5 p-4 rounded-2xl backdrop-blur-sm border border-white/5 text-center"><p className="text-[8px] font-black uppercase text-slate-500 mb-1">Career CVP</p><p className="text-2xl font-black text-primary">{careerStats.cvp.toFixed(1)}</p></div>
          <div className="bg-white/5 p-4 rounded-2xl backdrop-blur-sm border border-white/5 text-center"><p className="text-[8px] font-black uppercase text-slate-500 mb-1">Matches</p><p className="text-2xl font-black">{careerStats.matches}</p></div>
          <div className="hidden md:block bg-white/5 p-4 rounded-2xl backdrop-blur-sm border border-white/5 text-center"><p className="text-[8px] font-black uppercase text-slate-500 mb-1">Status</p><p className="text-sm font-black uppercase truncate">League Pro</p></div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-black uppercase text-slate-900 flex items-center gap-2 px-2"><Medal className="w-5 h-5 text-amber-500" /> Professional Badges</h2>
        <div className="flex flex-wrap gap-3">
          {[
            { id: 'cent', val: careerStats.batting.milestones.hundreds, label: 'Century Maker', icon: Zap, color: 'text-amber-500', bg: 'bg-amber-50' },
            { id: 'fifty', val: careerStats.batting.milestones.fifties, label: 'Reliable 50', icon: Star, color: 'text-blue-500', bg: 'bg-blue-50' },
            { id: 'six', val: careerStats.badges.sixMachine, label: 'Six Machine', icon: Swords, color: 'text-primary', bg: 'bg-primary/5' },
            { id: 'fin', val: careerStats.badges.finisher, label: 'The Finisher', icon: Target, color: 'text-emerald-500', bg: 'bg-emerald-50' },
            { id: 'w3', val: careerStats.bowling.milestones.threeW, label: 'Wicket Taker', icon: Shield, color: 'text-indigo-500', bg: 'bg-indigo-50' }
          ].map(b => (
            <div key={b.id} className={cn("flex flex-col items-center p-3 rounded-2xl border min-w-[80px] transition-all", b.val > 0 ? `${b.bg} border-transparent shadow-sm scale-105` : "opacity-30 grayscale")}>
              <b.icon className={cn("w-6 h-6 mb-1", b.color)} />
              <span className="text-[7px] font-black uppercase text-center max-w-[60px]">{b.label}</span>
              {b.val > 0 && <Badge className="h-3 text-[6px] px-1 font-black bg-white text-slate-900 mt-1">{b.val}x</Badge>}
            </div>
          ))}
        </div>
      </section>

      <Tabs defaultValue="career" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-12 bg-slate-100 p-1 rounded-xl mb-6">
          <TabsTrigger value="career" className="font-black text-[10px] uppercase">Summary</TabsTrigger>
          <TabsTrigger value="milestones" className="font-black text-[10px] uppercase">Milestones</TabsTrigger>
          <TabsTrigger value="history" className="font-black text-[10px] uppercase">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="career" className="space-y-8">
          <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2"><Swords className="w-4 h-4 text-primary" /><span className="text-[10px] font-black uppercase tracking-widest">Batting Analysis</span></div>
              <Badge variant="outline" className="text-[8px] font-black border-white/20 text-white uppercase">{careerStats.batting.innings} Innings</Badge>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-3 md:grid-cols-5 gap-4 text-center">
                <div><p className="text-[8px] font-black text-slate-400 uppercase mb-1">Runs</p><p className="text-xl font-black text-slate-900">{careerStats.batting.runs}</p></div>
                <div><p className="text-[8px] font-black text-slate-400 uppercase mb-1">4s/6s</p><p className="text-xl font-black text-slate-900">{careerStats.batting.fours}/{careerStats.batting.sixes}</p></div>
                <div><p className="text-[8px] font-black text-slate-400 uppercase mb-1">High</p><p className="text-xl font-black text-slate-900">{careerStats.batting.high}</p></div>
                <div><p className="text-[8px] font-black text-slate-400 uppercase mb-1">Dots</p><p className="text-xl font-black text-slate-900">{careerStats.batting.dots}</p></div>
                <div><p className="text-[8px] font-black text-slate-400 uppercase mb-1">Avg</p><p className="text-xl font-black text-slate-900">{careerStats.batting.outs > 0 ? (careerStats.batting.runs / careerStats.batting.outs).toFixed(1) : careerStats.batting.runs}</p></div>
              </div>
            </div>
          </Card>

          <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2"><Target className="w-4 h-4 text-secondary" /><span className="text-[10px] font-black uppercase tracking-widest">Bowling Analysis</span></div>
              <Badge variant="outline" className="text-[8px] font-black border-white/20 text-white uppercase">{careerStats.bowling.innings} Innings</Badge>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-3 md:grid-cols-4 gap-4 text-center">
                <div><p className="text-[8px] font-black text-slate-400 uppercase mb-1">Wickets</p><p className="text-xl font-black text-secondary">{careerStats.bowling.wkts}</p></div>
                <div><p className="text-[8px] font-black text-slate-400 uppercase mb-1">Dots</p><p className="text-xl font-black text-slate-900">{careerStats.bowling.dots}</p></div>
                <div><p className="text-[8px] font-black text-slate-400 uppercase mb-1">Econ</p><p className="text-xl font-black text-slate-900">{(careerStats.bowling.wkts > 0) ? '---' : '0.00'}</p></div>
                <div><p className="text-[8px] font-black text-slate-400 uppercase mb-1">Strikes</p><Badge variant="secondary" className="h-6 font-black text-xs">League Pro</Badge></div>
              </div>
            </div>
          </Card>

          <Card className="border-none shadow-xl rounded-3xl bg-white overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2"><Hand className="w-4 h-4 text-emerald-500" /><span className="text-[10px] font-black uppercase tracking-widest">Fielding Analysis</span></div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div><p className="text-[8px] font-black text-slate-400 uppercase mb-1">Catches</p><p className="text-xl font-black text-slate-900">{careerStats.fielding.catches}</p></div>
                <div><p className="text-[8px] font-black text-slate-400 uppercase mb-1">Stumpings</p><p className="text-xl font-black text-slate-900">{careerStats.fielding.stumpings}</p></div>
                <div><p className="text-[8px] font-black text-slate-400 uppercase mb-1">Run Outs</p><p className="text-xl font-black text-slate-900">{careerStats.fielding.runOuts}</p></div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="milestones" className="space-y-6">
          <Card className="border-none shadow-xl rounded-3xl bg-white p-6 space-y-6">
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 border-b pb-2">Batting Landmarks</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-slate-50 p-3 rounded-xl">
                  <p className="text-[10px] font-black text-primary">100s</p>
                  <p className="text-lg font-black">{careerStats.batting.milestones.hundreds}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl">
                  <p className="text-[10px] font-black text-primary">50s</p>
                  <p className="text-lg font-black">{careerStats.batting.milestones.fifties}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl">
                  <p className="text-[10px] font-black text-primary">25s</p>
                  <p className="text-lg font-black">{careerStats.batting.milestones.thirties + careerStats.batting.milestones.twenties}</p>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 border-b pb-2">Wicket Landmarks (Career)</h3>
              <div className="grid grid-cols-2 gap-3">
                {[10, 20, 30, 40, 50, 100].map(landmark => {
                  const achieved = careerStats.bowling.wkts >= landmark;
                  return (
                    <div key={landmark} className={cn("flex items-center justify-between p-3 rounded-xl border transition-all", achieved ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-transparent opacity-40")}>
                      <div className="flex items-center gap-2">
                        {achieved ? <Trophy className="w-4 h-4 text-amber-500" /> : <Shield className="w-4 h-4 text-slate-300" />}
                        <span className="text-[10px] font-black uppercase">{landmark} Wickets</span>
                      </div>
                      {achieved && <Badge className="bg-amber-500 text-white text-[8px] h-4">ELITE</Badge>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 border-b pb-2">Match Hauls (Bowling)</h3>
              <div className="grid grid-cols-5 gap-2 text-center">
                {[1, 2, 3, 4, 5].map(w => (
                  <div key={w} className="bg-slate-50 p-2 rounded-lg">
                    <p className="text-[8px] font-black uppercase text-slate-400">{w}W</p>
                    <p className="text-sm font-black">{careerStats.bowling.hauls[`w${w}` as keyof typeof careerStats.bowling.hauls]}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 border-b pb-2">Duck Registry</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-rose-50 p-3 rounded-xl">
                  <p className="text-[8px] font-black text-rose-600 uppercase">Regular</p>
                  <p className="text-lg font-black text-rose-900">{careerStats.batting.ducks.regular}</p>
                </div>
                <div className="bg-rose-100 p-3 rounded-xl border border-rose-200">
                  <p className="text-[8px] font-black text-rose-700 uppercase">Golden</p>
                  <p className="text-lg font-black text-rose-950">{careerStats.batting.ducks.golden}</p>
                </div>
                <div className="bg-slate-900 p-3 rounded-xl">
                  <p className="text-[8px] font-black text-slate-400 uppercase">Diamond</p>
                  <p className="text-lg font-black text-white">{careerStats.batting.ducks.diamond}</p>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-3">
          <div className="px-2 mb-4">
            <h2 className="text-lg font-black uppercase text-slate-900 flex items-center gap-2"><History className="w-5 h-5 text-primary" /> Verification Logs</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Audit trail for all career matches</p>
          </div>
          {matchWiseLog.length > 0 ? (
            <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase">Match Detail</TableHead>
                    <TableHead className="text-right text-[10px] font-black uppercase">R</TableHead>
                    <TableHead className="text-right text-[10px] font-black uppercase">W</TableHead>
                    <TableHead className="text-right text-[10px] font-black uppercase">Impact</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matchWiseLog.map((log, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="py-3">
                        <p className="text-[10px] font-black uppercase text-slate-900">{log.matchName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[8px] font-bold text-slate-400 uppercase">
                            {log.date ? new Date(log.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '---'}
                          </span>
                          <Badge variant="outline" className={cn("h-4 text-[6px] px-1 font-black", log.status === 'live' ? "border-red-200 text-red-500" : "border-slate-200 text-slate-400")}>
                            {log.status.toUpperCase()}
                          </Badge>
                          {!log.hasParticipated && <span className="text-[6px] font-black text-slate-300 uppercase tracking-tighter">(Squad Member)</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-black text-xs">{log.batting.runs}</TableCell>
                      <TableCell className="text-right font-black text-xs text-secondary">{log.bowling.wickets}</TableCell>
                      <TableCell className="text-right font-black text-xs text-primary">{log.totalCVP.toFixed(1)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : (
            <div className="text-center py-12 border-2 border-dashed rounded-2xl bg-slate-50/50">
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No active registry found</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-md rounded-3xl border-t-8 border-t-primary shadow-2xl">
          <DialogHeader><DialogTitle className="font-black uppercase tracking-tight">Player Profile</DialogTitle></DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex flex-col items-center gap-4">
              <div className="relative group cursor-pointer" onClick={() => (document.getElementById('player-p-edit') as HTMLInputElement).click()}>
                <Avatar className="w-28 h-28 border-4 border-white shadow-xl rounded-3xl overflow-hidden ring-4 ring-slate-100">
                  <AvatarImage src={editForm.imageUrl || PlaceHolderImages.find(img => img.id === 'player-avatar')?.imageUrl} className="object-cover" />
                  <AvatarFallback className="bg-primary text-white text-4xl font-black">{editForm.name?.[0] || '?'}</AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl flex flex-col items-center justify-center text-white"><Camera className="w-6 h-6 mb-1"/><span className="text-[8px] font-black uppercase">Change Photo</span></div>
                <input type="file" id="player-p-edit" onChange={handleFileChange} className="hidden" accept="image/*" />
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Official Name</Label><Input value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} className="font-bold h-12 shadow-sm" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Role</Label><Select value={editForm.role} onValueChange={(v) => setEditForm({...editForm, role: v})}><SelectTrigger className="font-bold h-12"><SelectValue /></SelectTrigger><SelectContent position="popper"><SelectItem value="Batsman">Batsman</SelectItem><SelectItem value="Bowler">Bowler</SelectItem><SelectItem value="All-rounder">All-rounder</SelectItem></SelectContent></Select></div>
                <div className="space-y-1.5"><Label className="text-[10px] font-black uppercase">Batting Style</Label><Select value={editForm.battingStyle} onValueChange={(v) => setEditForm({...editForm, battingStyle: v})}><SelectTrigger className="font-bold h-12"><SelectValue /></SelectTrigger><SelectContent position="popper"><SelectItem value="Right Handed Bat">RHB</SelectItem><SelectItem value="Left Handed Bat">LHB</SelectItem></SelectContent></Select></div>
              </div>
              <div className="flex items-center space-x-3 bg-slate-50 p-4 rounded-xl border"><Checkbox id="wk-edit-p" checked={editForm.isWicketKeeper} onCheckedChange={(c) => setEditForm({...editForm, isWicketKeeper: !!c})} /><Label htmlFor="wk-edit-p" className="text-xs font-black uppercase">Wicket Keeper</Label></div>
            </div>
          </div>
          <DialogFooter><Button onClick={handleUpdatePlayer} className="w-full h-14 font-black uppercase tracking-widest text-lg shadow-xl bg-primary">Commit Changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
