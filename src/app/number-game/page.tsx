
"use client"

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { History as HistoryIcon, RotateCcw, Play, Circle, Skull, Hash, UserPlus, Undo2, Download, Trash2, ShieldCheck, Zap, Plus, ArrowRight, UserCircle, Trophy, Target, CheckCircle2, ChevronLeft, ListOrdered, Edit2, AlertCircle } from 'lucide-react';
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
    bestRuns: number;
  };
  session: {
    matches: number;
    runs: number;
    wickets: number;
    fours: number;
    sixes: number;
    highScore: number;
    bestBowling: { wkts: number, runs: number };
  };
}

const STORAGE_KEY = 'cricmates_street_pro_session_v4_4';

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

  const [isEditBallOpen, setIsEditBallOpen] = useState(false);
  const [editingBall, setEditingBall] = useState<any>(null);

  useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const d = JSON.parse(saved);
        setGameState(d.gameState || 'setup');
        setPlayers(d.players || []);
        setStrikerId(d.strikerId || '');
        setBowlerId(d.bowlerId || '');
        setHistory(d.history || []);
        setConsecutiveDots(d.consecutiveDots || 0);
        setBallsInOver(d.ballsInOver || 0);
        if (d.players?.length > 0 && d.gameState === 'setup') {
          setPlayerNames(d.players.map((p: any) => p.name));
        }
      } catch (e) {
        console.error("Failed to restore session", e);
      }
    }
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    const sessionData = { gameState, players, strikerId, bowlerId, history, consecutiveDots, ballsInOver };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
  }, [gameState, players, strikerId, bowlerId, history, consecutiveDots, ballsInOver, isMounted]);

  const handleDownloadReport = () => {
    try {
      const dateStr = new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      const report = generateStreetReport(players, dateStr);
      const blob = new Blob([report], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CricMates_StreetPro_Session_${Date.now()}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Session Report Generated" });
    } catch (e) {
      toast({ title: "Export Error", variant: "destructive" });
    }
  };

  const handleHardReset = () => {
    if (typeof window === 'undefined') return;
    const confirmed = window.confirm("PERMANENT ACTION: This will delete ALL session records, league tables, and player data. Are you sure?");
    if (!confirmed) return;

    localStorage.removeItem(STORAGE_KEY);
    setGameState('setup');
    setPlayers([]);
    setHistory([]);
    setPlayerNames(['', '', '']);
    setStrikerId('');
    setBowlerId('');
    setConsecutiveDots(0);
    setBallsInOver(0);
    toast({ title: "Records Purged", description: "The session has been reset to zero." });
  };

  const addSetupField = () => { if (playerNames.length < 15) setPlayerNames([...playerNames, '']); };
  const removeSetupField = (index: number) => { if (playerNames.length > 3) { const n = [...playerNames]; n.splice(index, 1); setPlayerNames(n); } };

  const startGame = () => {
    const validNames = playerNames.filter(n => n.trim() !== '');
    if (validNames.length < 3) {
      toast({ title: "Validation Error", description: "Min 3 players required.", variant: "destructive" });
      return;
    }

    const initialPlayers: Player[] = validNames.map((name, i) => {
      const existing = players.find(p => p.name.toLowerCase() === name.toLowerCase());
      return {
        id: existing?.id || `p-${i}-${Date.now()}`,
        name,
        order: i + 1,
        batting: { runs: 0, balls: 0, fours: 0, sixes: 0, out: false, dismissal: '', fielderId: '', highScore: 0 },
        bowling: { balls: 0, runs: 0, wickets: 0, maidens: 0, bestWickets: 0, bestRuns: 0 },
        session: existing?.session || { matches: 0, runs: 0, wickets: 0, fours: 0, sixes: 0, highScore: 0, bestBowling: { wkts: 0, runs: 0 } }
      };
    });

    setPlayers(initialPlayers);
    setStrikerId(initialPlayers[0].id);
    setBowlerId(initialPlayers[initialPlayers.length - 1].id);
    setGameState('playing');
    setHistory([]);
    setConsecutiveDots(0);
    setBallsInOver(0);
  };

  const finalizeMatch = () => {
    const updatedPlayers = players.map(p => {
      const currentBest = p.session.bestBowling;
      const matchBestW = p.bowling.wickets;
      const matchBestR = p.bowling.runs;
      
      let finalBest = currentBest;
      if (matchBestW > currentBest.wkts || (matchBestW === currentBest.wkts && matchBestR < currentBest.runs && p.bowling.balls > 0)) {
        finalBest = { wkts: matchBestW, runs: matchBestR };
      }

      return {
        ...p,
        session: {
          ...p.session,
          matches: p.session.matches + 1,
          runs: p.session.runs + p.batting.runs,
          wickets: p.session.wickets + p.bowling.wickets,
          fours: p.session.fours + p.batting.fours,
          sixes: p.session.sixes + p.batting.sixes,
          highScore: Math.max(p.session.highScore, p.batting.runs),
          bestBowling: finalBest
        }
      };
    });
    setPlayers(updatedPlayers);
    setGameState('finished');
    toast({ title: "Match Finalized", description: "Records synced to league table." });
  };

  const resetForNextMatch = () => {
    setGameState('setup');
    const sorted = [...players].sort((a, b) => b.session.runs - a.session.runs);
    setPlayerNames(sorted.length > 0 ? sorted.map(p => p.name) : ['', '', '']);
    setHistory([]);
    setStrikerId('');
    setBowlerId('');
    setConsecutiveDots(0);
    setBallsInOver(0);
    toast({ title: "Scoreboard Reset", description: "Lineup ready for next match." });
  };

  const handleScore = (runs: number, extra: 'none' | 'wide' | 'noball' = 'none') => {
    const ballId = Date.now();
    const ballRecord = { id: ballId, strikerId, bowlerId, runs, extra, isWicket: false, prevDots: consecutiveDots, prevBalls: ballsInOver };
    setHistory([ballRecord, ...history]);

    setPlayers(prev => prev.map(p => {
      if (p.id === strikerId) {
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
          }
        };
      }
      if (p.id === bowlerId) {
        return { ...p, bowling: { ...p.bowling, runs: p.bowling.runs + runs + (extra !== 'none' ? 1 : 0), balls: p.bowling.balls + (extra === 'none' ? 1 : 0) } };
      }
      return p;
    }));

    if (extra !== 'none') setConsecutiveDots(0);
    else if (runs === 0) {
      const nextDots = consecutiveDots + 1;
      setConsecutiveDots(nextDots);
      if (nextDots === 3) handleWicket('3-Dots Streak');
    } else setConsecutiveDots(0);

    if (extra === 'none') {
      const nextBalls = ballsInOver + 1;
      if (nextBalls === 6) {
        const idx = players.findIndex(p => p.id === bowlerId);
        let nIdx = (idx - 1 + players.length) % players.length;
        if (players[nIdx].id === strikerId) nIdx = (nIdx - 1 + players.length) % players.length;
        setBowlerId(players[nIdx].id);
        setBallsInOver(0);
      } else setBallsInOver(nextBalls);
    }
    setIsNoBallOpen(false);
  };

  const handleWicket = (type: string) => {
    const ballId = Date.now();
    const ballRecord = { id: ballId, strikerId, bowlerId, runs: 0, extra: 'none', isWicket: true, wicketType: type, prevDots: consecutiveDots, prevBalls: ballsInOver };
    setHistory([ballRecord, ...history]);

    setPlayers(prev => prev.map(p => {
      if (p.id === strikerId) return { ...p, batting: { ...p.batting, out: true, dismissal: type, balls: p.batting.balls + (type === '3-Dots Streak' ? 0 : 1) } };
      if (p.id === bowlerId) {
        const isBowlerWkt = !['runout', '3-Dots Streak', 'retired'].includes(type);
        return { ...p, bowling: { ...p.bowling, wickets: p.bowling.wickets + (isBowlerWkt ? 1 : 0), balls: p.bowling.balls + (['runout', '3-Dots Streak', 'retired'].includes(type) ? 0 : 1) } };
      }
      return p;
    }));

    setConsecutiveDots(0);
    setIsWicketOpen(false);
    toast({ title: `OUT: ${type.toUpperCase()}`, variant: "destructive" });
  };

  const deleteBall = (ballId: number) => {
    const ball = history.find(b => b.id === ballId);
    if (!ball) return;

    setPlayers(prev => prev.map(p => {
      if (p.id === ball.strikerId) {
        return {
          ...p,
          batting: {
            ...p.batting,
            runs: p.batting.runs - (ball.extra === 'wide' ? 0 : ball.runs),
            balls: Math.max(0, p.batting.balls - (ball.extra === 'none' && ball.wicketType !== '3-Dots Streak' ? 1 : 0)),
            fours: p.batting.fours - (ball.runs === 4 && ball.extra !== 'wide' ? 1 : 0),
            sixes: p.batting.sixes - (ball.runs === 6 && ball.extra !== 'wide' ? 1 : 0),
            out: false,
            dismissal: ''
          }
        };
      }
      if (p.id === ball.bowlerId) {
        const isBowlerWkt = ball.isWicket && !['runout', '3-Dots Streak', 'retired'].includes(ball.wicketType || '');
        return {
          ...p,
          bowling: {
            ...p.bowling,
            runs: Math.max(0, p.bowling.runs - ball.runs - (ball.extra !== 'none' ? 1 : 0)),
            balls: Math.max(0, p.bowling.balls - (ball.extra === 'none' ? 1 : 0)),
            wickets: Math.max(0, p.bowling.wickets - (isBowlerWkt ? 1 : 0))
          }
        };
      }
      return p;
    }));

    setHistory(history.filter(b => b.id !== ballId));
    setConsecutiveDots(ball.prevDots);
    setBallsInOver(ball.prevBalls);
    setStrikerId(ball.strikerId);
    setBowlerId(ball.bowlerId);
    toast({ title: "Record Deleted" });
  };

  const applyBallEdit = () => {
    if (!editingBall) return;
    const oldId = editingBall.id;
    deleteBall(oldId);
    handleScore(editingBall.runs, editingBall.extra);
    setIsEditBallOpen(false);
    setEditingBall(null);
    toast({ title: "Record Corrected" });
  };

  const handleMidGameAdd = () => {
    if (!newPlayerName.trim()) return;
    const newP: Player = {
      id: `p-${players.length}-${Date.now()}`,
      name: newPlayerName,
      order: players.length + 1,
      batting: { runs: 0, balls: 0, fours: 0, sixes: 0, out: false, dismissal: '', fielderId: '', highScore: 0 },
      bowling: { balls: 0, runs: 0, wickets: 0, maidens: 0, bestWickets: 0, bestRuns: 0 },
      session: { matches: 0, runs: 0, wickets: 0, fours: 0, sixes: 0, highScore: 0, bestBowling: { wkts: 0, runs: 0 } }
    };
    setPlayers(prev => [...prev, newP]);
    setNewPlayerName('');
    setIsAddPlayerOpen(false);
    toast({ title: "Player Joined League" });
  };

  const sortedLeague = useMemo(() => {
    return [...players].sort((a,b) => b.session.runs - a.session.runs || b.session.wickets - a.session.wickets);
  }, [players]);

  if (!isMounted) return null;

  if (gameState === 'setup') {
    return (
      <div className="max-w-md mx-auto space-y-6 py-8 px-4 animate-in fade-in slide-in-from-bottom-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/')} className="rounded-full"><ChevronLeft className="w-6 h-6" /></Button>
          <h1 className="text-xl font-black uppercase tracking-widest text-slate-900">Street Session</h1>
        </div>
        <Tabs defaultValue="registry" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-12 bg-slate-100 p-1 rounded-xl mb-6">
            <TabsTrigger value="registry" className="font-black text-[10px] uppercase">Registry</TabsTrigger>
            <TabsTrigger value="league" className="font-black text-[10px] uppercase">League Table</TabsTrigger>
          </TabsList>
          
          <TabsContent value="registry" className="space-y-6">
            <div className="text-center space-y-2">
              <div className="bg-primary w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg rotate-3">
                <Hash className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900">Street Pro Setup</h1>
              <p className="text-slate-500 text-sm font-medium italic">Persistent Casual Scoring</p>
            </div>
            
            <Card className="border-t-8 border-t-primary shadow-xl">
              <CardHeader><CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">Lineup Registry</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {playerNames.map((name, i) => (
                  <div key={i} className="flex gap-2">
                    <div className="flex-1 relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">#{i + 1}</span>
                      <Input value={name} onChange={(e) => { const n = [...playerNames]; n[i] = e.target.value; setPlayerNames(n); }} placeholder={`Player Name`} className="pl-10 font-bold h-12 shadow-sm" />
                    </div>
                    {playerNames.length > 3 && (
                      <Button variant="ghost" size="icon" onClick={() => removeSetupField(i)} className="h-12 w-12 text-slate-300 hover:text-destructive shrink-0"><Trash2 className="w-4 h-4" /></Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" onClick={addSetupField} className="w-full border-dashed border-2 h-12 text-[10px] font-black uppercase tracking-widest text-slate-400"><Plus className="w-4 h-4 mr-2" /> Add Participant</Button>
                <Button onClick={startGame} className="w-full h-14 font-black uppercase tracking-widest text-lg shadow-xl group mt-4">START MATCH <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" /></Button>
                
                {players.length > 0 && (
                  <div className="pt-4 border-t">
                    <Button variant="ghost" onClick={handleHardReset} className="w-full text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-destructive flex items-center justify-center gap-2">
                      <AlertCircle className="w-3 h-3" /> Clear All Session Records
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="league">
            <Card className="border-none shadow-xl overflow-hidden bg-white">
              <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
                <div className="flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-500" /><span className="text-[10px] font-black uppercase tracking-[0.2em]">Casual League Table</span></div>
                <Badge variant="outline" className="text-[8px] font-black border-white/20 text-white uppercase">Season Standings</Badge>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50"><TableRow><TableHead className="text-[9px] font-black uppercase">Participant</TableHead><TableHead className="text-right text-[9px] font-black uppercase">P</TableHead><TableHead className="text-right text-[9px] font-black uppercase">R</TableHead><TableHead className="text-right text-[9px] font-black uppercase">W</TableHead><TableHead className="text-right text-[9px] font-black uppercase">B.B.</TableHead><TableHead className="text-right text-[9px] font-black uppercase">HS</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {sortedLeague.length > 0 ? sortedLeague.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-black text-xs uppercase text-slate-900">{p.name}</TableCell>
                        <TableCell className="text-right font-bold text-xs">{p.session.matches}</TableCell>
                        <TableCell className="text-right font-black text-primary">{p.session.runs}</TableCell>
                        <TableCell className="text-right font-black text-secondary">{p.session.wickets}</TableCell>
                        <TableCell className="text-right text-[10px] font-black text-emerald-600">{p.session.bestBowling.wkts}/{p.session.bestBowling.runs}</TableCell>
                        <TableCell className="text-right text-[10px] font-bold text-slate-400">{p.session.highScore}</TableCell>
                      </TableRow>
                    )) : <TableRow><TableCell colSpan={6} className="text-center py-12 text-[10px] font-black uppercase text-slate-300">No records found</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </Card>
            {players.length > 0 && (
              <Button variant="ghost" onClick={handleHardReset} className="w-full mt-6 h-12 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-destructive border border-dashed hover:border-destructive/20 rounded-2xl transition-all">
                <Trash2 className="w-4 h-4 mr-2" /> Reset League Data
              </Button>
            )}
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  if (gameState === 'finished') {
    return (
      <div className="max-w-4xl mx-auto space-y-8 py-12 px-4 text-center">
        <div className="flex justify-start mb-4"><Button variant="ghost" size="icon" onClick={() => setGameState('setup')} className="rounded-full h-10 w-10"><ChevronLeft className="w-6 h-6" /></Button></div>
        <div className="bg-emerald-500 w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-xl mb-4"><Trophy className="w-10 h-10 text-white" /></div>
        <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-900">Game Over</h1>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mb-8">Match records finalized</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg mx-auto">
          <Button onClick={handleDownloadReport} className="h-16 font-black uppercase tracking-widest text-lg shadow-xl bg-secondary hover:bg-secondary/90 text-white"><Download className="w-6 h-6 mr-2" /> Download Report</Button>
          <Button onClick={resetForNextMatch} variant="outline" className="h-16 font-black uppercase tracking-widest text-lg border-2 border-primary text-primary"><RotateCcw className="w-6 h-6 mr-2" /> Start Next Match</Button>
        </div>
        <div className="mt-12 space-y-6">
          <h2 className="text-xl font-black uppercase tracking-widest text-slate-900 flex items-center justify-center gap-2"><ListOrdered className="w-5 h-5 text-primary" /> Session Rankings</h2>
          <Card className="border-none shadow-xl overflow-hidden bg-white text-left">
            <Table>
              <TableHeader className="bg-slate-50"><TableRow><TableHead className="text-[9px] font-black uppercase">Player</TableHead><TableHead className="text-right text-[9px] font-black uppercase">Runs</TableHead><TableHead className="text-right text-[9px] font-black uppercase">Wkts</TableHead><TableHead className="text-right text-[9px] font-black uppercase">B.B.</TableHead></TableRow></TableHeader>
              <TableBody>
                {sortedLeague.map(p => (
                  <TableRow key={p.id}><TableCell className="font-black text-xs uppercase">{p.name}</TableCell><TableCell className="text-right font-black text-primary">{p.session.runs}</TableCell><TableCell className="text-right font-black text-secondary">{p.session.wickets}</TableCell><TableCell className="text-right text-[10px] font-black text-emerald-600">{p.session.bestBowling.wkts}/{p.session.bestBowling.runs}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      </div>
    );
  }

  const activeStriker = players.find(p => p.id === strikerId);
  const activeBowler = players.find(p => p.id === bowlerId);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 px-1 md:px-4">
      <div className="flex items-center gap-4 mb-2">
        <Button variant="ghost" size="icon" onClick={() => { if(confirm("Discard match?")) setGameState('setup'); }} className="text-slate-400 hover:bg-slate-100 rounded-full"><ChevronLeft className="w-6 h-6" /></Button>
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Live Street Pro v4.4</span>
      </div>
      
      <Tabs defaultValue="scoring" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-12 bg-slate-100 p-1 rounded-xl mb-6 shadow-sm">
          <TabsTrigger value="scoring" className="font-black text-[10px] uppercase">Live</TabsTrigger>
          <TabsTrigger value="history" className="font-black text-[10px] uppercase">Edits</TabsTrigger>
          <TabsTrigger value="league" className="font-black text-[10px] uppercase">League</TabsTrigger>
        </TabsList>
        
        <TabsContent value="scoring" className="space-y-6 animate-in fade-in">
          <Card className={cn("border-none shadow-2xl transition-all overflow-hidden", activeStriker?.batting.out ? "ring-4 ring-destructive" : "ring-4 ring-primary")}>
            <div className="bg-slate-900 text-white p-6 md:p-8 space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                <div className="space-y-1"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2"><UserCircle className="w-3 h-3"/> Active Striker</p><h2 className="text-3xl font-black uppercase tracking-tighter leading-tight truncate max-w-[250px]">{activeStriker?.name}</h2><div className="flex gap-4"><span className="text-xl font-bold">{activeStriker?.batting.runs} <span className="text-xs opacity-50 font-medium uppercase">Runs</span></span><span className="text-xl font-bold">{activeStriker?.batting.balls} <span className="text-xs opacity-50 font-medium uppercase">Balls</span></span></div></div>
                <div className="text-left md:text-right space-y-1"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary flex items-center md:justify-end gap-2"><Zap className="w-3 h-3"/> Active Bowler</p><h2 className="text-xl font-black uppercase tracking-tighter text-slate-300 truncate max-w-[200px]">{activeBowler?.name}</h2><p className="text-[10px] font-bold text-slate-500 uppercase">Over Progress: {ballsInOver}/6 Legal</p></div>
              </div>
              <div className="flex items-center gap-2 bg-white/5 p-3 rounded-lg border border-white/10 w-fit">{[...Array(3)].map((_, i) => (<div key={i} className={cn("w-4 h-4 rounded-full border-2", i < consecutiveDots ? "bg-red-500 border-red-600 animate-pulse shadow-[0_0_10px_#ef4444]" : "border-slate-700")} />))}<span className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-2">3-Dots Streak</span></div>
              {!activeStriker?.batting.out ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">{[0, 1, 2, 3, 4, 6].map(r => (<Button key={r} onClick={() => handleScore(r)} className={cn("h-12 md:h-14 font-black text-lg bg-white/5 border border-white/10 hover:bg-primary transition-all", r >= 4 ? "text-primary border-primary/40" : "text-white")}>{r === 0 ? "•" : r}</Button>))}<Button variant="destructive" onClick={() => setIsWicketOpen(true)} className="h-12 md:h-14 font-black text-[10px] uppercase shadow-lg">Wicket</Button></div>
                  <div className="grid grid-cols-3 gap-2"><Button variant="outline" onClick={() => handleScore(1, 'wide')} className="h-10 border-amber-500/40 text-amber-500 font-black text-[10px] uppercase bg-amber-500/5">Wide</Button><Button variant="outline" onClick={() => setIsNoBallOpen(true)} className="h-10 border-amber-500/40 text-amber-500 font-black text-[10px] uppercase bg-amber-500/5">No Ball</Button><Button variant="outline" onClick={() => { if(history.length > 0) deleteBall(history[0].id); }} className="h-10 border-white/20 text-white font-black text-[10px] uppercase"><Undo2 className="w-3 h-3 mr-1"/> Undo</Button></div>
                </div>
              ) : (
                <div className="p-6 bg-destructive/10 border-2 border-dashed border-destructive/30 rounded-xl text-center space-y-4 animate-in zoom-in-95"><p className="text-lg font-black text-destructive uppercase italic">Dismissed: {activeStriker?.batting.dismissal}</p><div className="max-w-xs mx-auto space-y-2 text-left"><Label className="text-[10px] font-black uppercase text-slate-400">Assign Successor</Label><Select value="" onValueChange={(v) => { if (v === bowlerId) { const idx = players.findIndex(p => p.id === bowlerId); let nIdx = (idx - 1 + players.length) % players.length; if (players[nIdx].id === v) nIdx = (nIdx - 1 + players.length) % players.length; setBowlerId(players[nIdx].id); } setStrikerId(v); }}><SelectTrigger className="bg-white text-slate-900 font-bold h-12"><SelectValue placeholder="Pick next batter..." /></SelectTrigger><SelectContent className="z-[200]">{players.filter(p => !p.batting.out && p.id !== strikerId).map(p => (<SelectItem key={p.id} value={p.id} className="font-bold">#{p.order} - {p.name}</SelectItem>))}</SelectContent></Select></div></div>
              )}
            </div>
          </Card>
          <div className="flex gap-2"><Button onClick={() => setIsAddPlayerOpen(true)} variant="secondary" className="flex-1 font-black uppercase text-[10px] h-12 shadow-md"><UserPlus className="w-4 h-4 mr-2" /> Mid-Game Add</Button><Button onClick={finalizeMatch} variant="default" className="flex-1 font-black uppercase text-[10px] h-12 shadow-md bg-emerald-600 hover:bg-emerald-700"><CheckCircle2 className="w-4 h-4 mr-2" /> Finalize Match</Button></div>
          <Card className="rounded-xl overflow-hidden shadow-sm border bg-white"><div className="bg-slate-50 px-4 py-3 border-b flex justify-between items-center"><span className="text-[10px] font-black uppercase text-slate-500">Current Match Statistics</span><Badge variant="outline" className="text-[8px] font-black uppercase text-primary border-primary/20">LIVE STATS</Badge></div><div className="overflow-x-auto"><Table><TableHeader className="bg-slate-50/50"><TableRow><TableHead className="text-[9px] font-black uppercase">Participant</TableHead><TableHead className="text-right text-[9px] font-black uppercase">Runs</TableHead><TableHead className="text-right text-[9px] font-black uppercase">Balls</TableHead><TableHead className="text-right text-[9px] font-black uppercase">Wkts</TableHead><TableHead className="text-right text-[9px] font-black uppercase">ER</TableHead></TableRow></TableHeader><TableBody>{players.map(p => (<TableRow key={p.id} className={cn(p.id === strikerId ? "bg-primary/5" : "")}><TableCell className="py-3"><p className="font-black text-xs uppercase">{p.name}{p.id === strikerId ? "*" : ""}</p><p className={cn("text-[8px] font-bold uppercase italic", p.batting.out ? "text-destructive" : "text-slate-400")}>{p.batting.out ? `OUT (${p.batting.dismissal})` : 'Active'}</p></TableCell><TableCell className="text-right font-black">{p.batting.runs}</TableCell><TableCell className="text-right text-xs">{p.batting.balls}</TableCell><TableCell className="text-right font-black text-primary">{p.bowling.wickets}</TableCell><TableCell className="text-right text-[10px] font-bold text-slate-400">{p.bowling.balls > 0 ? (p.bowling.runs / (p.bowling.balls / 6)).toFixed(2) : '0.00'}</TableCell></TableRow>))}</TableBody></Table></div></Card>
        </TabsContent>
        
        <TabsContent value="history" className="space-y-4">
          <h2 className="text-lg font-black uppercase px-2 flex items-center gap-2"><HistoryIcon className="w-5 h-5 text-primary" /> Official History Logs</h2>
          <div className="space-y-2">{history.length > 0 ? history.map((b) => (
            <Card key={b.id} className="p-3 border shadow-sm flex items-center justify-between rounded-xl group hover:border-primary/30 transition-all">
              <div className="flex items-center gap-4">
                <div className={cn("w-10 h-10 rounded-full flex items-center justify-center font-black text-sm border shadow-inner", b.isWicket ? "bg-red-500 text-white" : "bg-slate-50")}>{b.isWicket ? "W" : b.runs}</div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase truncate">{players.find(p => p.id === b.strikerId)?.name} vs {players.find(p => p.id === b.bowlerId)?.name}</p>
                  <p className={cn("text-[8px] font-bold uppercase", b.isWicket ? "text-red-500" : "text-slate-400")}>{b.isWicket ? b.wicketType : (b.extra !== 'none' ? b.extra : `${b.runs} runs`)}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => { setEditingBall(b); setIsEditBallOpen(true); }} className="h-8 w-8 text-slate-300 hover:text-primary"><Edit2 className="w-3 h-3"/></Button>
                <Button variant="ghost" size="icon" onClick={() => { if(confirm("Purge record?")) deleteBall(b.id); }} className="h-8 w-8 text-slate-300 hover:text-destructive"><Trash2 className="w-4 h-4"/></Button>
              </div>
            </Card>
          )) : <div className="py-20 text-center text-[10px] font-black uppercase text-slate-300 border-2 border-dashed rounded-3xl">Awaiting first delivery</div>}</div>
        </TabsContent>
        
        <TabsContent value="league">
          <Card className="border-none shadow-xl overflow-hidden bg-white">
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
              <div className="flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-500" /><span className="text-[10px] font-black uppercase tracking-[0.2em]">Casual League Table</span></div>
              <Badge variant="outline" className="text-[8px] font-black border-white/20 text-white uppercase">Season Standings</Badge>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50"><TableRow><TableHead className="text-[9px] font-black uppercase">Participant</TableHead><TableHead className="text-right text-[9px] font-black uppercase">P</TableHead><TableHead className="text-right text-[9px] font-black uppercase">R</TableHead><TableHead className="text-right text-[9px] font-black uppercase">W</TableHead><TableHead className="text-right text-[9px] font-black uppercase">B.B.</TableHead><TableHead className="text-right text-[9px] font-black uppercase">HS</TableHead></TableRow></TableHeader>
                <TableBody>
                  {sortedLeague.length > 0 ? sortedLeague.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-black text-xs uppercase text-slate-900">{p.name}</TableCell>
                      <TableCell className="text-right font-bold text-xs">{p.session.matches}</TableCell>
                      <TableCell className="text-right font-black text-primary">{p.session.runs}</TableCell>
                      <TableCell className="text-right font-black text-secondary">{p.session.wickets}</TableCell>
                      <TableCell className="text-right text-[10px] font-black text-emerald-600">{p.session.bestBowling.wkts}/{p.session.bestBowling.runs}</TableCell>
                      <TableCell className="text-right text-[10px] font-bold text-slate-400">{p.session.highScore}</TableCell>
                    </TableRow>
                  )) : <TableRow><TableCell colSpan={6} className="text-center py-12 text-[10px] font-black uppercase text-slate-300">No session data</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </Card>
          {players.length > 0 && (
            <Button variant="ghost" onClick={handleHardReset} className="w-full mt-6 h-12 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-destructive border border-dashed hover:border-destructive/20 rounded-2xl transition-all">
              <Trash2 className="w-4 h-4 mr-2" /> Reset League Data
            </Button>
          )}
        </TabsContent>
      </Tabs>
      
      <Dialog open={isEditBallOpen} onOpenChange={setIsEditBallOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-md rounded-2xl border-t-8 border-t-primary z-[200]">
          <DialogHeader><DialogTitle className="font-black uppercase tracking-tight">Manual Adjustment</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400">Runs Scored</Label>
              <Select value={editingBall?.runs?.toString()} onValueChange={(v) => setEditingBall((prev: any) => ({...prev, runs: parseInt(v)}))}>
                <SelectTrigger className="font-bold h-12"><SelectValue /></SelectTrigger>
                <SelectContent className="z-[250]">{[0,1,2,3,4,6].map(r => <SelectItem key={r} value={r.toString()}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-400">Extra Type</Label>
              <Select value={editingBall?.extra} onValueChange={(v) => setEditingBall((prev: any) => ({...prev, extra: v}))}>
                <SelectTrigger className="font-bold h-12"><SelectValue /></SelectTrigger>
                <SelectContent className="z-[250]"><SelectItem value="none">None</SelectItem><SelectItem value="wide">Wide</SelectItem><SelectItem value="noball">No Ball</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={applyBallEdit} className="w-full h-14 font-black uppercase bg-primary text-white shadow-lg">Apply Changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isNoBallOpen} onOpenChange={setIsNoBallOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-md rounded-2xl border-t-8 border-t-amber-500 z-[200]">
          <DialogHeader><DialogTitle className="font-black uppercase tracking-tight text-amber-600">No Ball Results</DialogTitle></DialogHeader>
          <div className="grid grid-cols-3 gap-2 py-4">
            {[0, 1, 2, 4, 6].map(r => (
              <Button key={`nb-${r}`} onClick={() => handleScore(r, 'noball')} variant="outline" className="h-16 font-black text-xl border-amber-200">{r === 0 ? "•" : r}</Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isWicketOpen} onOpenChange={setIsWicketOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-md rounded-2xl border-t-8 border-t-destructive z-[200]">
          <DialogHeader><DialogTitle className="font-black uppercase tracking-tight text-destructive">Register Out</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase text-slate-400">Type</Label>
              <Select value={wicketForm.type} onValueChange={(v) => setWicketForm(prev => ({...prev, type: v}))}>
                <SelectTrigger className="font-bold h-12"><SelectValue /></SelectTrigger>
                <SelectContent className="z-[250]">
                  <SelectItem value="caught" className="font-bold">Caught</SelectItem>
                  <SelectItem value="bowled" className="font-bold">Bowled</SelectItem>
                  <SelectItem value="runout" className="font-bold">Run Out</SelectItem>
                  <SelectItem value="stumped" className="font-bold">Stumped</SelectItem>
                  <SelectItem value="3-Dots Streak" className="font-bold text-destructive">3-Dots Streak</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button variant="destructive" onClick={() => handleWicket(wicketForm.type)} className="w-full h-14 font-black uppercase shadow-xl">Confirm Out</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddPlayerOpen} onOpenChange={setIsAddPlayerOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-md rounded-2xl border-t-8 border-t-secondary z-[200]">
          <DialogHeader><DialogTitle className="font-black uppercase tracking-tight">Add Mid-Game Player</DialogTitle></DialogHeader>
          <div className="py-4">
            <Input value={newPlayerName} onChange={(e) => setNewPlayerName(e.target.value)} placeholder="Player Full Name" className="font-bold h-12" />
          </div>
          <DialogFooter>
            <Button onClick={handleMidGameAdd} disabled={!newPlayerName.trim()} className="w-full h-14 font-black uppercase bg-secondary text-white shadow-lg">Join Session</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
