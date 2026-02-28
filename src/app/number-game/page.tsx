"use client"

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { History, RotateCcw, Play, Circle, Skull, Hash } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function NumberGame() {
  const [score, setScore] = useState(0);
  const [dots, setDots] = useState(0);
  const [balls, setBalls] = useState(0);
  const [out, setOut] = useState(false);
  const [history, setHistory] = useState<number[]>([]);

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
          description: "3 Dot balls in a row. Batter is out!",
          variant: "destructive"
        });
      }
    } else {
      setScore(prev => prev + runs);
      setDots(0); // Reset dots on scoring
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
        <p className="text-muted-foreground text-sm">Casual Street Cricket: 3 Dots = Out!</p>
      </div>

      <Card className={`text-center border-2 transition-colors ${out ? 'border-destructive bg-destructive/5' : 'border-primary'}`}>
        <CardHeader>
          <div className="flex justify-between items-center mb-2">
             <Badge variant="outline" className="font-mono">Balls: {balls}</Badge>
             <div className="flex space-x-1">
               {[...Array(3)].map((_, i) => (
                 <Circle key={i} className={`w-3 h-3 ${i < dots ? 'fill-destructive text-destructive' : 'text-muted'}`} />
               ))}
             </div>
          </div>
          <CardTitle className="text-6xl font-black text-primary">
            {out ? "OUT" : score}
          </CardTitle>
          <CardDescription className="text-sm font-bold uppercase tracking-widest">
            Current Score
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2, 3, 4, 6].map((num) => (
              <Button 
                key={num} 
                variant={num === 0 ? "outline" : "default"}
                size="lg"
                disabled={out}
                onClick={() => handleScore(num)}
                className={`h-16 text-xl font-bold ${num === 0 ? 'border-2' : 'bg-primary hover:bg-primary/90'}`}
              >
                {num === 0 ? "Dot" : num}
              </Button>
            ))}
          </div>
          
          <div className="mt-8 flex gap-4">
            <Button variant="ghost" className="flex-1" onClick={reset}>
              <RotateCcw className="mr-2 h-4 w-4" /> Reset Game
            </Button>
            {out && (
               <Button className="flex-1 bg-secondary hover:bg-secondary/90" onClick={reset}>
                <Play className="mr-2 h-4 w-4" /> New Batter
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-sm flex items-center">
            <History className="w-4 h-4 mr-2 text-muted-foreground" />
            Recent Balls
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {history.length > 0 ? history.map((h, i) => (
            <div key={i} className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border ${h === 0 ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-secondary/10 text-secondary border-secondary/20'}`}>
              {h}
            </div>
          )) : (
            <p className="text-xs text-muted-foreground italic">No balls bowled yet.</p>
          )}
        </CardContent>
      </Card>

      <div className="bg-muted p-4 rounded-xl space-y-2">
        <h3 className="text-sm font-bold flex items-center">
          <Skull className="w-4 h-4 mr-2 text-destructive" />
          Street Rules
        </h3>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
          <li>Every run counts as normal points.</li>
          <li>Three consecutive dot balls results in an automatic <strong>OUT</strong>.</li>
          <li>Rotating bowling: Every player bowls one ball after another.</li>
          <li>Competitive sessions track your high score locally.</li>
        </ul>
      </div>
    </div>
  );
}