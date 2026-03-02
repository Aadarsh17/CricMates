
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
  matchesPlayedCount?: number; 
}

/**
 * Calculates CVP for a player based on their match statistics.
 * Returns 0 if no match activity is recorded to ensure 0s show up correctly
 * when history is deleted.
 */
export function calculatePlayerCVP(stats: PlayerMatchStats): number {
  // Check if there is any activity. If no balls faced or bowled and no fielding, return 0.
  const hasActivity = (stats.ballsFaced > 0 || stats.ballsBowled > 0 || stats.catches > 0 || stats.stumpings > 0 || stats.runOuts > 0);
  
  if (!hasActivity) return 0;
  
  let points = 1; // Match Start (Playing XI) bonus for players with activity

  // Batting
  points += (stats.runs || 0);
  points += (stats.fours || 0) * 1;
  points += (stats.sixes || 0) * 2;
  
  if (stats.ballsFaced >= 10) {
    const sr = (stats.runs / stats.ballsFaced) * 100;
    if (sr > 170) points += 6;
    else if (sr < 50) points -= 2;
  }

  // Bowling
  points += (stats.wickets || 0) * 15;
  if (stats.wickets >= 4) points += 10;
  else if (stats.wickets >= 2) points += 4;
  
  points += (stats.maidens || 0) * 5;
  if (stats.ballsBowled >= 12) {
    const overs = stats.ballsBowled / 6;
    const econ = stats.runsConceded / (overs || 1);
    if (econ < 5) points += 6;
    else if (econ <= 6) points += 4;
    else if (econ >= 10 && econ <= 11) points -= 2;
    else if (econ > 12) points -= 4;
  }

  // Fielding
  points += ((stats.catches || 0) + (stats.stumpings || 0) + (stats.runOuts || 0)) * 4;

  return points;
}
