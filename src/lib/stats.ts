import type { Team, Match, Player } from "@/lib/types";

export type AggregatedPlayerStats = {
  player: Player;
  team: Team | undefined;
  matches: number;
  
  // Batting
  inningsBatted: number;
  notOuts: number;
  runsScored: number;
  ballsFaced: number;
  highestScore: number;
  battingAverage: number | null;
  strikeRate: number | null;
  fifties: number;
  hundreds: number;
  fours: number;
  sixes: number;
  ducks: number;
  goldenDucks: number;

  // Bowling
  inningsBowled: number;
  oversBowled: string;
  ballsBowled: number;
  runsConceded: number;
  wicketsTaken: number;
  maidens: number;
  bestBowlingWickets: number;
  bestBowlingRuns: number;
  bowlingAverage: number | null;
  economyRate: number | null;
  bowlingStrikeRate: number | null;
  fourWickets: number;
  fiveWickets: number;
};

const formatOvers = (balls: number) => {
  const overs = Math.floor(balls / 6);
  const remainingBalls = balls % 6;
  return `${overs}.${remainingBalls}`;
};

export const calculatePlayerCVP = (player: Player, match: Match, allPlayers: Player[], allTeams: Team[]): number => {
      if (match.status !== 'completed' || !match.result) return 0;

      let playerPoints = 0;
      const playerId = player.id;

      // Batting, Bowling, and Fielding points from deliveries
      match.innings.forEach(inning => {
        inning.deliveryHistory.forEach(delivery => {
          const { strikerId, bowlerId, runs, isWicket, extra, dismissal } = delivery;

          // 1. Batting Points
          if (strikerId === playerId && extra !== 'byes' && extra !== 'legbyes') {
            // 1 point per run
            playerPoints += runs;

            // Boundary bonuses
            if (runs === 6) {
              playerPoints += 4; // 4 extra points for a 6
            }
          }

          // 2. Bowling & Fielding Points
          if (isWicket && dismissal) {
            if (dismissal.type === 'Run out') {
              if (dismissal.fielderId === playerId) playerPoints += 5;
            } else if (dismissal.type === 'Catch out' || dismissal.type === 'Stumping') {
              if (bowlerId === playerId) playerPoints += 10; // Wicket for bowler
              if (dismissal.fielderId === playerId) playerPoints += 5; // Fielding point
            } else { // Bowled, LBW, Hit Wicket etc.
              if (bowlerId === playerId) playerPoints += 10;
            }
          }
        });
      });

      // Post-match bonuses (Strike Rate, Economy, Winning Team)
      const battingStatsInMatch = { runs: 0, balls: 0 };
      const bowlingStatsInMatch = { runs: 0, balls: 0 };

      match.innings.forEach(inning => {
        inning.deliveryHistory.forEach(delivery => {
          const { strikerId, bowlerId, runs, extra } = delivery;
          // Aggregate stats for SR and Economy calculation
          if (strikerId === playerId) {
            if (extra !== 'byes' && extra !== 'legbyes') {
              battingStatsInMatch.runs += runs;
            }
            if (extra !== 'wide') {
              battingStatsInMatch.balls += 1;
            }
          }

          if (bowlerId === playerId) {
            let conceded = runs;
            if (extra === 'wide' || extra === 'noball') conceded += 1;
            bowlingStatsInMatch.runs += conceded;

            if (extra !== 'wide' && extra !== 'noball') {
              bowlingStatsInMatch.balls += 1;
            }
          }
        });
      });

      // Calculate SR and Economy bonuses
      if (battingStatsInMatch.balls > 0) {
        const strikeRate = (battingStatsInMatch.runs / battingStatsInMatch.balls) * 100;
        if (strikeRate > 200) {
          playerPoints += 5;
        }
      }

      if (bowlingStatsInMatch.balls > 0) {
        const economy = bowlingStatsInMatch.runs / (bowlingStatsInMatch.balls / 6);
        if (economy <= 7) {
          playerPoints += 5;
        }
      }

      // Winning team bonus
      const team1 = allTeams.find(t => t.id === match.team1Id);
      const team2 = allTeams.find(t => t.id === match.team2Id);
      if(team1 && team2) {
          const winningTeamName = match.result.split(' won by')[0].trim();
          const winningTeam = [team1, team2].find(t => t.name === winningTeamName);

          if (winningTeam && player.teamId === winningTeam.id) {
            playerPoints += 3;
          }
      }

      return Math.round(playerPoints);
    };

export const calculatePlayerStats = (players: Player[], teams: Team[], matches: Match[]): AggregatedPlayerStats[] => {
    return players.map(player => {
        const playerMatches = matches.filter(m => m.status === 'completed' && (m.innings.some(i => i.battingTeamId === player.teamId || i.bowlingTeamId === player.teamId)));
        
        let runsScored = 0, ballsFaced = 0, fours = 0, sixes = 0;
        let highestScore = 0, fifties = 0, hundreds = 0, ducks = 0, goldenDucks = 0, notOuts = 0;
        let inningsBatted = 0;
        
        let ballsBowled = 0, runsConceded = 0, wicketsTaken = 0;
        let fourWickets = 0, fiveWickets = 0;
        let inningsBowled = 0;
        let bestBowlingWickets = 0, bestBowlingRuns = Infinity;

        const uniqueMatchIds = new Set<string>();

        playerMatches.forEach(match => {
            let playedInMatch = false;
            
            match.innings.forEach(inning => {
                // Batting Stats
                if (inning.battingTeamId === player.teamId) {
                    const playerDeliveriesAsStriker = inning.deliveryHistory.filter(d => d.strikerId === player.id);
                    if (playerDeliveriesAsStriker.length > 0) {
                        playedInMatch = true;
                        inningsBatted++;
                        let runsThisInning = 0;
                        let ballsFacedThisInning = 0;

                        playerDeliveriesAsStriker.forEach(d => {
                            if (d.extra !== 'byes' && d.extra !== 'legbyes') {
                                runsScored += d.runs;
                                runsThisInning += d.runs;
                                if (d.runs === 4) fours++;
                                if (d.runs === 6) sixes++;
                            }
                            if (d.extra !== 'wide') {
                                ballsFaced++;
                                ballsFacedThisInning++;
                            }
                        });

                        if (runsThisInning >= 50 && runsThisInning < 100) fifties++;
                        if (runsThisInning >= 100) hundreds++;
                        if (runsThisInning > highestScore) highestScore = runsThisInning;
                        
                        const wasOut = inning.deliveryHistory.some(d => d.isWicket && d.strikerId === player.id);
                        if (wasOut) {
                           if (runsThisInning === 0) {
                               ducks++;
                               if (ballsFacedThisInning === 1) {
                                   goldenDucks++;
                               }
                           }
                        } else {
                           notOuts++;
                        }
                    }
                }
                
                // Bowling Stats
                if (inning.bowlingTeamId === player.teamId) {
                    const playerDeliveriesAsBowler = inning.deliveryHistory.filter(d => d.bowlerId === player.id);
                    if (playerDeliveriesAsBowler.length > 0) {
                        playedInMatch = true;
                        inningsBowled++;
                        let wicketsThisInning = 0, runsConcededThisInning = 0;
    
                        playerDeliveriesAsBowler.forEach(d => {
                            if (d.extra !== 'wide' && d.extra !== 'noball') ballsBowled++;
                            runsConceded += d.runs;
                            runsConcededThisInning += d.runs;
    
                            if (d.extra === 'wide' || d.extra === 'noball') {
                                runsConceded++;
                                runsConcededThisInning++;
                            }
                            if (d.isWicket && d.outcome !== 'Retired' && d.outcome !== 'run out') {
                                wicketsTaken++;
                                wicketsThisInning++;
                            }
                        });

                        if (wicketsThisInning >= 4) fourWickets++;
                        if (wicketsThisInning >= 5) fiveWickets++;

                        if (wicketsThisInning > bestBowlingWickets) {
                            bestBowlingWickets = wicketsThisInning;
                            bestBowlingRuns = runsConcededThisInning;
                        } else if (wicketsThisInning === bestBowlingWickets && runsConcededThisInning < bestBowlingRuns) {
                            bestBowlingRuns = runsConcededThisInning;
                        }
                    }
                }
            });
            if (playedInMatch) uniqueMatchIds.add(match.id);
        });
        
        const matchesPlayed = uniqueMatchIds.size;
        const outs = inningsBatted - notOuts;
        
        return {
            player,
            team: teams.find(t => t.id === player.teamId),
            matches: matchesPlayed,
            inningsBatted,
            notOuts,
            runsScored,
            ballsFaced,
            highestScore,
            battingAverage: outs > 0 ? runsScored / outs : null,
            strikeRate: ballsFaced > 0 ? (runsScored / ballsFaced) * 100 : null,
            fifties,
            hundreds,
            fours,
            sixes,
            ducks,
            goldenDucks,
            inningsBowled,
            oversBowled: formatOvers(ballsBowled),
            ballsBowled,
            runsConceded,
            wicketsTaken,
            maidens: 0, // Placeholder
            bestBowlingWickets,
            bestBowlingRuns: bestBowlingRuns === Infinity ? 0 : bestBowlingRuns,
            bowlingAverage: wicketsTaken > 0 ? runsConceded / wicketsTaken : null,
            economyRate: ballsBowled > 0 ? runsConceded / (ballsBowled / 6) : null,
            bowlingStrikeRate: wicketsTaken > 0 ? ballsBowled / wicketsTaken : null,
            fourWickets,
            fiveWickets,
        };
    });
};
