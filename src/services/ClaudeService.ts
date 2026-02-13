
import Anthropic from '@anthropic-ai/sdk';
import type { AIService } from '../interfaces/AIService.js';
import type { LLMResponse } from '../types/index.js';

export class ClaudeService implements AIService {
    private anthropic: Anthropic;
    private model: string;
    private defaultTemperature: number;

    constructor(apiKey: string, model: string = 'claude-3-5-sonnet-20240620', temperature: number = 0.3) {
        this.anthropic = new Anthropic({ apiKey });
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
            const system = options?.systemPrompt;

            const message = await this.anthropic.messages.create({
                model: this.model,
                max_tokens: 4096,
                temperature: options?.temperature ?? this.defaultTemperature,
                system: system,
                messages: [
                    { role: 'user', content: prompt }
                ]
            });

            const responseTime = Date.now() - startTime;

            // Extract text from content block
            const textBlock = message.content.find(c => c.type === 'text');
            const content = textBlock ? textBlock.text : '';

            return {
                content,
                model: this.model,
                tokensUsed: message.usage.input_tokens + message.usage.output_tokens,
                responseTime,
            };
        } catch (error) {
            console.error('Claude generation error:', error);
            throw new Error(`Claude generation failed: ${error}`);
        }
    }

    async chat(
        messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
        options?: {
            temperature?: number;
            format?: 'json' | 'text';
        }
    ): Promise<LLMResponse> {
        const startTime = Date.now();
        try {
            // Filter out system messages as they go into top-level param
            const systemMessage = messages.find(m => m.role === 'system');
            const chatMessages = messages
                .filter(m => m.role !== 'system')
                .map(m => ({
                    role: m.role as 'user' | 'assistant',
                    content: m.content
                }));

            const message = await this.anthropic.messages.create({
                model: this.model,
                max_tokens: 4096,
                temperature: options?.temperature ?? this.defaultTemperature,
                system: systemMessage?.content,
                messages: chatMessages
            });

            const responseTime = Date.now() - startTime;

            const textBlock = message.content.find(c => c.type === 'text');
            const content = textBlock ? textBlock.text : '';

            return {
                content,
                model: this.model,
                tokensUsed: message.usage.input_tokens + message.usage.output_tokens,
                responseTime,
            };
        } catch (error) {
            console.error('Claude chat error:', error);
            throw new Error(`Claude chat failed: ${error}`);
        }
    }

    async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; message: string }> {
        try {
            // No simple list models, try a tiny generation
            await this.anthropic.messages.create({
                model: this.model,
                max_tokens: 10,
                messages: [{ role: 'user', content: 'Ping' }]
            });
            return { status: 'healthy', message: 'Claude API is accessible' };
        } catch (error) {
            return { status: 'unhealthy', message: `Claude API error: ${error}` };
        }
    }
}
