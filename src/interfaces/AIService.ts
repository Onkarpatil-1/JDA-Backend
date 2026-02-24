
import type { LLMResponse } from '../types/index.js';

export interface AIService {
    generate(
        prompt: string,
        options?: {
            temperature?: number;
            top_p?: number;
            systemPrompt?: string;
            format?: 'json' | 'text';
        }
    ): Promise<LLMResponse>;

    chat(
        messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
        options?: {
            temperature?: number;
            top_p?: number;
            format?: 'json' | 'text';
        }
    ): Promise<LLMResponse>;

    healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; message: string }>;
}
