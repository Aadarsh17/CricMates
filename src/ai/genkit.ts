
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

/**
 * Centralized Genkit instance initialized with the Google AI plugin.
 */
export const ai = genkit({
  plugins: [googleAI()],
});
