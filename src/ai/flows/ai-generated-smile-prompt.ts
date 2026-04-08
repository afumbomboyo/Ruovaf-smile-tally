'use server';
/**
 * @fileOverview This file implements a Genkit flow for generating a loving prompt or thought.
 *
 * - generateLovingPrompt - A function that triggers the generation of a loving prompt.
 * - GenerateLovingPromptInput - The input type for the generateLovingPrompt function.
 * - GenerateLovingPromptOutput - The return type for the generateLovingPrompt function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateLovingPromptInputSchema = z.object({});
export type GenerateLovingPromptInput = z.infer<typeof GenerateLovingPromptInputSchema>;

const GenerateLovingPromptOutputSchema = z.object({
  prompt: z.string().describe('A short, sweet, loving prompt or thought.'),
});
export type GenerateLovingPromptOutput = z.infer<typeof GenerateLovingPromptOutputSchema>;

export async function generateLovingPrompt(
  input: GenerateLovingPromptInput
): Promise<GenerateLovingPromptOutput> {
  return generateLovingPromptFlow(input);
}

const lovingPrompt = ai.definePrompt({
  name: 'lovingPrompt',
  input: {schema: GenerateLovingPromptInputSchema},
  output: {schema: GenerateLovingPromptOutputSchema},
  prompt: `You are a warm, affectionate, and creative AI assistant.

Generate a short, sweet, and unique loving prompt or thought for a partner to reflect on their affection and find new ways to express it. The prompt should encourage positive reflection or action towards their partner.

Examples:
- What's one small thing you can do today to make your partner smile?
- Recall a moment when your partner made you feel truly loved. What was it about that moment that touched you most?
- Think of a unique quality you adore about your partner. How can you celebrate it today?
- If you could send your partner a loving message in a bottle, what would it say?
- What's a dream or goal your partner has that you can support them with this week?

Your response should be a single, concise prompt.`,
});

const generateLovingPromptFlow = ai.defineFlow(
  {
    name: 'generateLovingPromptFlow',
    inputSchema: GenerateLovingPromptInputSchema,
    outputSchema: GenerateLovingPromptOutputSchema,
  },
  async input => {
    const {output} = await lovingPrompt(input);
    return output!;
  }
);
