import { AIAnalysisService } from './AIAnalysisService.js';
import { ProjectService } from './ProjectService.js';
import type { ForensicAnalysis, ZoneOutlierReport } from '../types/index.js';
import { AIFactory, type AIProvider } from './AIFactory.js';

/**
 * Main service for SLA Intelligence operations
 */
export class SLAIntelligenceService {
    private aiFactory: AIFactory;
    private projectService?: ProjectService;

    constructor(projectService?: ProjectService) {
        this.aiFactory = AIFactory.getInstance();
        this.projectService = projectService;
    }


    /**
     * General query interface for custom questions
     */
    async query(question: string, context?: Record<string, any>, provider: AIProvider = 'ollama', apiKey?: string): Promise<string> {
        const contextStr = context ? `\n\nContext: ${JSON.stringify(context, null, 2)}` : '';
        const prompt = `${question}${contextStr}`;

        const aiService = this.aiFactory.getService(provider, apiKey);

        const response = await aiService.generate(prompt, {
            systemPrompt: 'You are an expert SLA monitoring assistant. Provide clear, concise answers.',
            temperature: 0.5,
        });

        return response.content;
    }

    /**
     * Analyze raw text for playground
     */
    async analyzeText(text: string, provider: AIProvider = 'ollama', apiKey?: string): Promise<ForensicAnalysis | undefined> {
        const aiAnalysisService = new AIAnalysisService();
        const aiService = this.aiFactory.getService(provider, apiKey);
        return aiAnalysisService.analyzeGenericRemarks(text, aiService);
    }

    /**
     * Generate Zone-Wise Outlier Report for JDA leadership
     */
    async generateZoneOutlierReport(
        projectId: string,
        workflowSteps: any[],
        provider: AIProvider = 'ollama',
        apiKey?: string
    ): Promise<ZoneOutlierReport> {
        const aiAnalysisService = new AIAnalysisService();
        return aiAnalysisService.generateZoneOutlierReport(projectId, workflowSteps, provider, apiKey);
    }
}
