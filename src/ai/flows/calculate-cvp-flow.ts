'use server';
/**
 * @fileOverview A Genkit flow for calculating Cricket Value Points (CVP) for a player based on their match performance.
 *
 * - calculateCvp - A function that calculates a player's CVP for a given match.
 * - CalculateCvpInput - The input type for the calculateCvp function.
 * - CalculateCvpOutput - The return type for the calculateCvp function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Input Schema
const CalculateCvpInputSchema = z.object({
  playerId: z.string().describe('The unique identifier of the player.'),
  playerName: z.string().describe('The name of the player.'),
  isInPlayingXI: z.boolean().describe('True if the player was in the playing XI for the match.'),
  batting: z.object({
    runsScored: z.number().describe('Total runs scored by the player.'),
    fours: z.number().describe('Number of fours hit by the player.'),
    sixes: z.number().describe('Number of sixes hit by the player.'),
    ballsFaced: z.number().describe('Total balls faced by the player.'),
  }).describe('Batting performance data.'),
  bowling: z.object({
    wicketsTaken: z.number().describe('Total wickets taken by the player (excluding run-outs).'),
    maidens: z.number().describe('Number of maiden overs bowled by the player.'),
    oversBowled: z.number().describe('Total overs bowled by the player (e.g., 2.3 for 2 overs and 3 balls).'),
    runsConceded: z.number().describe('Total runs conceded by the player while bowling.'),
  }).describe('Bowling performance data.'),
  fielding: z.object({
    catches: z.number().describe('Number of catches taken by the player.'),
    stumpings: z.number().describe('Number of stumpings made by the player.'),
    runOuts: z.number().describe('Number of run-outs effected by the player.'),
  }).describe('Fielding performance data.'),
});
export type CalculateCvpInput = z.infer<typeof CalculateCvpInputSchema>;

// Output Schema
const CalculateCvpOutputSchema = z.object({
  cvpPoints: z.number().describe('The total Cricket Value Points (CVP) calculated for the player.'),
});
export type CalculateCvpOutput = z.infer<typeof CalculateCvpOutputSchema>;

// Wrapper function
export async function calculateCvp(input: CalculateCvpInput): Promise<CalculateCvpOutput> {
  return calculateCvpFlow(input);
}

// Prompt definition
const calculateCvpPrompt = ai.definePrompt({
  name: 'calculateCvpPrompt',
  input: {schema: CalculateCvpInputSchema},
  output: {schema: CalculateCvpOutputSchema},
  prompt: `You are an expert cricket analyst specializing in calculating Cricket Value Points (CVP) for players based on their match performance.\n\nCalculate the total CVP for the player "{{playerName}}" using the following performance data and CVP rules. Respond with a JSON object containing a single key "cvpPoints" with the calculated total CVP points as its value. Do not include any other text or explanation.\n\n---\nCVP Rules:\n\nGeneral:\n- Match Start: +1 point if the player was in the playing XI.\n\nBatting:\n- Runs: 1 Run = 1 Point.\n- Boundary Bonus: +1 extra point for every 4 (Total 5 points for a 4).\n- Six Bonus: +2 extra points for every 6 (Total 8 points for a 6).\n- Strike Rate (Min 10 balls faced):\n    - SR > 170: +6 points.\n    - SR < 50: -2 points.\n    - Strike Rate (SR) = (Runs Scored / Balls Faced) * 100. If Balls Faced is 0, SR is 0 to avoid division by zero.\n\nBowling:\n- Wicket: 15 Points (excluding run-outs).\n- Wicket Milestones:\n    - 2 or 3 Wickets in a match: +4 extra points.\n    - 4 or 5+ Wickets in a match: +10 extra points.\n- Maiden Over: +5 points per maiden.\n- Economy Rate (Min 2 overs bowled):\n    - Econ < 5: +6 points.\n    - Econ 5-6: +4 points.\n    - Econ 10-11: -2 points.\n    - Econ > 12: -4 points.\n    - Economy Rate (Econ) = (Runs Conceded / Overs Bowled). If Overs Bowled is 0, Econ is 0 to avoid division by zero.\n\nFielding:\n- Dismissal (Catch/Stumping/Run-out): 4 points per event.\n---\n\nPlayer Performance Data for "{{playerName}}":\n\n{{#if isInPlayingXI}}\n- Player was in the playing XI. (+1 point)\n{{else}}\n- Player was NOT in the playing XI. (0 points)\n{{/if}}\n\nBatting:\n- Runs Scored: {{batting.runsScored}}\n- Fours: {{batting.fours}}\n- Sixes: {{batting.sixes}}\n- Balls Faced: {{batting.ballsFaced}}\n\nBowling:\n- Wickets Taken (excluding run-outs): {{bowling.wicketsTaken}}\n- Maidens: {{bowling.maidens}}\n- Overs Bowled: {{bowling.oversBowled}}\n- Runs Conceded: {{bowling.runsConceded}}\n\nFielding:\n- Catches: {{fielding.catches}}\n- Stumpings: {{fielding.stumpings}}\n- Run-outs: {{fielding.runOuts}}\n\nCalculate the total CVP points and output it as a JSON object like this: {"cvpPoints": <total_points>}.\n`
});

// Flow definition
const calculateCvpFlow = ai.defineFlow(
  {
    name: 'calculateCvpFlow',
    inputSchema: CalculateCvpInputSchema,
    outputSchema: CalculateCvpOutputSchema,
  },
  async (input) => {
    // Call the prompt with the input data
    const {output} = await calculateCvpPrompt(input);
    if (!output) {
      throw new Error('Failed to calculate CVP: output was null or undefined.');
    }
    return output;
  }
);
