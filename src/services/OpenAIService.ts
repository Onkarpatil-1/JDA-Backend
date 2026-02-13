
import OpenAI from 'openai';
import type { AIService } from '../interfaces/AIService.js';
import type { LLMResponse } from '../types/index.js';

export class OpenAIService implements AIService {
    private openai: OpenAI;
    private model: string;
    private defaultTemperature: number;

    constructor(apiKey: string, model: string = 'gpt-4o', temperature: number = 0.3) {
        this.openai = new OpenAI({ apiKey });
        this.model = model;
        this.defaultTemperature = temperature;
    }

    async generate(
        prompt: string,
        options?: {
            temperature?: number;
            systemPrompt?: string;
            format?: 'json' | 'text';
        }
    ): Promise<LLMResponse> {
        const startTime = Date.now();
        try {
            const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
            if (options?.systemPrompt) {
                messages.push({ role: 'system', content: options.systemPrompt });
            }
            messages.push({ role: 'user', content: prompt });

            const completion = await this.openai.chat.completions.create({
                model: this.model,
                messages,
                temperature: options?.temperature ?? this.defaultTemperature,
                response_format: options?.format === 'json' ? { type: 'json_object' } : undefined,
            });

            const responseTime = Date.now() - startTime;
            const content = completion.choices[0]?.message?.content || '';

            return {
                content,
                model: this.model,
                tokensUsed: completion.usage?.total_tokens,
                responseTime,
            };
        } catch (error) {
            console.error('OpenAI generation error:', error);
            throw new Error(`OpenAI generation failed: ${error}`);
        }
    }


    // Overload specifically for chat to handle array of messages
    async chatInternal(
        messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
        options?: { temperature?: number; format?: 'json' | 'text' }
    ): Promise<LLMResponse> {
        const startTime = Date.now();
        try {
            // Map our generic roles to OpenAI specific roles
            const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = messages.map(m => ({
                role: m.role as 'user' | 'assistant' | 'system',
                content: m.content
            }));

            const completion = await this.openai.chat.completions.create({
                model: this.model,
                messages: openaiMessages,
                temperature: options?.temperature ?? this.defaultTemperature,
                response_format: options?.format === 'json' ? { type: 'json_object' } : undefined,
            });

            const responseTime = Date.now() - startTime;
            return {
                content: completion.choices[0]?.message?.content || '',
                model: this.model,
                tokensUsed: completion.usage?.total_tokens,
                responseTime,
            };
        } catch (error) {
            console.error('OpenAI chat error:', error);
            throw new Error(`OpenAI chat failed: ${error}`);
        }
    }

    async chat(
        messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
        options?: { temperature?: number; format?: 'json' | 'text' }
    ): Promise<LLMResponse> {
        return this.chatInternal(messages, options);
    }

    async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; message: string }> {
        try {
            await this.openai.models.list();
            return { status: 'healthy', message: 'OpenAI API is accessible' };
        } catch (error) {
            return { status: 'unhealthy', message: `OpenAI API error: ${error}` };
        }
    }
}
