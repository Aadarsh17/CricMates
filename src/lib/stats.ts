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
    // This calculation is based on the CVP rules for short-form matches (4-8 overs)
    if (match.status !== 'completed' || !match.result) return 0;

    let playerPoints = 0;
    const playerId = player.id;

    // ✅ Participation: +1 point
    if (player.teamId === match.team1Id || player.teamId === match.team2Id) {
        playerPoints += 1;
    }

    match.innings.forEach(inning => {
        // --- 1. Batting, Fielding, and Wicket points (per delivery) ---
        inning.deliveryHistory.forEach(delivery => {
            const { strikerId, bowlerId, runs, isWicket, extra, dismissal } = delivery;

            // 🏏 Batting Points
            if (strikerId === playerId && extra !== 'byes' && extra !== 'legbyes') {
                playerPoints += runs; // +1 per run
                if (runs === 4) playerPoints += 1;
                if (runs === 6) playerPoints += 2;
            }

            // 🎯 Wicket & 🧤 Fielding Points
            if (isWicket && dismissal) {
                if (bowlerId === playerId && dismissal.type !== 'Run out') {
                    playerPoints += 12;
                }
                if (dismissal.fielderId === playerId) {
                    if (dismissal.type === 'Catch out' || dismissal.type === 'Stumping') playerPoints += 6;
                    else if (dismissal.type === 'Run out') playerPoints += 5;
                }
            }
        });

        // --- 2. Inning-level Batting Bonuses ---
        let runsThisInning = 0;
        let ballsFacedThisInning = 0;
        const playerDeliveries = inning.deliveryHistory.filter(d => d.strikerId === playerId);
        if (playerDeliveries.length > 0) {
            playerDeliveries.forEach(d => {
                if (d.extra !== 'byes' && d.extra !== 'legbyes') runsThisInning += d.runs;
                if (d.extra !== 'wide') ballsFacedThisInning++;
            });

            if (ballsFacedThisInning >= 6) {
                const strikeRate = (runsThisInning / ballsFacedThisInning) * 100;
                if (strikeRate >= 220) playerPoints += 5;
                else if (strikeRate >= 180) playerPoints += 3;
            }
            if (inning.score > 0 && (runsThisInning / inning.score) * 100 >= 30) {
                playerPoints += 5;
            }
            const isOut = inning.deliveryHistory.some(d => d.isWicket && d.dismissal?.batsmanOutId === playerId);
            if (!isOut && runsThisInning >= 10) {
                playerPoints += 3;
            }
        }
        
        // --- 3. Over-level Bowling Bonuses ---
        const bowlerDeliveriesInInning = inning.deliveryHistory.filter(d => d.bowlerId === playerId);
        if (bowlerDeliveriesInInning.length > 0) {
            // Per user rule: "Max 1 Over per Bowler" for short matches.
            // We'll calculate stats for the bowler's entire spell in the inning.
            let spellRuns = 0, spellWickets = 0, spellDots = 0, spellBalls = 0;

            bowlerDeliveriesInInning.forEach(d => {
                if (d.extra !== 'wide' && d.extra !== 'noball') {
                    spellBalls++;
                    if (d.runs === 0 && !d.isWicket) spellDots++;
                }
                let conceded = d.runs;
                if (d.extra === 'wide' || d.extra === 'noball') conceded += 1;
                spellRuns += conceded;
                if (d.isWicket && d.dismissal?.type !== 'Run out') {
                    spellWickets++;
                }
            });

            // If bowler bowled 1 over or less, apply these bonuses.
            if (spellBalls <= 6) {
                playerPoints += spellDots;
                if (spellRuns <= 1) playerPoints += 5;
                if (spellWickets >= 2) playerPoints += 6;
            }
        }
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
