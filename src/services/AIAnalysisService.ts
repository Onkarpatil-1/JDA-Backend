
import type { ProjectStatistics, AIInsights } from '../types/index.js';
import type { AIService } from '../interfaces/AIService.js';
import {
    createAnomalyAnalysisPrompt,
    createBottleneckPredictionPrompt,
    createTabularInsightsPrompt,
    createRecommendationsPrompt,
    createRemarkAnalysisPrompt,
    createJDAAnalysisPrompt
} from '../config/promptBuilders.js';

import type { JDAIntelligence } from '../types/index.js';

import { AIFactory, type AIProvider } from './AIFactory.js';

/**
 * Service for AI-powered analysis of SLA data
 */
export class AIAnalysisService {
    private aiFactory: AIFactory;

    constructor() {
        this.aiFactory = AIFactory.getInstance();
    }

    /**
     * Generate comprehensive AI analysis for a project
     */
    async analyzeProjectData(statistics: ProjectStatistics, projectName: string, provider: AIProvider = 'ollama', apiKey?: string): Promise<AIInsights> {
        console.log(`🤖 Generating AI insights using ${provider}... ${apiKey ? '(Custom Key Provided)' : '(System Credentials)'}`);

        let aiService = this.aiFactory.getService(provider, apiKey);

        // Fallback mechanism
        const performAnalysis = async (currentService: any): Promise<AIInsights> => {
            // Run analyses in parallel for speed
            // Run critical analyses first
            const [anomalyAnalysis, bottleneckAnalysis, recommendations, tabularInsights] = await Promise.all([
                this.analyzeAnomalies(statistics, projectName, currentService),
                this.analyzeBottlenecks(statistics, currentService),
                this.generateRecommendations(statistics, currentService),
                this.generateTabularInsights(statistics, currentService)
            ]);

            // Run deep remark analysis legally AFTER to avoid resource contention (Ollama context switching)
            const remarkAnalysis = await this.analyzeRemarks(statistics, currentService);

            // JDA Intelligence Hybrid Analysis
            let jdaIntelligence = statistics.jdaHierarchy;
            if (jdaIntelligence) {
                jdaIntelligence = await this.analyzeJDARemarks(jdaIntelligence, currentService);
            }

            console.log('✅ AI insights generated');

            return {
                anomalyPatterns: anomalyAnalysis.patterns,
                rootCause: anomalyAnalysis.rootCause,
                predictions: bottleneckAnalysis.predictions,
                recommendations: recommendations,
                severity: this.calculateSeverity(statistics),
                confidence: 0.85,
                ...tabularInsights,
                remarkAnalysis, // Add to result
                jdaIntelligence // Add JDA hierarchy
            };
        };

        try {
            return await performAnalysis(aiService);
        } catch (error: any) {
            // Check if we can fallback to Ollama
            if (provider !== 'ollama') {
                console.warn(`⚠️ ${provider} analysis failed (${error.message}). Falling back to local Ollama model...`);
                aiService = this.aiFactory.getService('ollama');
                try {
                    return await performAnalysis(aiService);
                } catch (fallbackError) {
                    console.error('❌ Fallback Ollama analysis also failed:', fallbackError);
                    throw fallbackError;
                }
            } else {
                throw error;
            }
        }
    }

    /**
     * Analyze JDA Remarks using Hybrid Approach
     */
    private async analyzeJDARemarks(hierarchy: JDAIntelligence, aiService: AIService): Promise<JDAIntelligence> {
        console.log('🏛️ Running JDA Hybrid Analysis...');

        // We need to iterate deep but limit concurrent LLM calls
        // Strategy: Collect all "High Value" tickets first
        const ticketsToAnalyze: {
            deptIdx: number;
            pServiceIdx: number;
            serviceIdx: number;
            ticketIdx: number;
            context: any
        }[] = [];

        hierarchy.departments.forEach((dept, dIdx) => {
            dept.parentServices.forEach((pService, pIdx) => {
                pService.services.forEach((service, sIdx) => {
                    service.tickets.forEach((ticket, tIdx) => {
                        // Criteria for LLM Analysis:
                        // 1. Uncategorized by Rule Engine
                        // 2. High Delay (> 7 days)
                        // 3. Very short/ambiguous remark (optional)
                        if (ticket.detectedCategory === 'Uncategorized' || ticket.daysRested > 7) {
                            ticketsToAnalyze.push({
                                deptIdx: dIdx,
                                pServiceIdx: pIdx,
                                serviceIdx: sIdx,
                                ticketIdx: tIdx,
                                context: {
                                    serviceName: service.name,
                                    role: ticket.stepOwnerRole,
                                    remarks: ticket.remarkOriginal
                                }
                            });
                        }
                    });
                });
            });
        });

        console.log(`🔍 Identified ${ticketsToAnalyze.length} tickets for Deep LLM Analysis`);

        // Process in batches of 5 to avoid timeouts but speed up
        const BATCH_SIZE = 5;
        for (let i = 0; i < ticketsToAnalyze.length; i += BATCH_SIZE) {
            const batch = ticketsToAnalyze.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(async (item) => {
                try {
                    const prompt = createJDAAnalysisPrompt(item.context);
                    const response = await aiService.generate(prompt);
                    const content = response.content;

                    try {
                        const parsed = this.cleanAndParseJSON(content);
                        if (parsed) {
                            // Update the specific ticket in hierarchy
                            const ticket = hierarchy.departments[item.deptIdx]
                                .parentServices[item.pServiceIdx]
                                .services[item.serviceIdx]
                                .tickets[item.ticketIdx];

                            ticket.remarkEnglishSummary = parsed.englishSummary || ticket.remarkOriginal;
                            ticket.detectedCategory = parsed.category || ticket.detectedCategory;
                        }
                    } catch (parseError) {
                        console.warn(`JSON Parse Warning for ticket ${item.ticketIdx}:`, parseError);
                    }
                } catch (e) {
                    console.warn(`Failed LLM analysis for ticket at index ${item.ticketIdx}`, e);
                }
            }));
        }

        return hierarchy;
    }

    /**
     * Analyze anomalies using LLM
     */
    private async analyzeAnomalies(statistics: ProjectStatistics, projectName: string, aiService: AIService): Promise<{
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
            projectName,
            totalTickets: statistics.totalTickets,
            totalWorkflowSteps: statistics.totalWorkflowSteps,
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

        const response = await aiService.generate(prompt);
        const responseText = response.content;

        // Parse response
        const patterns = this.extractSection(responseText, 'PATTERNS:');
        const rootCause = this.extractSection(responseText, 'ROOT CAUSE:');

        return { patterns, rootCause };
    }

    /**
     * Analyze bottlenecks and predict future issues
     */
    private async analyzeBottlenecks(statistics: ProjectStatistics, aiService: AIService): Promise<{
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

        const response = await aiService.generate(prompt);
        const predictions = response.content.replace(/^PREDICTION:\s*/i, '').trim();

        return { predictions };
    }

    /**
     * Generate tabular insights for efficiency and risks
     */
    private async generateTabularInsights(statistics: ProjectStatistics, aiService: AIService): Promise<{
        employeeEfficiencyTable: string;
        zoneEfficiencyTable: string;
        breachRiskTable: string;
        highPriorityTable: string;
        behavioralRedFlagsTable: string;
    }> {
        // Filter out "APPLICANT" or "CITIZEN" from top performers to avoid confusion
        const topPerformersStr = statistics.topPerformers
            .filter(p => !['APPLICANT', 'CITIZEN', 'SYSTEM', 'UNKNOWN'].includes(p.name.toUpperCase()) && !['APPLICANT', 'CITIZEN'].includes(p.role.toUpperCase()))
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
            topPerformers: topPerformersStr || "No specific employee data available.",
            behavioralRedFlags: behaviorStr,
            zonePerformance: zonePerfStr,
            riskApplications: riskAppsStr
        });

        const response = await aiService.generate(prompt);
        const content = response.content;

        console.log('--- AI RAW TABULAR RESPONSE START ---');
        console.log(content);
        console.log('--- AI RAW TABULAR RESPONSE END ---');

        const employeeTable = this.extractSection(content, '[PART_EMPLOYEE]');
        console.log('Extracted Employee Table Length:', employeeTable.length);

        return {
            employeeEfficiencyTable: employeeTable,
            zoneEfficiencyTable: this.extractSection(content, '[PART_ZONE]'),
            breachRiskTable: this.extractSection(content, '[PART_BREACH]'),
            highPriorityTable: this.extractSection(content, '[PART_PRIORITY]'),
            behavioralRedFlagsTable: this.extractSection(content, '[PART_RED_FLAGS]')
        };
    }

    /**
     * Generate actionable recommendations
     */
    private async generateRecommendations(statistics: ProjectStatistics, aiService: AIService): Promise<string[]> {
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

        const response = await aiService.generate(prompt);

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
     * Analyze remarks for process gaps and forceful delays
     */
    private async analyzeRemarks(statistics: ProjectStatistics, aiService: AIService): Promise<{
        processGaps: string[];
        painPoints: string[];
        forcefulDelays: Array<{
            ticketId: string;
            employeeName: string;
            reason: string;
            confidence: number;
            category: string;
            recommendation: string;
        }>;
        sentimentSummary: string;
        primaryDelayCategory?: string;
    } | undefined> {
        // Find high risk applications with remarks
        const riskyAppsWithRemarks = statistics.riskApplications
            .filter(a => a.remarks && a.remarks.length > 10)
            .slice(0, 5); // Analyze top 5 instead of just 1

        if (riskyAppsWithRemarks.length === 0) return undefined;

        const allForcefulDelays: any[] = [];
        const allProcessGaps: Set<string> = new Set();
        const allPainPoints: Set<string> = new Set();
        let aggregatedSentiment = "";
        let primaryCategoryCounts: Record<string, number> = {};

        // Run sequential to avoid Ollama overload
        for (const targetApp of riskyAppsWithRemarks) {
            const prompt = createRemarkAnalysisPrompt({
                ticketId: targetApp.id,
                flowType: 'High Delay',
                conversationHistory: targetApp.remarks || 'No remarks available',
                totalDelay: targetApp.delay,
                employeeName: targetApp.lastActionBy || 'Unknown',
                stage: targetApp.role
            });

            try {
                const response = await aiService.generate(prompt);
                const content = response.content;

                try {
                    const parsed = this.cleanAndParseJSON(content);

                    if (parsed) {
                        if (parsed.forcefulDelays) {
                            const enrichedDelays = parsed.forcefulDelays.map((d: any) => ({
                                category: 'Uncategorized',
                                recommendation: 'Review case manually',
                                ...d,
                                ticketId: targetApp.id,
                                employeeName: targetApp.lastActionBy || 'Unknown'
                            }));
                            allForcefulDelays.push(...enrichedDelays);
                        }

                        if (parsed.processGaps) {
                            parsed.processGaps.forEach((gap: string) => allProcessGaps.add(gap));
                        }

                        if (parsed.painPoints) {
                            parsed.painPoints.forEach((point: string) => allPainPoints.add(point));
                        }

                        if (parsed.primaryDelayCategory) {
                            primaryCategoryCounts[parsed.primaryDelayCategory] = (primaryCategoryCounts[parsed.primaryDelayCategory] || 0) + 1;
                        }

                        if (!aggregatedSentiment) aggregatedSentiment = parsed.sentimentSummary;
                    }
                } catch (parseError) {
                    console.warn(`JSON Parse Warning for remark analysis ticket ${targetApp.id}:`, parseError);
                }
            } catch (e) {
                console.error(`Failed to analyze remarks for ticket ${targetApp.id}:`, e);
            }
        }

        // Determine dominant category
        const dominantCategory = Object.entries(primaryCategoryCounts)
            .sort((a, b) => b[1] - a[1])[0]?.[0] || "Mixed Issues";

        return {
            processGaps: Array.from(allProcessGaps),
            painPoints: Array.from(allPainPoints),
            forcefulDelays: allForcefulDelays,
            sentimentSummary: `Analyzed ${riskyAppsWithRemarks.length} critical cases. Dominant issue: ${dominantCategory}. Example sentiment: ${aggregatedSentiment}`,
            primaryDelayCategory: dominantCategory
        };
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
     * Robust JSON parser for LLM responses
     */
    private cleanAndParseJSON(content: string): any {
        // 1. Remove markdown code blocks
        let clean = content.replace(/```json/g, '').replace(/```/g, '').trim();

        // 2. Find outer JSON object/array bounds
        const firstOpenBrace = clean.indexOf('{');
        const firstOpenBracket = clean.indexOf('[');

        // Determine start and end
        let startIdx = -1;

        if (firstOpenBrace !== -1 && (firstOpenBracket === -1 || firstOpenBrace < firstOpenBracket)) {
            startIdx = firstOpenBrace;
        } else if (firstOpenBracket !== -1) {
            startIdx = firstOpenBracket;
        }

        if (startIdx !== -1) {
            clean = clean.substring(startIdx);
            // We don't strictly enforce end index here to handle truncation logic later
            // But we do want to strip trailing non-json text if possible
            const lastClose = Math.max(clean.lastIndexOf('}'), clean.lastIndexOf(']'));
            if (lastClose !== -1 && lastClose > 0) {
                // only substring if it looks complete-ish, otherwise keeps it flexible for closing logic
                clean = clean.substring(0, lastClose + 1);
            }
        } else {
            return null;
        }

        // 3. Helper to try parsing
        const tryParse = (str: string) => {
            try {
                return JSON.parse(str);
            } catch (e) {
                return null;
            }
        };

        // Attempt 1: Direct parse
        let parsed = tryParse(clean);
        if (parsed) return parsed;

        // 4. Repairs
        try {
            let fixed = clean;

            // Fix 0: Handle unescaped measurement quotes (e.g. 50'x80")
            // Regex: Digit followed by " followed by non-comma/brace/bracket
            fixed = fixed.replace(/(\d)"(?=[^,}\]])/g, '$1\\"');

            // Fix 1: Remove trailing commas
            fixed = fixed.replace(/,(\s*[}\]])/g, '$1');

            // Fix 2: Add missing commas between array strings
            fixed = fixed.replace(/"\s+(?=")/g, '", "');

            // Fix 3: Add missing commas between objects
            fixed = fixed.replace(/}\s+{/g, '}, {');

            // Fix 4: Add missing commas between arrays
            fixed = fixed.replace(/]\s+\[/g, '], [');

            // Fix 5: Numeric/boolean missing commas
            fixed = fixed.replace(/([0-9]|true|false|null)\s+(?=")/g, '$1, ');

            // Fix 6: Duplicate commas
            fixed = fixed.replace(/,\s*,/g, ',');

            // Fix 7: Convert single-quoted values to double-quoted (e.g., "key": 'value' -> "key": "value")
            // This regex matches: : followed by whitespace, then ' then captured content then '
            // careful not to match if it's already mixed or complex
            fixed = fixed.replace(/:\s*'([^']*)'/g, ': "$1"');

            parsed = tryParse(fixed);
            if (parsed) return parsed;

            // Attempt 5: Relaxed Parsing (Function constructor)
            // Same security check
            const dangerousKeywords = ['process', 'require', 'import', 'global', 'window', 'eval', 'function', '=>', 'class'];
            const hasDanger = dangerousKeywords.some(kw => fixed.includes(kw));

            if (!hasDanger) {
                try {
                    const relaxedParse = new Function('return (' + fixed + ')');
                    return relaxedParse();
                } catch (eRelaxed) {
                    // Try one more thing: Close truncated JSON
                    // Count braces/brackets
                    const openBraces = (fixed.match(/{/g) || []).length;
                    const closeBraces = (fixed.match(/}/g) || []).length;
                    const openBrackets = (fixed.match(/\[/g) || []).length;
                    const closeBrackets = (fixed.match(/]/g) || []).length;

                    let closingStr = '';
                    // If we are inside a string (odd number of quotes), close it
                    const quoteCount = (fixed.match(/"/g) || []).length; // rough check
                    if (quoteCount % 2 !== 0) closingStr += '"';

                    // simplistic closing strategy: just add enough } and ]
                    // This is imperfect because order matters, but often safeguards a partial result
                    if (openBrackets > closeBrackets) closingStr += ']'.repeat(openBrackets - closeBrackets);
                    if (openBraces > closeBraces) closingStr += '}'.repeat(openBraces - closeBraces);

                    if (closingStr) {
                        try {
                            const closedParsed = new Function('return (' + fixed + closingStr + ')');
                            return closedParsed();
                        } catch (eClosed) { }
                    }
                }
            }

            // Final Fallback: Regex Extraction for critical fields
            // If main parse fails, try to just regex out the "englishSummary" or "processGaps"
            const fallbackObj: any = {};
            const summaryMatch = clean.match(/"englishSummary"\s*:\s*"([^"]+)"/);
            if (summaryMatch) fallbackObj.englishSummary = summaryMatch[1];

            const categoryMatch = clean.match(/"category"\s*:\s*"([^"]+)"/);
            if (categoryMatch) fallbackObj.category = categoryMatch[1];

            if (Object.keys(fallbackObj).length > 0) return fallbackObj;

            throw new Error(`Failed to repair JSON`);
        } catch (e2) {
            console.warn(`JSON Repair Failed. Original: ${clean.substring(0, 100)}...`);
            throw new Error(`JSON Parse Failed: ${e2 instanceof Error ? e2.message : String(e2)}`);
        }
    }

    /**
     * Extract section from LLM response
     */
    private extractSection(response: string, sectionName: string): string {
        // Strict extraction for Markdown headers (## PART_NAME)
        // matches "## PART_NAME" followed by content until next "## PART_"
        const cleanName = sectionName.replace(/[\[\]]/g, '');

        // Regex:
        // 1. (?:##|\*\*|\[)\s*      -> Match starting ##, **, or [
        // 2. ${cleanName}          -> Match PART_NAME
        // 3. (?:\]|\*\*)?          -> Optional closing ], **
        // 4. \s*                   -> Whitespace
        // 5. ([\s\S]*?)            -> Content
        // 6. (?=\s*(?:##|\*\*|\[)\s*PART_|$) -> Lookahead
        const regex = new RegExp(`(?:##|\\*\\*|\\[)\\s*${cleanName}(?:\\]|\\*\\*)?\\s*([\\s\\S]*?)(?=\\s*(?:##|\\*\\*|\\[)\\s*PART_|$)`, 'i');

        const match = response.match(regex);
        return match ? match[1].trim() : "";
    }
}
