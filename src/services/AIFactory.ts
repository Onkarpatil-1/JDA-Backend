
import dotenv from 'dotenv';
import { OllamaService } from './OllamaService.js';
import { OpenAIService } from './OpenAIService.js';
import { GeminiService } from './GeminiService.js';
import { ClaudeService } from './ClaudeService.js';
import type { AIService } from '../interfaces/AIService.js';

dotenv.config();

export type AIProvider = 'ollama' | 'openai' | 'gemini' | 'claude';

export class AIFactory {
    private static instance: AIFactory;
    private services: Map<AIProvider, AIService> = new Map();

    private constructor() {
        // Initialize default Ollama service
        const ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';
        const ollamaModel = process.env.OLLAMA_MODEL || 'llama3.2:3b';
        this.services.set('ollama', new OllamaService({ host: ollamaHost, model: ollamaModel }));
    }

    public static getInstance(): AIFactory {
        if (!AIFactory.instance) {
            AIFactory.instance = new AIFactory();
        }
        return AIFactory.instance;
    }

    public getService(provider: AIProvider = 'ollama', apiKey?: string): AIService {
        // If apiKey is provided, always create a FRESH instance for this request
        // We do NOT cache these in the singleton map to avoid leaking user keys
        if (apiKey) {
            return this.createServiceInstance(provider, apiKey);
        }

        // Otherwise, use the cached singleton instance (system credentials)
        if (this.services.has(provider)) {
            return this.services.get(provider)!;
        }

        // Lazy initialization of default services
        const service = this.createServiceInstance(provider);
        this.services.set(provider, service);
        return service;
    }

    private createServiceInstance(provider: AIProvider, apiKey?: string): AIService {
        switch (provider) {
            case 'ollama':
                // Ollama doesn't use API keys usually, but we keep signature consistent
                const ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';
                const ollamaModel = process.env.OLLAMA_MODEL || 'llama3.2:3b';
                return new OllamaService({ host: ollamaHost, model: ollamaModel });

            case 'openai':
                const openaiKey = apiKey || process.env.OPENAI_API_KEY;
                if (!openaiKey) throw new Error('OPENAI_API_KEY is not set');
                const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o';
                return new OpenAIService(openaiKey, openaiModel);

            case 'gemini':
                const geminiKey = apiKey || process.env.GEMINI_API_KEY;
                if (!geminiKey) throw new Error('GEMINI_API_KEY is not set');
                const geminiModel = process.env.GEMINI_MODEL || 'gemini-pro';
                return new GeminiService(geminiKey, geminiModel);

            case 'claude':
                const claudeKey = apiKey || process.env.CLAUDE_API_KEY;
                if (!claudeKey) throw new Error('CLAUDE_API_KEY is not set');
                const claudeModel = process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20240620';
                return new ClaudeService(claudeKey, claudeModel);

            default:
                console.warn(`Unknown provider ${provider}, falling back to Ollama`);
                return this.getService('ollama');
        }
    }
}
