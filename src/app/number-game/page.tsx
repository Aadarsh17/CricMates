"use client"

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { History as HistoryIcon, RotateCcw, Play, Circle, Skull, Hash, UserPlus, Undo2, Download, Trash2, ShieldCheck, Zap, Plus, ArrowRight, UserCircle, Trophy, Target, CheckCircle2, ChevronLeft } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { generateStreetReport } from '@/lib/report-utils';
import { useRouter } from 'next/navigation';

interface Player {
  id: string;
  name: string;
  order: number;
  batting: {
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    out: boolean;
    dismissal: string;
    fielderId: string;
    highScore: number;
  };
  bowling: {
    balls: number;
    runs: number;
    wickets: number;
    maidens: number;
    bestWickets: number;
  };
}

const STORAGE_KEY = 'cricmates_street_pro_session_v2';

export default function NumberGame() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [gameState, setGameState] = useState<'setup' | 'playing' | 'finished'>('setup');
  const [playerNames, setPlayerNames] = useState<string[]>(['', '', '']);
  const [players, setPlayers] = useState<Player[]>([]);
  const [strikerId, setStrikerId] = useState<string>('');
  const [bowlerId, setBowlerId] = useState<string>('');
  const [history, setHistory] = useState<any[]>([]);
  const [consecutiveDots, setConsecutiveDots] = useState(0);
  const [ballsInOver, setBallsInOver] = useState(0);
  
  const [isWicketOpen, setIsWicketOpen] = useState(false);
  const [isNoBallOpen, setIsNoBallOpen] = useState(false);
  const [wicketForm, setWicketForm] = useState({ type: 'caught', fielderId: 'none' });
  const [isAddPlayerOpen, setIsAddPlayerOpen] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');

  // 1. Initial Mount & Load from Persistence
  useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const d = JSON.parse(saved);
        setGameState(d.gameState);
        setPlayers(d.players);
        setStrikerId(d.strikerId);
        setBowlerId(d.bowlerId);
        setHistory(d.history);
        setConsecutiveDots(d.consecutiveDots || 0);
        setBallsInOver(d.ballsInOver || 0);
        if (d.players && d.players.length > 0) {
          setPlayerNames(d.players.map((p: any) => p.name));
        }
      } catch (e) {
        console.error("Failed to restore session", e);
      }
    }
  }, []);

  // 2. Save to Persistence on any state change
  useEffect(() => {
    if (!isMounted) return;
    const sessionData = {
      gameState,
      players,
      strikerId,
      bowlerId,
      history,
      consecutiveDots,
      ballsInOver
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
  }, [gameState, players, strikerId, bowlerId, history, consecutiveDots, ballsInOver, isMounted]);

  const addSetupField = () => {
    if (playerNames.length < 15) setPlayerNames([...playerNames, '']);
  };

  const removeSetupField = (index: number) => {
    if (playerNames.length > 3) {
      const newNames = [...playerNames];
      newNames.splice(index, 1);
      setPlayerNames(newNames);
    }
  };

  const startGame = () => {
    const validNames = playerNames.filter(n => n.trim() !== '');
    if (validNames.length < 3) {
      toast({ title: "Validation Error", description: "Min 3 players required for a game.", variant: "destructive" });
      return;
    }

    const initialPlayers: Player[] = validNames.map((name, i) => ({
      id: `p-${i}-${Date.now()}`,
      name,
      order: i + 1,
      batting: { runs: 0, balls: 0, fours: 0, sixes: 0, out: false, dismissal: '', fielderId: '', highScore: 0 },
      bowling: { balls: 0, runs: 0, wickets: 0, maidens: 0, bestWickets: 0 }
    }));

    setPlayers(initialPlayers);
    setStrikerId(initialPlayers[0].id);
    setBowlerId(initialPlayers[initialPlayers.length - 1].id);
    setGameState('playing');
    setHistory([]);
    setConsecutiveDots(0);
    setBallsInOver(0);
  };

  const resetGame = () => {
    const confirmMsg = gameState === 'finished' 
      ? "Start new match with players sorted by performance?" 
      : "Reset match? This will clear all persistent scoring data.";

    if (confirm(confirmMsg)) {
      let nextNames = ['', '', ''];
      
      if (players.length > 0) {
        // Sort by runs (desc) for the next setup
        const sorted = [...players].sort((a, b) => b.batting.runs - a.batting.runs);
        nextNames = sorted.map(p => p.name);
      }

      localStorage.removeItem(STORAGE_KEY);
      setGameState('setup');
      setPlayers([]);
      setHistory([]);
      setPlayerNames(nextNames);
      setConsecutiveDots(0);
      setBallsInOver(0);
      
      if (gameState === 'finished') {
        toast({ title: "Order Updated", description: "Players sorted by runs scored in previous game." });
      }
    }
  };

  const rotateBowler = (currentBowlerId: string, currentStrikerId: string) => {
    const index = players.findIndex(p => p.id === currentBowlerId);
    let nextIndex = index - 1;
    if (nextIndex < 0) nextIndex = players.length - 1;
    
    // Skip the current striker to prevent self-bowling
    if (players[nextIndex].id === currentStrikerId) {
      nextIndex = nextIndex - 1;
      if (nextIndex < 0) nextIndex = players.length - 1;
    }
    
    setBowlerId(players[nextIndex].id);
    setBallsInOver(0);
    toast({ title: `Over Changed`, description: `New Bowler: ${players[nextIndex].name}` });
  };

  const handleScore = (runs: number, extra: 'none' | 'wide' | 'noball' = 'none') => {
    const prevStrikerId = strikerId;
    const prevBowlerId = bowlerId;
    
    const ballRecord = {
      strikerId: prevStrikerId,
      bowlerId: prevBowlerId,
      runs,
      extra,
      isWicket: false,
      prevDots: consecutiveDots,
      prevBalls: ballsInOver
    };

    setHistory([ballRecord, ...history].slice(0, 30));

    setPlayers(prev => prev.map(p => {
      if (p.id === prevStrikerId) {
        const isLegal = extra === 'none';
        const newRuns = p.batting.runs + (extra === 'wide' ? 0 : runs);
        return {
          ...p,
          batting: {
            ...p.batting,
            runs: newRuns,
            balls: p.batting.balls + (isLegal ? 1 : 0),
            fours: p.batting.fours + (runs === 4 && extra !== 'wide' ? 1 : 0),
            sixes: p.batting.sixes + (runs === 6 && extra !== 'wide' ? 1 : 0),
            highScore: Math.max(p.batting.highScore, newRuns)
          }
        };
      }
      if (p.id === prevBowlerId) {
        return {
          ...p,
          bowling: {
            ...p.bowling,
            runs: p.bowling.runs + runs + (extra !== 'none' ? 1 : 0),
            balls: p.bowling.balls + (extra === 'none' ? 1 : 0)
          }
        };
      }
      return p;
    }));

    if (extra !== 'none') {
      setConsecutiveDots(0);
    } else if (runs === 0) {
      const nextDots = consecutiveDots + 1;
      setConsecutiveDots(nextDots);
      if (nextDots === 3) handleWicket('3-Dots Streak');
    } else {
      setConsecutiveDots(0);
    }

    if (extra === 'none') {
      const nextBalls = ballsInOver + 1;
      if (nextBalls === 6) {
        rotateBowler(prevBowlerId, prevStrikerId);
      } else {
        setBallsInOver(nextBalls);
      }
    }
    
    setIsNoBallOpen(false);
  };

  const handleWicket = (type: string, fielderId: string = 'none') => {
    const prevStrikerId = strikerId;
    const prevBowlerId = bowlerId;

    const ballRecord = {
      strikerId: prevStrikerId,
      bowlerId: prevBowlerId,
      runs: 0,
      extra: 'none',
      isWicket: true,
      wicketType: type,
      prevDots: consecutiveDots,
      prevBalls: ballsInOver
    };

    setHistory([ballRecord, ...history].slice(0, 30));

    setPlayers(prev => prev.map(p => {
      if (p.id === prevStrikerId) {
        return {
          ...p,
          batting: { ...p.batting, out: true, dismissal: type, fielderId, balls: p.batting.balls + (type === '3-Dots Streak' ? 0 : 1) }
        };
      }
      if (p.id === prevBowlerId) {
        const isBowlerWkt = !['runout', '3-Dots Streak', 'retired'].includes(type);
        const newWkts = p.bowling.wickets + (isBowlerWkt ? 1 : 0);
        return {
          ...p,
          bowling: { 
            ...p.bowling, 
            wickets: newWkts,
            bestWickets: Math.max(p.bowling.bestWickets, newWkts),
            balls: p.bowling.balls + (['runout', '3-Dots Streak', 'retired'].includes(type) ? 0 : 1)
          }
        };
      }
      return p;
    }));

    setConsecutiveDots(0);
    setIsWicketOpen(false);
    toast({ title: `OUT: ${type.toUpperCase()}`, variant: "destructive" });
  };

  const handleSelectNextBatter = (nextId: string) => {
    if (nextId === bowlerId) rotateBowler(bowlerId, nextId);
    setStrikerId(nextId);
  };

  const undoLastAction = () => {
    if (history.length === 0) return;
    const last = history[0];
    setHistory(history.slice(1));
    
    setPlayers(prev => prev.map(p => {
      if (p.id === last.strikerId) {
        return {
          ...p,
          batting: {
            ...p.batting,
            runs: p.batting.runs - (last.extra === 'wide' ? 0 : last.runs),
            balls: Math.max(0, p.batting.balls - (last.extra === 'none' && last.wicketType !== '3-Dots Streak' ? 1 : 0)),
            fours: p.batting.fours - (last.runs === 4 && last.extra !== 'wide' ? 1 : 0),
            sixes: p.batting.sixes - (last.runs === 6 && last.extra !== 'wide' ? 1 : 0),
            out: false,
            dismissal: ''
          }
        };
      }
      if (p.id === last.bowlerId) {
        const isBowlerWkt = last.isWicket && !['runout', '3-Dots Streak', 'retired'].includes(last.wicketType || '');
        return {
          ...p,
          bowling: {
            ...p.bowling,
            runs: p.bowling.runs - last.runs - (last.extra !== 'none' ? 1 : 0),
            balls: Math.max(0, p.bowling.balls - (last.extra === 'none' ? 1 : 0)),
            wickets: p.bowling.wickets - (isBowlerWkt ? 1 : 0)
          }
        };
      }
      return p;
    }));

    setConsecutiveDots(last.prevDots);
    setBallsInOver(last.prevBalls);
    setStrikerId(last.strikerId);
    setBowlerId(last.bowlerId);
    toast({ title: "Action Undone" });
  };

  const handleDownloadReport = () => {
    const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const reportHtml = generateStreetReport(players, dateStr);
    const blob = new Blob([reportHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CricMates_StreetPro_${Date.now()}.html`;
    a.click();
    toast({ title: "Report Downloaded", description: "The official scorecard is ready." });
  };

  if (!isMounted) return null;

  if (gameState === 'setup') {
    return (
      <div className="max-w-md mx-auto space-y-6 py-8 px-4 animate-in fade-in slide-in-from-bottom-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-xl font-black uppercase tracking-widest text-slate-900">Street Session</h1>
        </div>

        <div className="text-center space-y-2">
          <div className="bg-primary w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg rotate-3">
            <Hash className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900">Street Pro Setup</h1>
          <p className="text-slate-500 text-sm font-medium italic">Persistent Casual Scoring</p>
        </div>

        <Card className="border-t-8 border-t-primary shadow-xl">
          <CardHeader>
            <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">Player Registry (3-15 participants)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {playerNames.map((name, i) => (
              <div key={i} className="flex gap-2">
                <div className="flex-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">#{i + 1}</span>
                  <Input 
                    value={name} 
                    onChange={(e) => {
                      const n = [...playerNames];
                      n[i] = e.target.value;
                      setPlayerNames(n);
                    }}
                    placeholder={`Player Name`}
                    className="pl-10 font-bold h-12"
                  />
                </div>
                {playerNames.length > 3 && (
                  <Button variant="ghost" size="icon" onClick={() => removeSetupField(i)} className="h-12 w-12 text-slate-300 hover:text-destructive shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
            
            {playerNames.length < 15 && (
              <Button variant="outline" onClick={addSetupField} className="w-full border-dashed border-2 h-12 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <Plus className="w-4 h-4 mr-2" /> Add Participant
              </Button>
            )}

            <Button onClick={startGame} className="w-full h-14 font-black uppercase tracking-widest text-lg shadow-xl group mt-4">
              START GAME <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeStriker = players.find(p => p.id === strikerId);
  const activeBowler = players.find(p => p.id === bowlerId);

  if (gameState === 'finished') {
    return (
      <div className="max-w-4xl mx-auto space-y-8 py-12 px-4 text-center">
        <div className="flex justify-start mb-4">
          <Button variant="ghost" size="icon" onClick={() => setGameState('setup')} className="rounded-full h-10 w-10">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </div>
        <div className="bg-emerald-500 w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-xl mb-4">
          <Trophy className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-900">Session Complete</h1>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Official Records Validated</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg mx-auto">
          <Button onClick={handleDownloadReport} className="h-16 font-black uppercase tracking-widest text-lg shadow-xl bg-secondary hover:bg-secondary/90 text-white">
            <Download className="w-6 h-6 mr-2" /> Download Report
          </Button>
          <Button onClick={resetGame} variant="outline" className="h-16 font-black uppercase tracking-widest text-lg border-2 border-primary text-primary">
            <RotateCcw className="w-6 h-6 mr-2" /> Start New Match
          </Button>
        </div>

        <Card className="max-w-2xl mx-auto border-none shadow-lg mt-8 overflow-hidden">
          <div className="bg-slate-50 px-4 py-3 border-b text-left">
            <span className="text-[10px] font-black uppercase text-slate-500">Tournament Leaderboard</span>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="text-[9px] font-black uppercase">Participant</TableHead>
                  <TableHead className="text-right text-[9px] font-black uppercase">Runs</TableHead>
                  <TableHead className="text-right text-[9px] font-black uppercase">Wkts</TableHead>
                  <TableHead className="text-right text-[9px] font-black uppercase">B.S.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...players].sort((a, b) => b.batting.runs - a.batting.runs).map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="text-left font-black text-xs uppercase py-4">{p.name}</TableCell>
                    <TableCell className="text-right font-black text-primary">{p.batting.runs}</TableCell>
                    <TableCell className="text-right font-black text-secondary">{p.bowling.wickets}</TableCell>
                    <TableCell className="text-right font-bold text-slate-400 text-xs">{p.batting.highScore}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 px-1 md:px-4">
      <div className="flex items-center gap-4 mb-2">
        <Button variant="ghost" size="icon" onClick={() => { if(confirm("Discard current game?")) setGameState('setup'); }} className="text-slate-400 hover:bg-slate-100 rounded-full">
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Live Street Pro v2.0</span>
      </div>

      <Card className={cn("border-none shadow-2xl transition-all overflow-hidden", activeStriker?.batting.out ? "ring-4 ring-destructive" : "ring-4 ring-primary")}>
        <div className="bg-slate-900 text-white p-6 md:p-8 space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start gap-6">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                <UserCircle className="w-3 h-3"/> Active Striker
              </p>
              <h2 className="text-3xl font-black uppercase tracking-tighter">{activeStriker?.name}</h2>
              <div className="flex gap-4">
                <span className="text-xl font-bold">{activeStriker?.batting.runs} <span className="text-xs opacity-50 font-medium">Runs</span></span>
                <span className="text-xl font-bold">{activeStriker?.batting.balls} <span className="text-xs opacity-50 font-medium">Balls</span></span>
              </div>
            </div>
            <div className="text-left md:text-right space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary flex items-center md:justify-end gap-2">
                <Zap className="w-3 h-3"/> Active Bowler
              </p>
              <h2 className="text-xl font-black uppercase tracking-tighter text-slate-300">{activeBowler?.name}</h2>
              <p className="text-xs font-bold text-slate-500 uppercase">Over Progress: {ballsInOver}/6 Legal</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white/5 p-3 rounded-lg border border-white/10 w-fit">
            {[...Array(3)].map((_, i) => (
              <div key={i} className={cn("w-4 h-4 rounded-full border-2", i < consecutiveDots ? "bg-red-500 border-red-600 animate-pulse shadow-[0_0_10px_#ef4444]" : "border-slate-700")} />
            ))}
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-2">3-Dots Warning</span>
          </div>

          {!activeStriker?.batting.out ? (
            <div className="space-y-4">
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {[0, 1, 2, 3, 4, 6].map(r => (
                  <Button key={r} onClick={() => handleScore(r)} className={cn("h-12 md:h-14 font-black text-lg bg-white/5 border border-white/10 hover:bg-primary transition-all", r >= 4 ? "text-primary border-primary/40" : "text-white")}>
                    {r === 0 ? "•" : r}
                  </Button>
                ))}
                <Button variant="destructive" onClick={() => setIsWicketOpen(true)} className="h-12 md:h-14 font-black text-[10px] uppercase shadow-lg">Wicket</Button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" onClick={() => handleScore(1, 'wide')} className="h-10 border-amber-500/40 text-amber-500 font-black text-[10px] uppercase bg-amber-500/5">Wide</Button>
                <Button variant="outline" onClick={() => setIsNoBallOpen(true)} className="h-10 border-amber-500/40 text-amber-500 font-black text-[10px] uppercase bg-amber-500/5">No Ball</Button>
                <Button variant="outline" onClick={undoLastAction} disabled={history.length === 0} className="h-10 border-white/20 text-white font-black text-[10px] uppercase"><Undo2 className="w-3 h-3 mr-1"/> Undo Ball</Button>
              </div>
            </div>
          ) : (
            <div className="p-6 bg-destructive/10 border-2 border-dashed border-destructive/30 rounded-xl text-center space-y-4 animate-in zoom-in-95">
              <p className="text-lg font-black text-destructive uppercase italic">Dismissed: {activeStriker?.batting.dismissal}</p>
              <div className="max-w-xs mx-auto space-y-2 text-left">
                <Label className="text-[10px] font-black uppercase text-slate-400">Assign Successor</Label>
                <Select value="" onValueChange={handleSelectNextBatter}>
                  <SelectTrigger className="bg-white text-slate-900 font-bold h-12">
                    <SelectValue placeholder="Pick next batter..." />
                  </SelectTrigger>
                  <SelectContent>
                    {players.filter(p => !p.batting.out && p.id !== strikerId).map(p => (
                      <SelectItem key={p.id} value={p.id} className="font-bold">#{p.order} - {p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      </Card>

      <div className="flex gap-2">
        <Button onClick={() => setIsAddPlayerOpen(true)} variant="secondary" className="flex-1 font-black uppercase text-[10px] h-12 shadow-md">
          <UserPlus className="w-4 h-4 mr-2" /> Join Mid-Game
        </Button>
        <Button onClick={() => setGameState('finished')} variant="default" className="flex-1 font-black uppercase text-[10px] h-12 shadow-md bg-emerald-600 hover:bg-emerald-700">
          <CheckCircle2 className="w-4 h-4 mr-2" /> Finalize Session
        </Button>
        <Button onClick={resetGame} variant="outline" size="icon" className="h-12 w-12 text-slate-400 hover:text-destructive">
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-6">
        <Card className="rounded-xl overflow-hidden shadow-sm border bg-white">
          <div className="bg-slate-50 px-4 py-3 border-b flex justify-between items-center">
            <span className="text-[10px] font-black uppercase text-slate-500">Live Player Statistics</span>
            <Badge variant="outline" className="text-[8px] font-black uppercase text-primary border-primary/20">STREET PRO v2.0</Badge>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="text-[9px] font-black uppercase">Participant</TableHead>
                  <TableHead className="text-right text-[9px] font-black uppercase">Runs</TableHead>
                  <TableHead className="text-right text-[9px] font-black uppercase">Balls</TableHead>
                  <TableHead className="text-right text-[9px] font-black uppercase">Wkts</TableHead>
                  <TableHead className="text-right text-[9px] font-black uppercase">Econ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {players.map(p => (
                  <TableRow key={p.id} className={cn(p.id === strikerId ? "bg-primary/5" : "")}>
                    <TableCell className="py-3">
                      <p className="font-black text-xs uppercase">{p.name}{p.id === strikerId ? "*" : ""}</p>
                      <p className={cn("text-[8px] font-bold uppercase italic", p.batting.out ? "text-destructive" : "text-slate-400")}>
                        {p.batting.out ? `OUT (${p.batting.dismissal})` : 'Active'}
                      </p>
                    </TableCell>
                    <TableCell className="text-right font-black">{p.batting.runs}</TableCell>
                    <TableCell className="text-right text-xs">{p.batting.balls}</TableCell>
                    <TableCell className="text-right font-black text-primary">{p.bowling.wickets}</TableCell>
                    <TableCell className="text-right text-[10px] font-bold text-slate-400">
                      {p.bowling.balls > 0 ? (p.bowling.runs / (p.bowling.balls / 6)).toFixed(2) : '0.00'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* Dialogs */}
      <Dialog open={isNoBallOpen} onOpenChange={setIsNoBallOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-md rounded-2xl border-t-8 border-t-amber-500">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tight text-amber-600">No Ball Results</DialogTitle>
            <DialogDescription className="font-bold uppercase text-[10px]">Select runs scored on this illegal delivery</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2 py-4">
            {[0, 1, 2, 4, 6].map(r => (
              <Button key={`nb-${r}`} onClick={() => handleScore(r, 'noball')} variant="outline" className="h-16 font-black text-xl border-amber-200">{r === 0 ? "•" : r}</Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isWicketOpen} onOpenChange={setIsWicketOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-md rounded-2xl border-t-8 border-t-destructive">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tight text-destructive">Register Out</DialogTitle>
            <DialogDescription className="text-xs">Select dismissal mode for {activeStriker?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase text-slate-400">Type</Label>
              <Select value={wicketForm.type} onValueChange={(v) => setWicketForm({...wicketForm, type: v})}>
                <SelectTrigger className="font-bold h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="caught" className="font-bold">Caught</SelectItem>
                  <SelectItem value="bowled" className="font-bold">Bowled</SelectItem>
                  <SelectItem value="runout" className="font-bold">Run Out</SelectItem>
                  <SelectItem value="stumped" className="font-bold">Stumped</SelectItem>
                  <SelectItem value="lbw" className="font-bold">LBW</SelectItem>
                  <SelectItem value="3-Dots Streak" className="font-bold text-destructive">3-Dots Rule</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="destructive" onClick={() => handleWicket(wicketForm.type)} className="w-full h-14 font-black uppercase shadow-xl">Confirm Wicket</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddPlayerOpen} onOpenChange={setIsAddPlayerOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-md rounded-2xl border-t-8 border-t-secondary">
          <DialogHeader><DialogTitle className="font-black uppercase tracking-tight">Add New Participant</DialogTitle></DialogHeader>
          <div className="py-4"><Input value={newPlayerName} onChange={(e) => setNewPlayerName(e.target.value)} placeholder="Player Full Name" className="font-bold h-12" /></div>
          <DialogFooter><Button onClick={() => {
            if (!newPlayerName.trim()) return;
            const newP: Player = {
              id: `p-${players.length}-${Date.now()}`,
              name: newPlayerName,
              order: players.length + 1,
              batting: { runs: 0, balls: 0, fours: 0, sixes: 0, out: false, dismissal: '', fielderId: '', highScore: 0 },
              bowling: { balls: 0, runs: 0, wickets: 0, maidens: 0, bestWickets: 0 }
            };
            setPlayers([...players, newP]);
            setNewPlayerName('');
            setIsAddPlayerOpen(false);
            toast({ title: "Player Joined Session" });
          }} className="w-full h-14 font-black uppercase bg-secondary text-white">Join Game</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
