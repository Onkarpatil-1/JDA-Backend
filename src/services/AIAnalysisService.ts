import { OllamaService } from './OllamaService.js';
import type { ProjectStatistics, AIInsights } from '../types/index.js';

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

        const prompt = `You are an expert SLA workflow analyst. Analyze these specific anomalies and performance data:

Project Statistics:
- Total Anomalies: ${statistics.anomalyCount}
- Average Processing Time: ${statistics.avgDaysRested.toFixed(1)} days
- Max Processing Time: ${statistics.maxDaysRested} days
- Standard Deviation: ${statistics.stdDaysRested.toFixed(1)} days

Top Performing Employees:
${topPerformersStr || 'None identified'}

High-Risk Applications & Services:
${highRiskAppsStr || 'None identified'}

Critical Bottleneck:
- Role: ${statistics.criticalBottleneck?.role || 'None'}
- Cases: ${statistics.criticalBottleneck?.cases || 0}
- Average Delay: ${statistics.criticalBottleneck?.avgDelay?.toFixed(1) || 0} days

Task: Identify common patterns and suggest a specific root cause. 
IMPORTANT: 
- Use actual names of employees, services, and roles.
- NO preamble or conversational filler.
- PATTERNS: Max 3 bullet points, 15 words each.
- ROOT CAUSE: Max 1 punchy sentence.
- Use bold markdown for key names.

Format:
PATTERNS: [Bullet list]
ROOT CAUSE: [Punchy sentence]`;

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

        const prompt = `You are an expert SLA workflow predictor. Predict future bottlenecks based on this data:

Current Metrics:
- Completion Rate: ${statistics.completionRate.toFixed(1)}%
- Critical Bottleneck: ${statistics.criticalBottleneck?.role || 'None'}
- Threshold Exceeded: ${statistics.criticalBottleneck?.thresholdExceeded || 0}%

Zone Performance:
${statistics.zonePerformance.slice(0, 3).map((z, i) =>
            `- ${z.name}: ${z.avgTime.toFixed(1)} days avg time`
        ).join('\n')}

Role/Dept Performance:
${statistics.deptPerformance.slice(0, 3).map((d, i) =>
            `- ${d.name}: ${d.avgTime.toFixed(1)} days avg wait`
        ).join('\n')}

Specific At-Risk Cases:
${highRiskAppsStr}

Task: Predict likely bottlenecks in the next 30 days. 
IMPORTANT: 
- Max 2 bullet points.
- Use names of services, zones, and roles.
- Be extremely blunt and direct.

PREDICTION:`;

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

        const prompt = `You are a Senior SLA Diagnostic Auditor. Your goal is to find the LOGICAL REASON for delays and identify INTERNAL RED FLAGS where employees may be forcefully delaying tickets.
 
Employee Context:
${topPerformersStr}

Behavioral Red Flags (Data-Detected):
${behaviorStr || 'No obvious behavioral anomalies detected.'}

Zone Context:
${zonePerfStr}

Detailed At-Risk Applications (with History):
${riskAppsStr}

Task: Generate 5 diagnostic tables. 
CRITICAL: Analyze the remarks. If a ticket is stuck, look at the last remark to determine the "Root Constraint". 
DETECT FORCEFUL DELAYS: If an employee uses the same generic remark (e.g., "Verification Pending") repeatedly for most of their cases, flag this as a "Forceful Delay Pattern".

IMPORTANT: Use markdown table syntax. Be highly analytical. 
- Use EXACTLY these tags to start sections: [PART_EMPLOYEE], [PART_ZONE], [PART_BREACH], [PART_PRIORITY], [PART_RED_FLAGS].
- DO NOT BOLD the tags.
- SEARCH FOR HUMAN NAMES: Look inside 'FULL DATA' and 'Remarks' to find actual names of citizens or officers. 
- MULTILINGUAL SUPPORT: Remarks may contain a mixture of languages. Interpret them and provide final summary in English.
- STOP USING GENERIC IDs: Never use 'User_170' or 'APPLICANT' as a name if a real human name is present.
- CLARIFY 'APPLICANT' STATUS: If with 'APPLICANT', use actual citizen name and note 'Citizen Action Pending'.
- Keep tables concise (max 5-7 rows each). Wrap each table in its respective header.

Format:
[PART_EMPLOYEE]
[table]

[PART_ZONE]
[table]

[PART_BREACH]
[table]

[PART_PRIORITY]
[table]

[PART_RED_FLAGS]
[table] (Columns: Entity, Red Flag Type, Evidence, AI Verdict on Intent)
`;

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

        const prompt = `You are an SLA workflow optimization expert. Suggest 3 specific, actionable recommendations:

Current Data Points:
- Anomaly Count: ${statistics.anomalyCount}
- Average Time: ${statistics.avgDaysRested.toFixed(1)} days
- Critical Bottleneck: ${statistics.criticalBottleneck?.role || 'None'} (${statistics.criticalBottleneck?.avgDelay?.toFixed(1) || 0} days avg)
- Top Performers: ${performersStr}
- Primary Zones: ${statistics.zonePerformance.slice(0, 2).map(z => z.name).join(', ')}

Task: Provide 3 concrete recommendations. 
IMPORTANT:
- Max 10 words per recommendation.
- Use action verbs.
- Mention specific roles/zones.

Format:
1. [Recommendation]
2. [Recommendation]
3. [Recommendation]`;

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
