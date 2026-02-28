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
  breakdown: z.string().describe('A brief explanation of how the points were calculated.'),
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
  prompt: `You are an expert cricket analyst specializing in calculating Cricket Value Points (CVP) v1.2.5.

Calculate the total CVP for "{{playerName}}" based on these rules:

General:
- Match Start: +1 point if the player was in the playing XI.

Batting:
- Runs: 1 Run = 1 Point.
- Boundary Bonus: +1 extra point for every 4 (Total 5).
- Six Bonus: +2 extra points for every 6 (Total 8).
- Strike Rate (SR) (Min 10 balls faced):
    - SR > 170: +6 points.
    - SR < 50: -2 points.
    - SR = (Runs Scored / Balls Faced) * 100.

Bowling:
- Wicket: 15 Points (excluding run-outs).
- Wicket Milestones:
    - 2 or 3 Wickets in a match: +4 extra points.
    - 4 or 5+ Wickets in a match: +10 extra points.
- Maiden Over: +5 points per maiden.
- Economy Rate (Econ) (Min 2 overs bowled):
    - Econ < 5: +6 points.
    - Econ 5-6: +4 points.
    - Econ 10-11: -2 points.
    - Econ > 12: -4 points.
    - Econ = (Runs Conceded / Overs Bowled).

Fielding:
- Dismissal (Catch/Stumping/Run-out): 4 points per event.

Player Data for "{{playerName}}":
{{#if isInPlayingXI}} - Playing XI: Yes{{else}} - Playing XI: No{{/if}}
Batting: {{batting.runsScored}} runs, {{batting.fours}}x4, {{batting.sixes}}x6, {{batting.ballsFaced}} balls.
Bowling: {{bowling.wicketsTaken}} wickets, {{bowling.maidens}} maidens, {{bowling.oversBowled}} overs, {{bowling.runsConceded}} runs.
Fielding: {{fielding.catches}} catches, {{fielding.stumpings}} stumpings, {{fielding.runOuts}} run-outs.

Output a JSON object with "cvpPoints" (number) and "breakdown" (string summary).`
});

// Flow definition
const calculateCvpFlow = ai.defineFlow(
  {
    name: 'calculateCvpFlow',
    inputSchema: CalculateCvpInputSchema,
    outputSchema: CalculateCvpOutputSchema,
  },
  async (input) => {
    const {output} = await calculateCvpPrompt(input);
    if (!output) throw new Error('Failed to calculate CVP.');
    return output;
  }
);
