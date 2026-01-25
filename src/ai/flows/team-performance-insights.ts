'use server';

/**
 * @fileOverview Generates insights into a team's performance based on match history and points table data.
 *
 * - getTeamPerformanceInsights - A function that returns the performance insights of a team.
 * - TeamPerformanceInsightsInput - The input type for the getTeamPerformanceInsights function.
 * - TeamPerformanceInsightsOutput - The return type for the getTeamPerformanceInsights function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const TeamPerformanceInsightsInputSchema = z.object({
  teamName: z.string().describe('The name of the team to analyze.'),
  matchHistory: z.string().describe('A summary of the team\'s match history.'),
  pointsTable: z.string().describe('The current points table data.'),
});
export type TeamPerformanceInsightsInput = z.infer<typeof TeamPerformanceInsightsInputSchema>;

const TeamPerformanceInsightsOutputSchema = z.object({
  insights: z.string().describe('Insights into the team\'s performance, including strengths, weaknesses, and areas for improvement.'),
});
export type TeamPerformanceInsightsOutput = z.infer<typeof TeamPerformanceInsightsOutputSchema>;

export async function getTeamPerformanceInsights(input: TeamPerformanceInsightsInput): Promise<TeamPerformanceInsightsOutput> {
  return teamPerformanceInsightsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'teamPerformanceInsightsPrompt',
  input: {schema: TeamPerformanceInsightsInputSchema},
  output: {schema: TeamPerformanceInsightsOutputSchema},
  prompt: `You are an expert sports analyst specializing in cricket team performance.

  Analyze the provided match history and points table data to generate insights into the team's performance.
  Identify strengths, weaknesses, and areas for improvement.

  Team Name: {{{teamName}}}
  Match History: {{{matchHistory}}}
  Points Table: {{{pointsTable}}}

  Provide a concise summary of your findings.
`,
});

const teamPerformanceInsightsFlow = ai.defineFlow(
  {
    name: 'teamPerformanceInsightsFlow',
    inputSchema: TeamPerformanceInsightsInputSchema,
    outputSchema: TeamPerformanceInsightsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
