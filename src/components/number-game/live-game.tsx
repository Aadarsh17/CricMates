'use client';

import { useState } from 'react';
import type { GameState, Player } from '@/app/(app)/number-game/page';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';

interface LiveGameProps {
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
}

const Scorecard = ({ players }: { players: Player[] }) => (
  <Card>
    <CardHeader>
      <CardTitle>Scorecard</CardTitle>
    </CardHeader>
    <CardContent>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>Player</TableHead>
            <TableHead className="text-right">Runs</TableHead>
            <TableHead className="text-right">Balls</TableHead>
            <TableHead className="text-right">4s</TableHead>
            <TableHead className="text-right">6s</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {players.map((p, index) => (
            <TableRow key={p.id}>
              <TableCell>{index + 1}</TableCell>
              <TableCell>{p.name} {p.isOut && '(Out)'}</TableCell>
              <TableCell className="text-right">{p.runs}</TableCell>
              <TableCell className="text-right">{p.balls}</TableCell>
              <TableCell className="text-right">{p.fours}</TableCell>
              <TableCell className="text-right">{p.sixes}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CardContent>
  </Card>
);

const BowlingScorecard = ({ players }: { players: Player[] }) => (
    <Card>
        <CardHeader>
            <CardTitle>Bowling</CardTitle>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Player</TableHead>
                        <TableHead className="text-right">Overs</TableHead>
                        <TableHead className="text-right">Runs</TableHead>
                        <TableHead className="text-right">Wickets</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {players.filter(p => p.oversBowled > 0).map((p, index) => (
                         <TableRow key={p.id}>
                            <TableCell>{players.length - index}</TableCell>
                            <TableCell>{p.name}</TableCell>
                            <TableCell className="text-right">{p.oversBowled}.{p.ballsBowled % 6}</TableCell>
                            <TableCell className="text-right">{p.runsConceded}</TableCell>
                            <TableCell className="text-right">{p.wicketsTaken}</TableCell>
                         </TableRow>
                    ))}
                </TableBody>
            </Table>
        </CardContent>
    </Card>
)

const UmpireControls = ({ onRecordDelivery }: { onRecordDelivery: (runs: number, isWicket: boolean, isWide: boolean, isNoBall: boolean) => void }) => {
  const [isWicket, setIsWicket] = useState(false);
  const [isWide, setIsWide] = useState(false);
  const [isNoBall, setIsNoBall] = useState(false);

  const handleDelivery = (runs: number) => {
    onRecordDelivery(runs, isWicket, isWide, isNoBall);
    setIsWicket(false);
    setIsWide(false);
    setIsNoBall(false);
  };
  
   const handleExtraChange = (extra: 'wide' | 'noball', checked: boolean) => {
        if (extra === 'wide' && checked) {
            setIsWide(true);
            setIsNoBall(false);
        } else if (extra === 'noball' && checked) {
            setIsNoBall(true);
            setIsWide(false);
        } else {
             setIsWide(false);
             setIsNoBall(false);
        }
   }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Umpire Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Checkbox id="wicket" checked={isWicket} onCheckedChange={(c) => setIsWicket(!!c)} />
            <Label htmlFor="wicket">Wicket</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="wide" checked={isWide} onCheckedChange={(c) => handleExtraChange('wide', !!c)} />
            <Label htmlFor="wide">Wide</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox id="noball" checked={isNoBall} onCheckedChange={(c) => handleExtraChange('noball', !!c)} />
            <Label htmlFor="noball">No Ball</Label>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[0, 1, 2, 3, 4, 6].map(runs => (
            <Button key={runs} variant="outline" onClick={() => handleDelivery(runs)}>
              {runs}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};


export function LiveGame({ gameState, setGameState }: LiveGameProps) {
    const { players, currentBatsmanIndex, currentBowlerIndex, totalScore, totalWickets, totalOvers, currentOver } = gameState;

    const handleRecordDelivery = (runs: number, isWicket: boolean, isWide: boolean, isNoBall: boolean) => {
        setGameState(prev => {
            const newState = JSON.parse(JSON.stringify(prev)) as GameState;
            const batsman = newState.players[newState.currentBatsmanIndex];
            const bowler = newState.players[newState.currentBowlerIndex];

            let deliveryOutcome = runs.toString();
            if (isWicket) deliveryOutcome = 'W';
            if (isWide) deliveryOutcome = 'Wd';
            if (isNoBall) deliveryOutcome = 'Nb';
            
            if (!isWide && !isNoBall) {
                if (runs === 0) {
                    batsman.consecutiveDots = (batsman.consecutiveDots || 0) + 1;
                } else {
                    batsman.consecutiveDots = 0;
                }
            }

            const isThreeDotsOut = batsman.consecutiveDots === 3;
            if (isThreeDotsOut) {
                deliveryOutcome = 'W';
            }
            
            newState.currentOver.deliveries.push(deliveryOutcome);

            if (!isWide) {
                batsman.balls++;
            }
            
            if(!isWide && !isNoBall) {
                 newState.currentOver.legalBalls++;
            }

            if (!isWide) {
                batsman.runs += runs;
                newState.totalScore += runs;
                if (runs === 4) batsman.fours++;
                if (runs === 6) batsman.sixes++;
            }

            bowler.ballsBowled++;
            if (!isWide) { // No ball runs are conceded by bowler
                bowler.runsConceded += runs;
            }

            if(isWicket || isThreeDotsOut) {
                batsman.isOut = true;
                bowler.wicketsTaken++;
                newState.totalWickets++;
                batsman.consecutiveDots = 0;
                if (newState.totalWickets >= newState.players.length - 1) {
                    newState.status = 'completed';
                    return newState;
                }
                // Find next batsman
                let nextBatsmanIndex = newState.currentBatsmanIndex + 1;
                while(nextBatsmanIndex < newState.players.length && newState.players[nextBatsmanIndex].isOut) {
                    nextBatsmanIndex++;
                }
                if (nextBatsmanIndex >= newState.players.length) {
                    newState.status = 'completed';
                    return newState;
                }
                newState.currentBatsmanIndex = nextBatsmanIndex;
            }

            if (newState.currentOver.legalBalls === 6) {
                bowler.oversBowled = 1;
                newState.totalOvers++;
                newState.currentOver = { deliveries: [], legalBalls: 0 };

                if (newState.totalOvers >= newState.players.length) {
                     newState.status = 'completed';
                     return newState;
                }
                
                // Find next bowler
                let nextBowlerIndex = newState.currentBowlerIndex - 1;
                while(nextBowlerIndex >= 0 && newState.players[nextBowlerIndex].oversBowled > 0) {
                     nextBowlerIndex--;
                }

                if (nextBowlerIndex < 0) {
                    newState.status = 'completed';
                    return newState;
                }
                newState.currentBowlerIndex = nextBowlerIndex;
            }

            return newState;
        });
    };
    
    const currentBatsman = players[currentBatsmanIndex];
    const currentBowler = players[currentBowlerIndex];

  return (
    <div className="space-y-6">
        <Card>
            <CardHeader>
                <CardTitle>Live Match</CardTitle>
                <CardDescription>Total Score: {totalScore}/{totalWickets} in {totalOvers}.{currentOver.legalBalls} overs</CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
               <div><span className="font-semibold">Batting:</span> {currentBatsman?.name} {currentBatsman && `(${currentBatsman.consecutiveDots || 0} dots)`}</div>
               <div><span className="font-semibold">Bowling:</span> {currentBowler?.name}</div>
               <div className='md:col-span-2 space-y-2'>
                    <Label>This Over</Label>
                    <div className="flex flex-wrap gap-2 p-2 bg-muted rounded-md min-h-[40px] items-center">
                        {currentOver.deliveries.length > 0 ? currentOver.deliveries.map((d, i) => (
                            <Badge key={i} variant={d === 'W' ? 'destructive' : 'secondary'} className="text-md">
                                {d}
                            </Badge>
                        )) : <p className="text-sm text-muted-foreground px-2">No deliveries bowled in this over yet.</p>}
                    </div>
                </div>
            </CardContent>
        </Card>
        <UmpireControls onRecordDelivery={handleRecordDelivery} />
        <Scorecard players={players} />
        <BowlingScorecard players={players} />
        <div className="text-center p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">Note: Game state is not saved. Refreshing the page will restart the game setup.</p>
        </div>
    </div>
  );
}
