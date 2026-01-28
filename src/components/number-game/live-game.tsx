'use client';

import { useState, useEffect, useRef } from 'react';
import type { GameState, Player } from '@/app/(app)/number-game/page';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { useToast } from '@/hooks/use-toast';

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
                    {players.filter(p => p.ballsBowled > 0).map((p) => (
                         <TableRow key={p.id}>
                            <TableCell>{players.findIndex(pl => pl.id === p.id) + 1}</TableCell>
                            <TableCell>{p.name}</TableCell>
                            <TableCell className="text-right">{`${Math.floor(p.ballsBowled / 6)}.${p.ballsBowled % 6}`}</TableCell>
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
    const { players, currentBatsmanIndex, currentBowlerIndex, totalWickets, totalOvers, currentOver } = gameState;
    const { toast } = useToast();
    const prevPlayersRef = useRef<Player[]>(JSON.parse(JSON.stringify(players)));
    const prevWicketsRef = useRef<number>(totalWickets);

    useEffect(() => {
        if (totalWickets > prevWicketsRef.current) {
            const outPlayer = players.find((p, i) => p.isOut && !prevPlayersRef.current[i].isOut);

            if (outPlayer) {
                let dismissalInfo = '';
                if (outPlayer.dismissal) {
                    dismissalInfo = ` (${outPlayer.dismissal.type} b. ${outPlayer.dismissal.bowlerName})`;
                }

                let description = 'Game Over! All but one player are out.';
                if (gameState.status !== 'completed' && players[currentBatsmanIndex]) {
                    const nextBatsman = players[currentBatsmanIndex];
                    description = `Next batsman is ${nextBatsman.name}.`;
                }

                toast({
                    title: `${outPlayer.name} is Out!${dismissalInfo}`,
                    description: description,
                });
            }
        }
        
        prevWicketsRef.current = totalWickets;
        prevPlayersRef.current = JSON.parse(JSON.stringify(players));
    }, [totalWickets, players, currentBatsmanIndex, gameState.status, toast]);

    const handleRecordDelivery = (runs: number, isWicket: boolean, isWide: boolean, isNoBall: boolean) => {
        setGameState(prev => {
            const newState = JSON.parse(JSON.stringify(prev)) as GameState;
            const batsman = newState.players[newState.currentBatsmanIndex];
            const bowler = newState.players[newState.currentBowlerIndex];

            let deliveryOutcome = runs.toString();

            if (!isWide && !isNoBall) {
                if (runs === 0 && !isWicket) {
                    batsman.consecutiveDots = (batsman.consecutiveDots || 0) + 1;
                } else {
                    batsman.consecutiveDots = 0;
                }
            } else if (isWide) {
                batsman.consecutiveDots = 0;
            }

            const isThreeDotsOut = batsman.consecutiveDots === 3;
            
            if (!isWide) {
                batsman.balls++;
            }
            
            if (isWicket || isThreeDotsOut) {
                deliveryOutcome = 'W';
            } else if (isWide) {
                deliveryOutcome = 'Wd';
            } else if (isNoBall) {
                deliveryOutcome = 'Nb';
            }
            
            newState.currentOver.deliveries.push(deliveryOutcome);

            if(!isWide && !isNoBall) {
                 newState.currentOver.legalBalls++;
            }

            if (isWide || isNoBall) {
                bowler.runsConceded += 1;
            }
            
            if (!isWide) {
                batsman.runs += runs;
                bowler.runsConceded += runs;
                if (runs === 4) batsman.fours++;
                if (runs === 6) batsman.sixes++;
            }

            if (!isWide && !isNoBall) {
                bowler.ballsBowled++;
            }

            if(isWicket || isThreeDotsOut) {
                batsman.isOut = true;
                batsman.dismissal = {
                    type: isThreeDotsOut ? '3-dots' : 'Wicket',
                    bowlerName: bowler.name
                };
                bowler.wicketsTaken++;
                newState.totalWickets++;
                batsman.consecutiveDots = 0;

                if (batsman.runs === 0) {
                    batsman.duck = true;
                    if (batsman.balls === 1) {
                        batsman.goldenDuck = true;
                    }
                }

                const notOutPlayers = newState.players.filter(p => !p.isOut);
                if (notOutPlayers.length < 2) {
                    newState.status = 'completed';
                    return newState;
                }
                
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
                newState.totalOvers++;
                newState.currentOver = { deliveries: [], legalBalls: 0 };

                // Determine the next bowler in reverse sequence
                let nextBowlerIndex = newState.currentBowlerIndex - 1;
                
                // Wrap around if we've gone past the first bowler (index 0)
                if (nextBowlerIndex < 0) {
                    nextBowlerIndex = newState.players.length - 1;
                }

                // If the next bowler is the current batsman, skip them and go to the previous bowler in sequence
                if (nextBowlerIndex === newState.currentBatsmanIndex) {
                    nextBowlerIndex = nextBowlerIndex - 1;
                    // Handle wrap-around again if necessary
                    if (nextBowlerIndex < 0) {
                        nextBowlerIndex = newState.players.length - 1;
                    }
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
                <CardDescription>Wickets: {totalWickets} | Overs: {totalOvers}.{currentOver.legalBalls}</CardDescription>
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
