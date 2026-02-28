
"use client"

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { History as HistoryIcon, RotateCcw, Play, Circle, Skull, Hash, UserPlus, Undo2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function NumberGame() {
  const [score, setScore] = useState(0);
  const [dots, setDots] = useState(0);
  const [balls, setBalls] = useState(0);
  const [out, setOut] = useState(false);
  const [history, setHistory] = useState<number[]>([]);
  const [players, setPlayers] = useState<string[]>(['Batter 1', 'Batter 2']);

  const handleScore = (runs: number) => {
    if (out) return;

    setBalls(prev => prev + 1);
    setHistory(prev => [runs, ...prev].slice(0, 10));

    if (runs === 0) {
      const newDots = dots + 1;
      setDots(newDots);
      if (newDots === 3) {
        setOut(true);
        toast({
          title: "OUT!",
          description: "3 Consecutive dots. Batter is out!",
          variant: "destructive"
        });
      }
    } else {
      setScore(prev => prev + runs);
      setDots(0);
    }
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const last = history[0];
    setHistory(prev => prev.slice(1));
    setBalls(prev => prev - 1);
    if (last === 0) {
      setDots(prev => Math.max(0, prev - 1));
      setOut(false);
    } else {
      setScore(prev => prev - last);
      setDots(0);
    }
  };

  const reset = () => {
    setScore(0);
    setDots(0);
    setBalls(0);
    setOut(false);
    setHistory([]);
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold font-headline flex items-center justify-center space-x-2">
          <Hash className="text-secondary" />
          <span>Number Game</span>
        </h1>
        <Badge variant="secondary" className="mt-2 uppercase tracking-tighter">Special Sunday Mode</Badge>
      </div>

      <Card className={`text-center border-2 transition-all ${out ? 'border-destructive bg-destructive/5 scale-95 shadow-none' : 'border-primary shadow-xl'}`}>
        <CardHeader>
          <div className="flex justify-between items-center mb-2">
             <Badge variant="outline" className="font-mono bg-white">Balls: {balls}</Badge>
             <div className="flex space-x-1">
               {[...Array(3)].map((_, i) => (
                 <Circle key={i} className={`w-4 h-4 transition-all duration-300 ${i < dots ? 'fill-destructive text-destructive scale-110' : 'text-muted'}`} />
               ))}
             </div>
          </div>
          <CardTitle className="text-7xl font-black text-primary py-4">
            {out ? "OUT" : score}
          </CardTitle>
          <CardDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {players[0]}'s Innings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2, 3, 4, 6].map((num) => (
              <Button 
                key={num} 
                variant={num === 0 ? "outline" : "default"}
                size="lg"
                disabled={out}
                onClick={() => handleScore(num)}
                className={`h-16 text-2xl font-black ${num === 0 ? 'border-2 border-primary/20' : 'bg-primary hover:bg-primary/90'}`}
              >
                {num === 0 ? "Dot" : num}
              </Button>
            ))}
          </div>
          
          <div className="flex gap-4">
            <Button variant="outline" className="flex-1" onClick={handleUndo}>
              <Undo2 className="mr-2 h-4 w-4" /> Undo
            </Button>
            <Button variant="ghost" className="flex-1" onClick={reset}>
              <RotateCcw className="mr-2 h-4 w-4" /> Clear
            </Button>
          </div>

          {out && (
             <Button className="w-full bg-secondary hover:bg-secondary/90 h-14 text-lg font-bold" onClick={reset}>
              <Play className="mr-2 h-5 w-5" /> Next Batter
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card className="shadow-sm">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-[10px] uppercase text-muted-foreground flex items-center">
              <HistoryIcon className="w-3 h-3 mr-1" /> Recent Balls
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 flex flex-wrap gap-1.5">
            {history.map((h, i) => (
              <div key={i} className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border ${h === 0 ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-secondary/10 text-secondary border-secondary/20'}`}>
                {h}
              </div>
            ))}
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-[10px] uppercase text-muted-foreground flex items-center">
              <UserPlus className="w-3 h-3 mr-1" /> Rotation
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 text-[10px] font-medium text-muted-foreground italic">
            Next: Batter 2<br/>
            Bowler: Last Player
          </CardContent>
        </Card>
      </div>

      <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
        <h3 className="text-sm font-bold flex items-center mb-2">
          <Skull className="w-4 h-4 mr-2 text-destructive" />
          Sunday Rules Engaged
        </h3>
        <ul className="text-[10px] text-muted-foreground space-y-1 list-disc list-inside">
          <li><strong>3 Dots = Out</strong>: Consecutive dot balls retire the batter.</li>
          <li><strong>Reverse Bowling</strong>: Order starts from the last registered player.</li>
          <li><strong>Mid-Match Adds</strong>: New players can join anytime.</li>
          <li><strong>Infinite Rotation</strong>: No fixed overs, play till sunset.</li>
        </ul>
      </div>
    </div>
  );
}
