'use server';
/**
 * @fileOverview This file implements a Genkit flow to generate a concise, AI-powered summary of a completed cricket match.
 *
 * - generateMatchSummary - A function that generates a match summary based on provided match data.
 * - GenerateMatchSummaryInput - The input type for the generateMatchSummary function.
 * - GenerateMatchSummaryOutput - The return type for the generateMatchSummary function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

/**
 * @deprecated Please use MatchSummaryInput instead.
 */
const GenerateMatchSummaryInputSchema = z.object({
  matchId: z.string().describe('Unique identifier for the match.'),
  matchOverall: z.object({
    date: z.string().describe('The date the match was played (e.g., "YYYY-MM-DD").'),
    totalOversScheduled: z.number().describe('Total overs scheduled for the match.'),
    result: z.string().describe('The final result of the match, e.g., "Team A won by 5 wickets with 10 balls remaining."'),
    team1Name: z.string().describe("Name of Team 1."),
    team2Name: z.string().describe("Name of Team 2."),
    team1FinalScore: z.string().describe("Final score of Team 1 (e.g., '150/5 in 20 overs')."),
    team2FinalScore: z.string().describe("Final score of Team 2 (e.g., '145/8 in 20 overs')."),
    tossWinner: z.string().describe("Name of the team that won the toss."),
    tossDecision: z.string().describe("Decision made by the toss winner ('bat' or 'bowl')."),
  }).describe('Overall match details including final scores and result.'),
  inningsSummaries: z.array(z.object({
    inningNumber: z.number().describe('The inning number (1 or 2).'),
    battingTeamName: z.string().describe('Name of the team batting in this inning.'),
    bowlingTeamName: z.string().describe('Name of the team bowling in this inning.'),
    score: z.number().describe('Total runs scored in this inning.'),
    wickets: z.number().describe('Total wickets lost in this inning.'),
    overs: z.number().describe('Total overs bowled in this inning (e.g., 19.3).'),
    topPerformersBatting: z.array(z.object({
      playerName: z.string(),
      runs: z.number(),
      ballsFaced: z.number().optional(),
      fours: z.number().optional(),
      sixes: z.number().optional(),
      strikeRate: z.number().optional(),
    })).describe('Top 3 batting performances in this inning.'),
    topPerformersBowling: z.array(z.object({
      playerName: z.string(),
      overs: z.number(),
      maidens: z.number(),
      runsConceded: z.number(),
      wickets: z.number(),
      economy: z.number().optional(),
    })).describe('Top 3 bowling performances in this inning.'),
    keyMoments: z.array(z.string()).describe('List of significant events in this inning, e.g., "early wickets fall", "crucial partnership", "late surge".'),
  })).describe('Summary for each individual inning.'),
  playerOverallPerformance: z.array(z.object({
    playerName: z.string().describe("Name of the player."),
    teamName: z.string().describe("Team the player belongs to."),
    role: z.enum(['Batsman', 'Bowler', 'All-rounder']).describe("Player's primary role."),
    cvpScore: z.number().describe('Cricket Value Points earned by the player in this match.'),
    battingStats: z.object({
      runs: z.number(),
      ballsFaced: z.number(),
      strikeRate: z.number(),
      fours: z.number(),
      sixes: z.number(),
    }).optional().describe('Batting statistics for the player if they batted.'),
    bowlingStats: z.object({
      overs: z.number(),
      maidens: z.number(),
      runsConceded: z.number(),
      wickets: z.number(),
      economy: z.number(),
    }).optional().describe('Bowling statistics for the player if they bowled.'),
    fieldingStats: z.object({
      catches: z.number(),
      stumpings: z.number(),
      runOuts: z.number(),
    }).optional().describe('Fielding statistics for the player if they had any dismissals.'),
  })).describe('Overall performance and CVP for all players in the match, sorted by CVP.'),
});
export type GenerateMatchSummaryInput = z.infer<typeof GenerateMatchSummaryInputSchema>;

const GenerateMatchSummaryOutputSchema = z.string().describe('A concise, AI-generated summary of the cricket match.');
export type GenerateMatchSummaryOutput = z.infer<typeof GenerateMatchSummaryOutputSchema>;

export async function generateMatchSummary(input: GenerateMatchSummaryInput): Promise<GenerateMatchSummaryOutput> {
  return generateMatchSummaryFlow(input);
}

const generateMatchSummaryPrompt = ai.definePrompt({
  name: 'generateMatchSummaryPrompt',
  input: { schema: GenerateMatchSummaryInputSchema },
  output: { schema: GenerateMatchSummaryOutputSchema },
  prompt: `You are an experienced and engaging cricket commentator and analyst. Your task is to provide a concise, narrative summary of a completed cricket match based on the provided statistics and key events.

Focus on the overall match flow, significant turning points, standout individual performances, and the ultimate outcome. Mention players with high Cricket Value Points (CVP) as particularly impactful.

Match Details:
Date: {{{matchOverall.date}}}
Match between: {{{matchOverall.team1Name}}} vs {{{matchOverall.team2Name}}}
Toss: {{{matchOverall.tossWinner}}} won the toss and chose to {{{matchOverall.tossDecision}}}.
Result: {{{matchOverall.result}}}
Final Score: {{{matchOverall.team1Name}}} scored {{{matchOverall.team1FinalScore}}}, and {{{matchOverall.team2Name}}} scored {{{matchOverall.team2FinalScore}}}.

Match Narrative:

{{#each inningsSummaries}}
### Inning {{inningNumber}} ({{battingTeamName}} batting)
- Score: {{score}}/{{wickets}} in {{overs}} overs.
- Key Moments:
{{#each keyMoments}}- {{{this}}}
{{/each}}
- Top Batting:
{{#each topPerformersBatting}}- {{{playerName}}} ({{runs}}{{^}}){{/}} runs{{#if ballsFaced}} from {{ballsFaced}} balls{{/if}}{{#if fours}} ({{fours}}x4, {{sixes}}x6){{/if}}
{{/each}}
- Top Bowling:
{{#each topPerformersBowling}}- {{{playerName}}} ({{wickets}} wickets for {{runsConceded}} runs in {{overs}} overs{{#if maidens}}, {{maidens}} maiden{{/if}})
{{/each}}

{{/each}}

Player of the Match Candidates / Key Performers (by CVP):
{{#each playerOverallPerformance}}
- {{{playerName}}} ({{{teamName}}}): CVP Score: {{cvpScore}}
{{#if battingStats.runs}}  - Batting: {{battingStats.runs}} runs ({{battingStats.ballsFaced}} balls, SR {{battingStats.strikeRate}})
{{/if}}
{{#if bowlingStats.wickets}}  - Bowling: {{bowlingStats.wickets}} wickets for {{bowlingStats.runsConceded}} runs in {{bowlingStats.overs}} overs (Econ {{bowlingStats.economy}})
{{/if}}
{{#if fieldingStats.catches}}  - Fielding: {{fieldingStats.catches}} catches{{#if fieldingStats.stumpings}}, {{fieldingStats.stumpings}} stumpings{{/if}}{{#if fieldingStats.runOuts}}, {{fieldingStats.runOuts}} run-outs{{/if}}
{{/if}}
{{/each}}

Based on the above data, write a compelling and concise match summary that highlights the drama, key performances, and the ultimate story of the game. Keep it under 300 words.
`,
});

const generateMatchSummaryFlow = ai.defineFlow(
  {
    name: 'generateMatchSummaryFlow',
    inputSchema: GenerateMatchSummaryInputSchema,
    outputSchema: GenerateMatchSummaryOutputSchema,
  },
  async (input) => {
    const { output } = await generateMatchSummaryPrompt(input);
    return output!;
  }
);
