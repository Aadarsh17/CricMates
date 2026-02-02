
'use server';
/**
 * @fileOverview AI Flow to generate a match summary for a completed cricket match.
 *
 * - generateMatchSummary - A function that calls the AI flow to summarize match data.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const MatchSummaryInputSchema = z.object({
  team1Name: z.string(),
  team2Name: z.string(),
  scorecardData: z.string().describe('A detailed string representation of the match scorecard including innings, runs, wickets, and top performers.'),
  result: z.string().optional(),
});

export type MatchSummaryInput = z.infer<typeof MatchSummaryInputSchema>;

const MatchSummaryOutputSchema = z.object({
  narrative: z.string().describe('A 2-3 paragraph professional sports narrative of the match.'),
  keyMoments: z.array(z.string()).describe('A list of 3-5 key moments or turning points from the match.'),
  verdict: z.string().describe('A one-sentence punchy summary of the match.'),
});

export type MatchSummaryOutput = z.infer<typeof MatchSummaryOutputSchema>;

const matchSummaryPrompt = ai.definePrompt({
  name: 'matchSummaryPrompt',
  input: { schema: MatchSummaryInputSchema },
  output: { schema: MatchSummaryOutputSchema },
  prompt: `You are an expert cricket commentator and analyst. 
  Generate a professional match summary based on the following scorecard data.
  
  Teams: {{{team1Name}}} vs {{{team2Name}}}
  Result: {{#if result}}{{{result}}}{{else}}Match in progress or result not yet finalized.{{/if}}
  
  Scorecard Data:
  {{{scorecardData}}}
  
  Include insights on team strategies, individual brilliance, and how the match unfolded. Keep the tone engaging and professional.`,
});

const summaryFlow = ai.defineFlow(
  {
    name: 'matchSummaryFlow',
    inputSchema: MatchSummaryInputSchema,
    outputSchema: MatchSummaryOutputSchema,
  },
  async (input) => {
    const { output } = await matchSummaryPrompt(input);
    if (!output) throw new Error('Failed to generate summary');
    return output;
  }
);

export async function generateMatchSummary(input: MatchSummaryInput): Promise<MatchSummaryOutput> {
  // Always call the flow instance, never redefine it inside the action
  return summaryFlow(input);
}
