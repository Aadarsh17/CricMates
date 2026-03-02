
/**
 * @fileOverview Utility functions for calculating Cricket Value Points (CVP) based on match performance.
 * Follows v1.2.5 criteria.
 */

export interface PlayerMatchStats {
  id: string;
  name: string;
  runs: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  wickets: number;
  maidens: number;
  ballsBowled: number;
  runsConceded: number;
  catches: number;
  stumpings: number;
  runOuts: number;
  matchesPlayedCount?: number; // Optional count to override start point
}

/**
 * Calculates CVP for a player based on their match statistics.
 * Criteria v1.2.5
 */
export function calculatePlayerCVP(stats: PlayerMatchStats): number {
  // If we have explicit match count and it's 0, return 0.
  // Otherwise, if they've played, they start with 1 point for the XI.
  if (stats.matchesPlayedCount === 0) return 0;
  
  let points = 1; // Match Start (Playing XI)

  // Batting
  points += stats.runs;
  points += stats.fours * 1;
  points += stats.sixes * 2;
  if (stats.ballsFaced >= 10) {
    const sr = (stats.runs / stats.ballsFaced) * 100;
    if (sr > 170) points += 6;
    else if (sr < 50) points -= 2;
  }

  // Bowling
  points += stats.wickets * 15;
  if (stats.wickets >= 4) points += 10;
  else if (stats.wickets >= 2) points += 4;
  points += stats.maidens * 5;
  if (stats.ballsBowled >= 12) {
    const overs = stats.ballsBowled / 6;
    const econ = stats.runsConceded / (overs || 1);
    if (econ < 5) points += 6;
    else if (econ <= 6) points += 4;
    else if (econ >= 10 && econ <= 11) points -= 2;
    else if (econ > 12) points -= 4;
  }

  // Fielding
  points += (stats.catches + stats.stumpings + stats.runOuts) * 4;

  return points;
}
