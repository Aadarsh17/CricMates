'use server';

/**
 * @fileOverview Generates a short, insightful summary of a match using GenAI.
 *
 * - generateMatchSummary - A function that generates the match summary.
 * - GenerateMatchSummaryInput - The input type for the generateMatchSummary function.
 * - GenerateMatchSummaryOutput - The return type for the generateMatchSummary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateMatchSummaryInputSchema = z.object({
  matchDetails: z
    .string()
    .describe("Detailed match information, including teams, scores, and key events."),
});

export type GenerateMatchSummaryInput = z.infer<typeof GenerateMatchSummaryInputSchema>;

const GenerateMatchSummaryOutputSchema = z.object({
  summary: z.string().describe('A concise summary of the match.'),
});

export type GenerateMatchSummaryOutput = z.infer<typeof GenerateMatchSummaryOutputSchema>;

export async function generateMatchSummary(
  input: GenerateMatchSummaryInput
): Promise<GenerateMatchSummaryOutput> {
  return generateMatchSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateMatchSummaryPrompt',
  input: {schema: GenerateMatchSummaryInputSchema},
  output: {schema: GenerateMatchSummaryOutputSchema},
  prompt: `You are an expert sports commentator. Generate a concise and insightful summary of the cricket match provided below.\n\nMatch Details: {{{matchDetails}}}\n\nSummary: `,
});

const generateMatchSummaryFlow = ai.defineFlow(
  {
    name: 'generateMatchSummaryFlow',
    inputSchema: GenerateMatchSummaryInputSchema,
    outputSchema: GenerateMatchSummaryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
