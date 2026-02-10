import { OllamaService } from './OllamaService.js';
import type { ProjectStatistics, AIInsights } from '../types/index.js';
import {
    createAnomalyAnalysisPrompt,
    createBottleneckPredictionPrompt,
    createTabularInsightsPrompt,
    createRecommendationsPrompt
} from '../prompts/analysis.js';

/**
 * AI-powered analysis service using LLM for intelligent insights
 */
export class AIAnalysisService {
    constructor(private ollamaService: OllamaService) { }

    /**
     * Generate AI-powered insights from statistical analysis
     */
    async analyzeProjectData(statistics: ProjectStatistics, projectName: string): Promise<AIInsights> {
        console.log('🤖 Generating AI insights...');

        // Run analyses in parallel for speed
        const [anomalyAnalysis, bottleneckAnalysis, recommendations, tabularInsights] = await Promise.all([
            this.analyzeAnomalies(statistics),
            this.analyzeBottlenecks(statistics),
            this.generateRecommendations(statistics),
            this.generateTabularInsights(statistics)
        ]);

        console.log('✅ AI insights generated');

        return {
            anomalyPatterns: anomalyAnalysis.patterns,
            rootCause: anomalyAnalysis.rootCause,
            predictions: bottleneckAnalysis.predictions,
            recommendations: recommendations,
            severity: this.calculateSeverity(statistics),
            confidence: 0.85,
            ...tabularInsights
        };
    }

    /**
     * Analyze anomalies using LLM
     */
    private async analyzeAnomalies(statistics: ProjectStatistics): Promise<{
        patterns: string;
        rootCause: string;
    }> {
        // Prepare context with names
        const topPerformersStr = statistics.topPerformers
            .map(p => `- ${p.name} (${p.role}): ${p.tasks} tasks, ${p.avgTime} days avg`)
            .join('\n');

        const highRiskAppsStr = statistics.riskApplications
            .slice(0, 5)
            .map(a => `- Ticket ${a.id}: ${a.service} (${a.role}) - ${a.delay} days delay`)
            .join('\n');

        const prompt = createAnomalyAnalysisPrompt({
            anomalyCount: statistics.anomalyCount,
            avgProcessingTime: statistics.avgDaysRested.toFixed(1),
            maxProcessingTime: statistics.maxDaysRested,
            stdDev: statistics.stdDaysRested.toFixed(1),
            topPerformers: topPerformersStr,
            highRiskApps: highRiskAppsStr,
            bottleneckRole: statistics.criticalBottleneck?.role || 'None',
            bottleneckCases: statistics.criticalBottleneck?.cases || 0,
            bottleneckAvgDelay: statistics.criticalBottleneck?.avgDelay?.toFixed(1) || '0'
        });

        const response = await this.ollamaService.generate(prompt);
        const responseText = response.content;

        // Parse response
        const patterns = this.extractSection(responseText, 'PATTERNS:');
        const rootCause = this.extractSection(responseText, 'ROOT CAUSE:');

        return { patterns, rootCause };
    }

    /**
     * Analyze bottlenecks and predict future issues
     */
    private async analyzeBottlenecks(statistics: ProjectStatistics): Promise<{
        predictions: string;
    }> {
        const highRiskAppsStr = statistics.riskApplications
            .slice(0, 5)
            .map(a => `- ${a.service} (Ticket ${a.id}) in ${a.zone}: ${a.delay} days delay`)
            .join('\n');

        const prompt = createBottleneckPredictionPrompt({
            completionRate: statistics.completionRate.toFixed(1),
            bottleneckRole: statistics.criticalBottleneck?.role || 'None',
            thresholdExceeded: statistics.criticalBottleneck?.thresholdExceeded || 0,
            zonePerformance: statistics.zonePerformance.slice(0, 3).map((z, i) =>
                `- ${z.name}: ${z.avgTime.toFixed(1)} days avg time`
            ).join('\n'),
            deptPerformance: statistics.deptPerformance.slice(0, 3).map((d, i) =>
                `- ${d.name}: ${d.avgTime.toFixed(1)} days avg wait`
            ).join('\n'),
            highRiskApps: highRiskAppsStr
        });

        const response = await this.ollamaService.generate(prompt);
        const predictions = response.content.replace(/^PREDICTION:\s*/i, '').trim();

        return { predictions };
    }

    /**
     * Generate tabular insights for efficiency and risks
     */
    private async generateTabularInsights(statistics: ProjectStatistics): Promise<{
        employeeEfficiencyTable: string;
        zoneEfficiencyTable: string;
        breachRiskTable: string;
        highPriorityTable: string;
        behavioralRedFlagsTable: string;
    }> {
        const topPerformersStr = statistics.topPerformers
            .map(p => `- ${p.name} (${p.role}): ${p.tasks} tasks, ${p.avgTime} days avg`)
            .join('\n');

        const zonePerfStr = statistics.zonePerformance
            .map(z => `- ${z.name}: ${z.onTime}% on-time, ${z.avgTime} days avg`)
            .join('\n');

        const riskAppsStr = statistics.riskApplications
            .slice(0, 7)
            .map(a => {
                // Filter out empty or duplicate fields from rawRow to save tokens
                const cleanRow = Object.entries(a.rawRow || {})
                    .filter(([_, v]) => v && v !== '' && v !== '0')
                    .reduce((obj, [k, v]) => ({ ...obj, [k]: v }), {});

                return `- Ticket ${a.id}: ${a.service} (${a.zone}), ${a.delay}d delay. 
                  FULL DATA: ${JSON.stringify(cleanRow)}. 
                  Last Action: "${a.remarks || 'No remarks provided'}"`;
            })
            .join('\n');

        const behaviorStr = statistics.behaviorMetrics.redFlags
            .map(f => `- [${f.type}] ${f.entity}: ${f.evidence}`)
            .join('\n');

        const prompt = createTabularInsightsPrompt({
            topPerformers: topPerformersStr,
            behavioralRedFlags: behaviorStr,
            zonePerformance: zonePerfStr,
            riskApplications: riskAppsStr
        });

        const response = await this.ollamaService.generate(prompt);
        const content = response.content;

        console.log('--- AI RAW TABULAR RESPONSE ---');
        console.log(content);
        console.log('-------------------------------');

        return {
            employeeEfficiencyTable: this.extractSection(content, '[PART_EMPLOYEE]'),
            zoneEfficiencyTable: this.extractSection(content, '[PART_ZONE]'),
            breachRiskTable: this.extractSection(content, '[PART_BREACH]'),
            highPriorityTable: this.extractSection(content, '[PART_PRIORITY]'),
            behavioralRedFlagsTable: this.extractSection(content, '[PART_RED_FLAGS]')
        };
    }

    /**
     * Generate actionable recommendations
     */
    private async generateRecommendations(statistics: ProjectStatistics): Promise<string[]> {
        const performersStr = statistics.topPerformers
            .slice(0, 3)
            .map(p => p.name)
            .join(', ');

        const prompt = createRecommendationsPrompt({
            anomalyCount: statistics.anomalyCount,
            avgProcessingTime: statistics.avgDaysRested.toFixed(1),
            bottleneckRole: statistics.criticalBottleneck?.role || 'None',
            bottleneckAvgDelay: statistics.criticalBottleneck?.avgDelay?.toFixed(1) || '0',
            topPerformers: performersStr,
            primaryZones: statistics.zonePerformance.slice(0, 2).map(z => z.name).join(', ')
        });

        const response = await this.ollamaService.generate(prompt);

        // Extract numbered recommendations
        const recommendations = response.content
            .split('\n')
            .filter((line: string) => /^\d+\./.test(line.trim()))
            .map((line: string) => line.replace(/^\d+\.\s*/, '').trim())
            .filter((rec: string) => rec.length > 0)
            .slice(0, 3);

        // Fallback if parsing fails
        if (recommendations.length === 0) {
            return [
                'Analyze top performer workflows to identify best practices for others',
                `Redirect low-complexity tickets in ${statistics.zonePerformance[0]?.name || 'key zones'} to improve throughput`,
                `Investigate the specific delay causes in the ${statistics.criticalBottleneck?.role || 'bottleneck'} role`
            ];
        }

        return recommendations;
    }

    /**
     * Calculate overall severity level
     */
    private calculateSeverity(statistics: ProjectStatistics): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
        const anomalyRate = (statistics.anomalyCount / statistics.totalTickets) * 100;
        const completionRate = statistics.completionRate;
        const avgDelay = statistics.avgDaysRested;

        if (anomalyRate > 20 || completionRate < 70 || avgDelay > 30) {
            return 'CRITICAL';
        } else if (anomalyRate > 10 || completionRate < 85 || avgDelay > 15) {
            return 'HIGH';
        } else if (anomalyRate > 5 || completionRate < 95 || avgDelay > 7) {
            return 'MEDIUM';
        }
        return 'LOW';
    }

    /**
     * Extract section from LLM response
     */
    private extractSection(response: string, sectionName: string): string {
        // More robust extraction using regex to handle potential markdown bolding or extra spaces
        const escapedName = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(?:\\*\\*|__)??${escapedName}(?:\\*\\*|__)??\\s*(.*?)(?=\\s*(?:\\*\\*|__)??\\[PART_|$)`, 'is');

        const match = response.match(regex);
        return match ? match[1].trim() : "";
    }
}
