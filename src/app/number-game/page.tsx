
"use client"

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { History as HistoryIcon, RotateCcw, Play, Circle, Skull, Hash, UserPlus, Undo2, Download, Trash2, ShieldCheck, Zap } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Player {
  id: string;
  name: string;
  batting: {
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    out: boolean;
    dismissal: string;
    fielderId: string;
  };
  bowling: {
    balls: number;
    runs: number;
    wickets: number;
    maidens: number;
  };
}

export default function NumberGame() {
  const [gameState, setGameState] = useState<'setup' | 'playing' | 'finished'>('setup');
  const [playerNames, setPlayerNames] = useState<string[]>(['', '', '']);
  const [players, setPlayers] = useState<Player[]>([]);
  const [strikerId, setStrikerId] = useState<string>('');
  const [bowlerId, setBowlerId] = useState<string>('');
  const [history, setHistory] = useState<any[]>([]);
  const [consecutiveDots, setConsecutiveDots] = useState(0);
  const [ballsInOver, setBallsInOver] = useState(0);
  const [isWicketOpen, setIsWicketOpen] = useState(false);
  const [wicketForm, setWicketForm] = useState({ type: 'caught', fielderId: 'none' });
  const [isAddPlayerOpen, setIsAddPlayerOpen] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');

  // Setup Handlers
  const addSetupField = () => {
    if (playerNames.length < 10) setPlayerNames([...playerNames, '']);
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
      toast({ title: "Min 3 players required", variant: "destructive" });
      return;
    }

    const initialPlayers: Player[] = validNames.map((name, i) => ({
      id: `p-${i}-${Date.now()}`,
      name,
      batting: { runs: 0, balls: 0, fours: 0, sixes: 0, out: false, dismissal: '', fielderId: '' },
      bowling: { balls: 0, runs: 0, wickets: 0, maidens: 0 }
    }));

    setPlayers(initialPlayers);
    setStrikerId(initialPlayers[0].id);
    setBowlerId(initialPlayers[initialPlayers.length - 1].id);
    setGameState('playing');
  };

  const addMidMatchPlayer = () => {
    if (!newPlayerName.trim()) return;
    const newP: Player = {
      id: `p-${players.length}-${Date.now()}`,
      name: newPlayerName,
      batting: { runs: 0, balls: 0, fours: 0, sixes: 0, out: false, dismissal: '', fielderId: '' },
      bowling: { balls: 0, runs: 0, wickets: 0, maidens: 0 }
    };
    setPlayers([...players, newP]);
    setNewPlayerName('');
    setIsAddPlayerOpen(false);
    toast({ title: "Player Added to Squad" });
  };

  // Rotation logic
  const rotateBowler = (currentId: string) => {
    const index = players.findIndex(p => p.id === currentId);
    let nextIndex = index - 1;
    if (nextIndex < 0) nextIndex = players.length - 1;
    setBowlerId(players[nextIndex].id);
    setBallsInOver(0);
    toast({ title: `Over Changed! New Bowler: ${players[nextIndex].name}` });
  };

  const handleScore = (runs: number, extra: 'none' | 'wide' | 'noball' = 'none') => {
    const newHistory = {
      strikerId,
      bowlerId,
      runs,
      extra,
      isWicket: false,
      prevDots: consecutiveDots,
      prevBalls: ballsInOver
    };

    setHistory([newHistory, ...history].slice(0, 20));

    setPlayers(prev => prev.map(p => {
      if (p.id === strikerId && extra === 'none') {
        return {
          ...p,
          batting: {
            ...p.batting,
            runs: p.batting.runs + runs,
            balls: p.batting.balls + 1,
            fours: p.batting.fours + (runs === 4 ? 1 : 0),
            sixes: p.batting.sixes + (runs === 6 ? 1 : 0)
          }
        };
      }
      if (p.id === strikerId && extra === 'noball') {
        return {
          ...p,
          batting: {
            ...p.batting,
            runs: p.batting.runs + runs,
            balls: p.batting.balls + 1,
            fours: p.batting.fours + (runs === 4 ? 1 : 0),
            sixes: p.batting.sixes + (runs === 6 ? 1 : 0)
          }
        };
      }
      if (p.id === bowlerId) {
        const extraRun = (extra === 'wide' || extra === 'noball') ? 1 : 0;
        return {
          ...p,
          bowling: {
            ...p.bowling,
            runs: p.bowling.runs + runs + extraRun,
            balls: p.bowling.balls + (extra === 'none' ? 1 : 0)
          }
        };
      }
      return p;
    }));

    // Dot logic
    if (extra !== 'none') {
      setConsecutiveDots(0);
    } else if (runs === 0) {
      const nextDots = consecutiveDots + 1;
      setConsecutiveDots(nextDots);
      if (nextDots === 3) {
        handleWicket('3-Dots');
      }
    } else {
      setConsecutiveDots(0);
    }

    // Over logic
    if (extra === 'none') {
      const nextBalls = ballsInOver + 1;
      if (nextBalls === 6) {
        rotateBowler(bowlerId);
      } else {
        setBallsInOver(nextBalls);
      }
    }
  };

  const handleWicket = (type: string, fielderId: string = 'none') => {
    setPlayers(prev => prev.map(p => {
      if (p.id === strikerId) {
        return {
          ...p,
          batting: { ...p.batting, out: true, dismissal: type, fielderId, balls: p.batting.balls + (type === '3-Dots' ? 0 : 1) }
        };
      }
      if (p.id === bowlerId) {
        return {
          ...p,
          bowling: { 
            ...p.bowling, 
            wickets: p.bowling.wickets + (type !== 'runout' ? 1 : 0),
            balls: p.bowling.balls + (['runout', '3-Dots'].includes(type) ? 0 : 1)
          }
        };
      }
      return p;
    }));

    setConsecutiveDots(0);
    setIsWicketOpen(false);
    toast({ title: "OUT!", variant: "destructive" });
  };

  const undoLastAction = () => {
    if (history.length === 0) return;
    const last = history[0];
    setHistory(history.slice(1));
    
    setPlayers(prev => prev.map(p => {
      if (p.id === last.strikerId) {
        const wasWicket = last.isWicket;
        return {
          ...p,
          batting: {
            ...p.batting,
            runs: p.batting.runs - (last.extra === 'none' || last.extra === 'noball' ? last.runs : 0),
            balls: Math.max(0, p.batting.balls - (last.extra === 'none' ? 1 : 0)),
            fours: p.batting.fours - (last.runs === 4 ? 1 : 0),
            sixes: p.batting.sixes - (last.runs === 6 ? 1 : 0),
            out: false,
            dismissal: ''
          }
        };
      }
      if (p.id === last.bowlerId) {
        const extraRun = (last.extra === 'wide' || last.extra === 'noball') ? 1 : 0;
        return {
          ...p,
          bowling: {
            ...p.bowling,
            runs: p.bowling.runs - (last.runs + extraRun),
            balls: Math.max(0, p.bowling.balls - (last.extra === 'none' ? 1 : 0)),
            wickets: p.bowling.wickets - (last.isWicket ? 1 : 0)
          }
        };
      }
      return p;
    }));

    setConsecutiveDots(last.prevDots);
    setBallsInOver(last.prevBalls);
  };

  const downloadReport = () => {
    const report = `
      <html>
        <body style="font-family: sans-serif; padding: 20px;">
          <h1>Street Pro Match Report</h1>
          <hr/>
          <h2>Batting</h2>
          <table border="1" style="width:100%; border-collapse: collapse;">
            <thead><tr><th>Player</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th><th>Status</th></tr></thead>
            <tbody>
              ${players.map(p => `
                <tr>
                  <td>${p.name}</td>
                  <td>${p.batting.runs}</td>
                  <td>${p.batting.balls}</td>
                  <td>${p.batting.fours}</td>
                  <td>${p.batting.sixes}</td>
                  <td>${p.batting.balls > 0 ? ((p.batting.runs / p.batting.balls) * 100).toFixed(1) : '0.0'}</td>
                  <td>${p.batting.out ? `OUT (${p.batting.dismissal})` : 'Not Out'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <h2>Bowling</h2>
          <table border="1" style="width:100%; border-collapse: collapse; margin-top: 20px;">
            <thead><tr><th>Player</th><th>O</th><th>R</th><th>W</th><th>Econ</th></tr></thead>
            <tbody>
              ${players.map(p => `
                <tr>
                  <td>${p.name}</td>
                  <td>${Math.floor(p.bowling.balls / 6)}.${p.bowling.balls % 6}</td>
                  <td>${p.bowling.runs}</td>
                  <td>${p.bowling.wickets}</td>
                  <td>${p.bowling.balls > 0 ? (p.bowling.runs / (p.bowling.balls / 6)).toFixed(2) : '0.00'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    const blob = new Blob([report], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NumberGame_Report.html`;
    a.click();
  };

  if (gameState === 'setup') {
    return (
      <div className="max-w-md mx-auto space-y-6 py-8">
        <div className="text-center space-y-2">
          <div className="bg-primary w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg rotate-3">
            <Hash className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900">Street Pro Setup</h1>
          <p className="text-slate-500 text-sm font-medium italic">Casual Game, Professional Logic</p>
        </div>

        <Card className="border-t-8 border-t-primary shadow-xl">
          <CardHeader>
            <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400">Squad Registration (3-10 Players)</CardTitle>
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
                    placeholder={`Player ${i + 1} Name`}
                    className="pl-10 font-bold h-12"
                  />
                </div>
                {playerNames.length > 3 && (
                  <Button variant="ghost" size="icon" onClick={() => removeSetupField(i)} className="h-12 w-12 text-slate-300 hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
            
            {playerNames.length < 10 && (
              <Button variant="outline" onClick={addSetupField} className="w-full border-dashed border-2 h-12 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <Plus className="w-4 h-4 mr-2" /> Add Next Player
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

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 px-1 md:px-4">
      {/* Live Scorer Header */}
      <Card className={cn("border-t-8 shadow-2xl transition-all", activeStriker?.batting.out ? "border-t-destructive" : "border-t-primary")}>
        <div className="bg-slate-900 text-white p-6 md:p-8 space-y-6">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Now Batting</p>
              <h2 className="text-3xl font-black uppercase tracking-tighter">{activeStriker?.name}</h2>
              <div className="flex gap-4">
                <span className="text-xl font-bold">{activeStriker?.batting.runs} <span className="text-xs opacity-50 font-medium">Runs</span></span>
                <span className="text-xl font-bold">{activeStriker?.batting.balls} <span className="text-xs opacity-50 font-medium">Balls</span></span>
              </div>
            </div>
            <div className="text-right space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary">Current Bowler</p>
              <h2 className="text-xl font-black uppercase tracking-tighter text-slate-300">{activeBowler?.name}</h2>
              <p className="text-xs font-bold text-slate-500 uppercase">Over: {ballsInOver}/6 Legal</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className={cn("w-3 h-3 rounded-full border-2", i < consecutiveDots ? "bg-red-500 border-red-600 animate-pulse" : "border-slate-700")} />
            ))}
            <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest ml-2">Dots Streak</span>
          </div>

          {!activeStriker?.batting.out ? (
            <div className="space-y-4">
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {[0, 1, 2, 3, 4, 6].map(r => (
                  <Button key={r} onClick={() => handleScore(r)} className="h-12 md:h-14 font-black text-lg bg-white/5 border border-white/10 hover:bg-primary hover:border-primary">
                    {r === 0 ? "•" : r}
                  </Button>
                ))}
                <Button variant="destructive" onClick={() => setIsWicketOpen(true)} className="h-12 md:h-14 font-black text-[10px] uppercase">Wicket</Button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" onClick={() => handleScore(0, 'wide')} className="h-10 border-amber-500/40 text-amber-500 font-black text-[10px] uppercase bg-amber-500/5">Wide (+1)</Button>
                <Button variant="outline" onClick={() => handleScore(0, 'noball')} className="h-10 border-amber-500/40 text-amber-500 font-black text-[10px] uppercase bg-amber-500/5">No Ball (+1)</Button>
                <Button variant="outline" onClick={undoLastAction} disabled={history.length === 0} className="h-10 border-white/20 text-white font-black text-[10px] uppercase"><Undo2 className="w-3 h-3 mr-1"/> Undo</Button>
              </div>
            </div>
          ) : (
            <div className="p-6 bg-destructive/10 border-2 border-dashed border-destructive/30 rounded-xl text-center space-y-4">
              <p className="text-lg font-black text-destructive uppercase italic">Batter is OUT ({activeStriker?.batting.dismissal})</p>
              <div className="max-w-xs mx-auto space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">Select Next Batter</Label>
                <Select value="" onValueChange={setStrikerId}>
                  <SelectTrigger className="bg-white text-slate-900 font-bold h-12">
                    <SelectValue placeholder="Choose successor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {players.filter(p => !p.batting.out && p.id !== strikerId).map(p => (
                      <SelectItem key={p.id} value={p.id} className="font-bold">{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Global Actions */}
      <div className="flex gap-2">
        <Button onClick={() => setIsAddPlayerOpen(true)} variant="secondary" className="flex-1 font-black uppercase text-[10px] h-12 shadow-md">
          <UserPlus className="w-4 h-4 mr-2" /> Add Player to Squad
        </Button>
        <Button onClick={downloadReport} variant="outline" className="flex-1 font-black uppercase text-[10px] h-12 border-primary text-primary">
          <Download className="w-4 h-4 mr-2" /> Download Report
        </Button>
      </div>

      {/* Scorecards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-xl overflow-hidden shadow-sm border">
            <div className="bg-slate-50 px-4 py-3 border-b flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Batting Scorecard</span>
              <Zap className="w-3 h-3 text-primary animate-pulse" />
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="text-[9px] font-black uppercase">Batter</TableHead>
                    <TableHead className="text-right text-[9px] font-black uppercase">R</TableHead>
                    <TableHead className="text-right text-[9px] font-black uppercase">B</TableHead>
                    <TableHead className="text-right text-[9px] font-black uppercase">4s/6s</TableHead>
                    <TableHead className="text-right text-[9px] font-black uppercase">SR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {players.map(p => (
                    <TableRow key={p.id} className={cn(p.id === strikerId ? "bg-primary/5" : "")}>
                      <TableCell className="py-3">
                        <p className="font-black text-xs uppercase">{p.name}{p.id === strikerId ? "*" : ""}</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase italic">
                          {p.batting.out ? `OUT (${p.batting.dismissal}${p.batting.fielderId !== 'none' ? ` c ${players.find(f => f.id === p.batting.fielderId)?.name}` : ''})` : p.batting.balls > 0 ? 'Not Out' : 'Yet to bat'}
                        </p>
                      </TableCell>
                      <TableCell className="text-right font-black text-sm">{p.batting.runs}</TableCell>
                      <TableCell className="text-right text-xs text-slate-500">{p.batting.balls}</TableCell>
                      <TableCell className="text-right text-[10px] font-bold text-slate-400">{p.batting.fours}/{p.batting.sixes}</TableCell>
                      <TableCell className="text-right text-[10px] font-black text-primary">{p.batting.balls > 0 ? ((p.batting.runs / p.batting.balls) * 100).toFixed(1) : '0.0'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          <Card className="rounded-xl overflow-hidden shadow-sm border">
            <div className="bg-slate-50 px-4 py-3 border-b">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Bowling Figures</span>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="text-[9px] font-black uppercase">Bowler</TableHead>
                    <TableHead className="text-right text-[9px] font-black uppercase">O</TableHead>
                    <TableHead className="text-right text-[9px] font-black uppercase">R</TableHead>
                    <TableHead className="text-right text-[9px] font-black uppercase">W</TableHead>
                    <TableHead className="text-right text-[9px] font-black uppercase">Econ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {players.map(p => (
                    <TableRow key={p.id} className={cn(p.id === bowlerId ? "bg-secondary/5" : "")}>
                      <TableCell className="py-3 font-black text-xs uppercase">{p.name}</TableCell>
                      <TableCell className="text-right font-bold text-xs">{Math.floor(p.bowling.balls / 6)}.{p.bowling.balls % 6}</TableCell>
                      <TableCell className="text-right font-bold text-xs">{p.bowling.runs}</TableCell>
                      <TableCell className="text-right font-black text-sm text-secondary">{p.bowling.wickets}</TableCell>
                      <TableCell className="text-right text-[10px] font-black text-slate-400">{p.bowling.balls > 0 ? (p.bowling.runs / (p.bowling.balls / 6)).toFixed(2) : '0.00'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 p-6 rounded-2xl border-l-8 border-l-primary shadow-xl">
            <h3 className="text-white font-black uppercase text-xs tracking-widest mb-4 flex items-center gap-2">
              <Skull className="w-4 h-4 text-red-500" /> Street Rules Active
            </h3>
            <ul className="space-y-3">
              {[
                { label: '3-Dot Rule', desc: 'Consecutive legal dots retire the batter.' },
                { label: 'Rotation', desc: 'Batting 1→N, Bowling N→1.' },
                { label: 'Extras', desc: 'Wides & No-Balls reset dot count.' },
                { label: 'Infinite', desc: 'Add players mid-match anytime.' },
              ].map((r, i) => (
                <li key={i} className="flex flex-col border-l-2 border-white/10 pl-3">
                  <span className="text-[10px] font-black uppercase text-primary">{r.label}</span>
                  <span className="text-[9px] font-medium text-slate-400">{r.desc}</span>
                </li>
              ))}
            </ul>
          </div>

          <Card className="shadow-sm border">
            <CardHeader className="py-3 px-4 border-b">
              <CardTitle className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Recent Balls</CardTitle>
            </CardHeader>
            <CardContent className="p-4 flex flex-wrap gap-2">
              {history.map((h, i) => (
                <div key={i} className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black border shadow-sm",
                  h.isWicket ? "bg-red-600 text-white border-red-700" : 
                  h.extra !== 'none' ? "bg-amber-100 text-amber-700 border-amber-200" :
                  h.runs >= 4 ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-white text-slate-700 border-slate-200"
                )}>
                  {h.isWicket ? "W" : h.extra === 'wide' ? "WD" : h.extra === 'noball' ? "NB" : h.runs === 0 ? "•" : h.runs}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dismissal Dialog */}
      <Dialog open={isWicketOpen} onOpenChange={setIsWicketOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-md rounded-2xl border-t-8 border-t-destructive">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tight text-destructive">Register Wicket</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase text-slate-400">Dismissal Type</Label>
              <Select value={wicketForm.type} onValueChange={(v) => setWicketForm({...wicketForm, type: v})}>
                <SelectTrigger className="font-bold h-12"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="caught">Caught</SelectItem>
                  <SelectItem value="bowled">Bowled</SelectItem>
                  <SelectItem value="runout">Run Out</SelectItem>
                  <SelectItem value="stumped">Stumped</SelectItem>
                  <SelectItem value="hit-wicket">Hit Wicket</SelectItem>
                  <SelectItem value="3-Dots">3-Dots Streak</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {['caught', 'stumped', 'runout'].includes(wicketForm.type) && (
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase text-slate-400">Fielder Involved</Label>
                <Select value={wicketForm.fielderId} onValueChange={(v) => setWicketForm({...wicketForm, fielderId: v})}>
                  <SelectTrigger className="font-bold h-12"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unknown/None</SelectItem>
                    {players.filter(p => p.id !== strikerId).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="destructive" onClick={() => handleWicket(wicketForm.type, wicketForm.fielderId)} className="w-full h-14 font-black uppercase tracking-widest shadow-xl">
              Confirm Wicket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Player Dialog */}
      <Dialog open={isAddPlayerOpen} onOpenChange={setIsAddPlayerOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-md rounded-2xl border-t-8 border-t-secondary">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tight">Add Player Mid-Match</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase text-slate-400">Player Name</Label>
              <Input value={newPlayerName} onChange={(e) => setNewPlayerName(e.target.value)} placeholder="Full Name" className="font-bold h-12" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={addMidMatchPlayer} className="w-full h-14 font-black uppercase tracking-widest shadow-xl bg-secondary hover:bg-secondary/90">
              Register Mid-Match
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
