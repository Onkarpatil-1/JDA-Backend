
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AIService } from '../interfaces/AIService.js';
import type { LLMResponse } from '../types/index.js';

export class GeminiService implements AIService {
    private genAI: GoogleGenerativeAI;
    private model: string;
    private defaultTemperature: number;

    constructor(apiKey: string, model: string = 'gemini-pro', temperature: number = 0.3) {
        this.genAI = new GoogleGenerativeAI(apiKey);
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
            const modelInstance = this.genAI.getGenerativeModel({
                model: this.model,
                generationConfig: {
                    temperature: options?.temperature ?? this.defaultTemperature,
                    responseMimeType: options?.format === 'json' ? 'application/json' : 'text/plain',
                }
            });

            let finalPrompt = prompt;
            if (options?.systemPrompt) {
                // Gemini currently handles system prompts via instruction or context in pure generateContent not explicit system role in all versions
                finalPrompt = `System: ${options.systemPrompt}\n\nUser: ${prompt}`;
            }

            const result = await modelInstance.generateContent(finalPrompt);
            const response = result.response;
            const content = response.text();

            const responseTime = Date.now() - startTime;

            return {
                content,
                model: this.model,
                tokensUsed: undefined, // Gemini doesn't always return token usage in simple response
                responseTime,
            };
        } catch (error) {
            console.error('Gemini generation error:', error);
            throw new Error(`Gemini generation failed: ${error}`);
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
            const modelInstance = this.genAI.getGenerativeModel({
                model: this.model,
                generationConfig: {
                    temperature: options?.temperature ?? this.defaultTemperature,
                    responseMimeType: options?.format === 'json' ? 'application/json' : 'text/plain',
                }
            });

            const history = messages.slice(0, -1).map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user', // System role tricky in history, usually mapped to user or stripped
                parts: [{ text: m.content }]
            }));

            const lastMessage = messages[messages.length - 1];

            const chat = modelInstance.startChat({
                history: history,
            });

            const result = await chat.sendMessage(lastMessage.content);
            const response = result.response;
            const content = response.text();

            const responseTime = Date.now() - startTime;

            return {
                content,
                model: this.model,
                tokensUsed: undefined,
                responseTime,
            };
        } catch (error) {
            console.error('Gemini chat error:', error);
            throw new Error(`Gemini chat failed: ${error}`);
        }
    }

    async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; message: string }> {
        try {
            // Simple generation check
            const model = this.genAI.getGenerativeModel({ model: this.model });
            await model.generateContent('Ping');
            return { status: 'healthy', message: 'Gemini API is accessible' };
        } catch (error) {
            return { status: 'unhealthy', message: `Gemini API error: ${error}` };
        }
    }
}
