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

    // ✅ Participation: +1 point
    const playerTeamIds = new Set(allPlayers.filter(p => p.teamId === match.team1Id || p.teamId === match.team2Id).map(p => p.teamId));
    if (playerTeamIds.has(player.teamId)) {
        playerPoints += 1;
    }

    match.innings.forEach(inning => {
        // --- Batting, Fielding, Wicket points ---
        const playerDeliveriesAsStriker = inning.deliveryHistory.filter(d => d.strikerId === playerId);
        const playerDeliveriesAsBowler = inning.deliveryHistory.filter(d => d.bowlerId === playerId);
        
        let runsThisInning = 0;
        let ballsFacedThisInning = 0;
        let wasOut = inning.deliveryHistory.some(d => d.isWicket && d.dismissal?.batsmanOutId === playerId);

        // Process Batting Points only if the player actually batted
        if (playerDeliveriesAsStriker.length > 0) {
            playerDeliveriesAsStriker.forEach(d => {
                 if (d.extra !== 'byes' && d.extra !== 'legbyes') {
                    playerPoints += d.runs; // +1 per run
                    runsThisInning += d.runs;
                    if (d.runs === 4) playerPoints += 1; // +1 for a four
                    if (d.runs === 6) playerPoints += 2; // +2 for a six
                }
                if (d.extra !== 'wide') {
                    ballsFacedThisInning++;
                }
            });

            // Strike Rate Bonuses/Penalties (min 6 balls)
            if (ballsFacedThisInning >= 6) {
                const strikeRate = (runsThisInning / ballsFacedThisInning) * 100;
                if (strikeRate >= 220) playerPoints += 5;
                else if (strikeRate >= 180) playerPoints += 3;
                
                if (strikeRate < 80 && strikeRate >= 60) playerPoints -= 3;
                else if (strikeRate < 60) playerPoints -= 5;
            }
            
            // % of Team Total Bonus
            if (inning.score > 0 && (runsThisInning / inning.score) * 100 >= 30) {
                playerPoints += 5;
            }

            // Not Out Bonus
            if (!wasOut && runsThisInning >= 10) {
                playerPoints += 3;
            }

            // Golden Duck Penalty
            if (wasOut && runsThisInning === 0 && (ballsFacedThisInning === 1 || ballsFacedThisInning === 2)) {
                playerPoints -= 2;
            }
        }
        
        // Process Bowling Points
        if (playerDeliveriesAsBowler.length > 0) {
            const oversBowled = new Map<number, { runs: number; wickets: number; dots: number; }>();

            playerDeliveriesAsBowler.forEach(d => {
                const overNumber = Math.floor(inning.deliveryHistory.filter(del => del.bowlerId === playerId && del.timestamp <= d.timestamp && del.extra !== 'wide' && del.extra !== 'noball').length / 6);
                
                if (!oversBowled.has(overNumber)) {
                    oversBowled.set(overNumber, { runs: 0, wickets: 0, dots: 0 });
                }
                const overStats = oversBowled.get(overNumber)!;

                let conceded = d.runs;
                if (d.extra === 'wide' || d.extra === 'noball') conceded += 1;
                overStats.runs += conceded;

                if (d.isWicket && d.dismissal?.type !== 'Run out') {
                    overStats.wickets++;
                    playerPoints += 12; // +12 per wicket
                }

                if (d.runs === 0 && !d.isWicket && d.extra !== 'wide' && d.extra !== 'noball') {
                    overStats.dots++;
                    playerPoints += 1; // +1 per dot ball
                }
            });

            oversBowled.forEach(overStats => {
                if(overStats.wickets >= 2) playerPoints += 6; // 2 wickets in an over bonus
                if(overStats.runs <= 1) playerPoints += 5; // 0-1 run in over bonus

                // Negative points only if no wicket was taken in the over
                if (overStats.wickets === 0) {
                    if (overStats.runs >= 18) playerPoints -= 8;
                    else if (overStats.runs >= 15) playerPoints -= 5;
                    else if (overStats.runs >= 12) playerPoints -= 3;
                }
            });
        }

        // Process Fielding points from all deliveries in the inning
        inning.deliveryHistory.forEach(delivery => {
            if (delivery.isWicket && delivery.dismissal?.fielderId === playerId) {
                if (delivery.dismissal.type === 'Catch out') playerPoints += 6;
                if (delivery.dismissal.type === 'Stumping') playerPoints += 6;
                if (delivery.dismissal.type === 'Run out') playerPoints += 5; // Assisted run-out
            }
        });
    });

    // --- 4. Team Bonus ---
    const team1 = allTeams.find(t => t.id === match.team1Id);
    const team2 = allTeams.find(t => t.id === match.team2Id);
    if (team1 && team2) {
        if (match.result.startsWith(team1.name) && player.teamId === team1.id) {
            playerPoints += 3;
        } else if (match.result.startsWith(team2.name) && player.teamId === team2.id) {
            playerPoints += 3;
        }
    }

    return Math.round(playerPoints);
};

export const getPlayerOfTheMatch = (match: Match, allPlayers: Player[], allTeams: Team[]): { player: Player | null, cvp: number } => {
  if (match.status !== 'completed' || !match.result) return { player: null, cvp: 0 };

  const matchPlayerIds = new Set(allPlayers.filter(p => p.teamId === match.team1Id || p.teamId === match.team2Id).map(p => p.id));
  const matchPlayers = allPlayers.filter(p => matchPlayerIds.has(p.id));

  if (matchPlayers.length === 0) return { player: null, cvp: 0 };

  let potm: Player | null = null;
  let maxPoints = -1;

  matchPlayers.forEach(player => {
    const cvp = calculatePlayerCVP(player, match, allPlayers, allTeams);
    if (cvp > maxPoints) {
      maxPoints = cvp;
      potm = player;
    }
  });
  
  if (maxPoints <= 10) return { player: null, cvp: 0 };

  return { player: potm, cvp: maxPoints };
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
                    let playerBatted = false;
                    let runsThisInning = 0;
                    let ballsFacedThisInning = 0;

                    inning.deliveryHistory.forEach(d => {
                        if (d.strikerId === player.id) {
                            playerBatted = true;
                            playedInMatch = true;
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
                        }
                    });

                    if (playerBatted) {
                        inningsBatted++;
                        if (runsThisInning >= 50 && runsThisInning < 100) fifties++;
                        if (runsThisInning >= 100) hundreds++;
                        if (runsThisInning > highestScore) highestScore = runsThisInning;
                        
                        const wasOut = inning.deliveryHistory.some(d => d.isWicket && d.dismissal?.batsmanOutId === player.id);
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
                            let conceded = d.runs;
                            if (d.extra === 'wide' || d.extra === 'noball') conceded += 1;
                            
                            runsConceded += conceded;
                            runsConcededThisInning += conceded;
    
                            if (d.isWicket && d.dismissal?.type !== 'Run out') {
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
