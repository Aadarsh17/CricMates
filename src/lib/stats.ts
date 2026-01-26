import type { Team, Match, Player } from "@/lib/types";

export type AggregatedPlayerStats = {
  player: Player;
  team: Team | undefined;
  matches: number;
  inningsBatted: number;
  runsScored: number;
  ballsFaced: number;
  outs: number;
  highestScore: number;
  battingAverage: number | null;
  strikeRate: number | null;
  fours: number;
  sixes: number;

  oversBowled: string;
  runsConceded: number;
  wicketsTaken: number;
  bestBowlingWickets: number;
  bestBowlingRuns: number;
  bowlingAverage: number | null;
  economyRate: number | null;
};

const formatOvers = (balls: number) => {
  const overs = Math.floor(balls / 6);
  const remainingBalls = balls % 6;
  return `${overs}.${remainingBalls}`;
};

export const calculatePlayerStats = (players: Player[], teams: Team[], matches: Match[]): AggregatedPlayerStats[] => {
    return players.map(player => {
        let inningsBatted = 0;
        let runsScored = 0;
        let ballsFaced = 0;
        let outs = 0;
        let highestScore = 0;
        let fours = 0;
        let sixes = 0;
        
        let ballsBowled = 0;
        let runsConceded = 0;
        let wicketsTaken = 0;
        const bowlingInnings: { wickets: number, runs: number }[] = [];


        const playerMatches = matches.filter(m => m.status === 'completed' && (m.innings.some(i => i.battingTeamId === player.teamId || i.bowlingTeamId === player.teamId)));
        
        const uniqueMatchIds = new Set<string>();

        playerMatches.forEach(match => {
            let playedInMatch = false;

            match.innings.forEach(inning => {
                const isBattingInning = inning.battingTeamId === player.teamId;
                const isBowlingInning = inning.bowlingTeamId === player.teamId;

                if (isBattingInning) {
                    const playerDeliveriesAsStriker = inning.deliveryHistory.filter(d => d.strikerId === player.id);
                    const battedInInning = playerDeliveriesAsStriker.length > 0;
                   
                    if (battedInInning) {
                        playedInMatch = true;
                        inningsBatted++;
                        let runsThisInning = 0;
    
                        playerDeliveriesAsStriker.forEach(d => {
                            if (d.extra !== 'byes' && d.extra !== 'legbyes') {
                                runsScored += d.runs;
                                runsThisInning += d.runs;
                                if (d.runs === 4) fours++;
                                if (d.runs === 6) sixes++;
                            }
                            if (d.extra !== 'wide') {
                               ballsFaced++;
                            }
                        });

                        const wicketDelivery = inning.deliveryHistory.find(d => d.isWicket && d.strikerId === player.id);
                        if (wicketDelivery) {
                            outs++;
                        }

                        if (runsThisInning > highestScore) {
                            highestScore = runsThisInning;
                        }
                    }
                }
                
                if (isBowlingInning) {
                    const playerDeliveriesAsBowler = inning.deliveryHistory.filter(d => d.bowlerId === player.id);
                    if (playerDeliveriesAsBowler.length > 0) {
                         playedInMatch = true;
                         let wicketsThisInning = 0;
                         let runsConcededThisInning = 0;
    
                         playerDeliveriesAsBowler.forEach(d => {
                             if (d.extra !== 'wide' && d.extra !== 'noball') {
                                 ballsBowled++;
                             }
                             runsConceded += d.runs;
                             runsConcededThisInning += d.runs;
    
                             if (d.extra === 'wide' || d.extra === 'noball') {
                                 runsConceded++;
                                 runsConcededThisInning++;
                             }
                             if (d.isWicket && d.outcome !== 'Retired' && d.outcome !== 'run out') { // Simple check
                                 wicketsTaken++;
                                 wicketsThisInning++;
                             }
                         });
                         bowlingInnings.push({ wickets: wicketsThisInning, runs: runsConcededThisInning });
                    }
                }
            });
            if (playedInMatch) {
              uniqueMatchIds.add(match.id);
            }
        });
        
        const matchesPlayed = uniqueMatchIds.size;
        
        const battingAverage = outs > 0 ? runsScored / outs : null;
        const strikeRate = ballsFaced > 0 ? (runsScored / ballsFaced) * 100 : null;

        const bowlingAverage = wicketsTaken > 0 ? runsConceded / wicketsTaken : null;
        const economyRate = ballsBowled > 0 ? runsConceded / (ballsBowled / 6) : null;
        
        let bestBowlingWickets = 0;
        let bestBowlingRuns = Infinity;

        bowlingInnings.forEach(inning => {
            if (inning.wickets > bestBowlingWickets) {
                bestBowlingWickets = inning.wickets;
                bestBowlingRuns = inning.runs;
            } else if (inning.wickets === bestBowlingWickets && inning.runs < bestBowlingRuns) {
                bestBowlingRuns = inning.runs;
            }
        });
        
        return {
            player,
            team: teams.find(t => t.id === player.teamId),
            matches: matchesPlayed,
            inningsBatted,
            runsScored,
            ballsFaced,
            outs,
            highestScore,
            battingAverage,
            strikeRate,
            fours,
            sixes,

            oversBowled: formatOvers(ballsBowled),
            runsConceded,
            wicketsTaken,
            bestBowlingWickets: bestBowlingWickets,
            bestBowlingRuns: bestBowlingRuns === Infinity ? 0 : bestBowlingRuns,
            bowlingAverage,
            economyRate,
        };
    });
};
