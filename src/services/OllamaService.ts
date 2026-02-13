import { Ollama } from 'ollama';
import type { OllamaConfig, LLMResponse } from '../types/index.js';
import type { AIService } from '../interfaces/AIService.js';

/**
 * Service class for interacting with Ollama LLM
 */
export class OllamaService implements AIService {
    private ollama: Ollama;
    private model: string;
    private defaultTemperature: number;

    constructor(config: OllamaConfig) {
        this.ollama = new Ollama({ host: config.host });
        this.model = config.model;
        this.defaultTemperature = config.temperature || 0.3; // Lower temp for more consistent outputs
    }

    /**
     * Generate a response from the LLM
     */
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
            const response = await this.ollama.generate({
                model: this.model,
                prompt: prompt,
                system: options?.systemPrompt,
                format: options?.format,
                options: {
                    temperature: options?.temperature ?? this.defaultTemperature,
                },
            });

            const responseTime = Date.now() - startTime;

            return {
                content: response.response,
                model: this.model,
                tokensUsed: response.eval_count,
                responseTime,
            };
        } catch (error) {
            console.error('Ollama generation error:', error);
            throw new Error(`Failed to generate response: ${error}`);
        }
    }

    /**
     * Chat-based interaction (maintains conversation context)
     */
    async chat(
        messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
        options?: {
            temperature?: number;
            format?: 'json' | 'text';
        }
    ): Promise<LLMResponse> {
        const startTime = Date.now();

        try {
            const response = await this.ollama.chat({
                model: this.model,
                messages: messages,
                format: options?.format,
                options: {
                    temperature: options?.temperature ?? this.defaultTemperature,
                },
            });

            const responseTime = Date.now() - startTime;

            return {
                content: response.message.content,
                model: this.model,
                tokensUsed: response.eval_count,
                responseTime,
            };
        } catch (error) {
            console.error('Ollama chat error:', error);
            throw new Error(`Failed to chat: ${error}`);
        }
    }

    /**
     * Check if Ollama is running and model is available
     */
    async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; message: string }> {
        try {
            const models = await this.ollama.list();
            const modelExists = models.models.some((m) => m.name === this.model);

            if (!modelExists) {
                return {
                    status: 'unhealthy',
                    message: `Model ${this.model} not found. Available models: ${models.models.map((m) => m.name).join(', ')}`,
                };
            }

            return {
                status: 'healthy',
                message: `Ollama is running and model ${this.model} is available`,
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                message: `Ollama is not accessible: ${error}`,
            };
        }
    }

    /**
     * Get model information
     */
    async getModelInfo() {
        try {
            const info = await this.ollama.show({ model: this.model });
            return info;
        } catch (error) {
            throw new Error(`Failed to get model info: ${error}`);
        }
    }
}
