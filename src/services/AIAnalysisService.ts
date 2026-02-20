
import type { ProjectStatistics, AIInsights, TimeSeriesData, ForensicAnalysis } from '../types/index.js';
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
    private progressService?: any;

    constructor() {
        this.aiFactory = AIFactory.getInstance();
    }

    public setProgressService(service: any) {
        this.progressService = service;
    }

    private logProgress(stage: string, progress: number, details?: string) {
        if (this.progressService) {
            this.progressService.updateProgress(stage, progress, details);
        }
    }

    /**
     * Generate comprehensive AI analysis for a project
     */
    async analyzeProjectData(statistics: ProjectStatistics, projectName: string, provider: AIProvider = 'ollama', apiKey?: string, workflowSteps: any[] = []): Promise<AIInsights> {
        console.log(`🤖 Generating AI insights using ${provider}... ${apiKey ? '(Custom Key Provided)' : '(System Credentials)'}`);
        this.logProgress('Initializing AI', 10, `Booting ${provider} model...`);

        let aiService = this.aiFactory.getService(provider, apiKey);

        // Fallback mechanism
        const performAnalysis = async (currentService: any): Promise<AIInsights> => {
            // Run analyses SEQUENTIALLY to prevent Ollama overload/overheating

            // 1. Anomaly Analysis
            this.logProgress('Analyzing Anomalies', 20, 'Detecting statistical outliers and patterns...');
            const anomalyAnalysis = await this.analyzeAnomalies(statistics, projectName, currentService);

            // 2. Bottleneck Analysis
            this.logProgress('Predicting Bottlenecks', 40, 'Forecasting future congestion points...');
            const bottleneckAnalysis = await this.analyzeBottlenecks(statistics, currentService);

            // 3. Recommendations
            this.logProgress('Generating Strategies', 60, 'Formulating efficiency improvements...');
            const recommendations = await this.generateRecommendations(statistics, currentService);

            // 4. Tabular Insights
            this.logProgress('Structuring Insights', 75, 'Compiling performance matrices...');
            const tabularInsights = await this.generateTabularInsights(statistics, currentService);

            // Run deep remark analysis legally AFTER to avoid resource contention (Ollama context switching)
            this.logProgress('Analyzing Remarks', 85, 'Reading unstructured officer comments...');
            // Pass workflowSteps for deep forensic history reconstruction
            const { remarkAnalysis, forensicReports } = await this.analyzeRemarks(statistics, currentService, workflowSteps);

            // JDA Intelligence Hybrid Analysis
            let jdaIntelligence = statistics.jdaHierarchy;
            if (jdaIntelligence) {
                this.logProgress('Deep JDA Analysis', 90, 'Applying domain-specific reasoning to tickets...');
                jdaIntelligence = await this.analyzeJDARemarks(jdaIntelligence, currentService);
            }

            console.log('✅ AI insights generated');
            this.logProgress('Finalizing', 100, 'Analysis complete.');

            return {
                anomalyPatterns: anomalyAnalysis.patterns,
                rootCause: anomalyAnalysis.rootCause,
                predictions: bottleneckAnalysis.predictions,
                recommendations: recommendations,
                severity: this.calculateSeverity(statistics),
                confidence: 0.85,
                ...tabularInsights,
                remarkAnalysis, // Add to result (single, for backward compat)
                forensicReports, // Add forensic reports map (NEW)
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

        // Process in smaller batches to avoid timeouts and overheating
        const BATCH_SIZE = 2; // Reduced from 5
        const DELAY_MS = 1000; // 1 second cooldown between batches

        const totalBatches = Math.ceil(ticketsToAnalyze.length / BATCH_SIZE);

        for (let i = 0; i < ticketsToAnalyze.length; i += BATCH_SIZE) {
            const currentBatch = Math.floor(i / BATCH_SIZE) + 1;
            this.logProgress('Deep JDA Reasoning', 90 + Math.floor((currentBatch / totalBatches) * 9), `Reasoning on batch ${currentBatch}/${totalBatches}...`);

            const batch = ticketsToAnalyze.slice(i, i + BATCH_SIZE);
            if (i > 0) await new Promise(resolve => setTimeout(resolve, DELAY_MS)); // Cooling period

            await Promise.all(batch.map(async (item) => {
                try {
                    const prompt = createJDAAnalysisPrompt(item.context);
                    const response = await aiService.generate(prompt);
                    const content = response.content;

                    console.log(`--- JDA ANALYSIS RESPONSE (Ticket ${item.ticketIdx}) ---`);
                    console.log(content);
                    console.log('--- END JDA RESPONSE ---');

                    try {
                        const parsed = this.cleanAndParseJSON(content);

                        if (parsed) {
                            console.log(`--- PARSED JDA OBJECT (Ticket ${item.ticketIdx}) ---`);
                            console.log(JSON.stringify(parsed, null, 2));
                        }
                        if (parsed) {
                            // Update the specific ticket in hierarchy
                            const ticket = hierarchy.departments[item.deptIdx]
                                .parentServices[item.pServiceIdx]
                                .services[item.serviceIdx]
                                .tickets[item.ticketIdx];

                            ticket.remarkEnglishSummary = parsed.englishSummary || ticket.remarkOriginal;
                            ticket.employeeAnalysis = parsed.employeeAnalysis || parsed.englishSummary || "Analysis pending...";
                            ticket.applicantAnalysis = parsed.applicantAnalysis || "No specific applicant feedback detected.";
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

        console.log('--- ANOMALY ANALYSIS RAW RESPONSE (FULL) ---');
        console.log(responseText);
        console.log('--- END RAW RESPONSE ---');

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

        console.log('--- BOTTLENECK ANALYSIS RAW RESPONSE (FULL) ---');
        console.log(response.content);
        console.log('--- END RAW RESPONSE ---');

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

        console.log('--- RECOMMENDATIONS RAW RESPONSE (FULL) ---');
        console.log(response.content);
        console.log('--- END RAW RESPONSE ---');

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
     * Now focuses on a Deep Forensic Analysis of the single most critical ticket
     */
    private async analyzeRemarks(statistics: ProjectStatistics, aiService: AIService, workflowSteps: any[] = []): Promise<{
        remarkAnalysis?: {
            employeeRemarkAnalysis: {
                summary: string;
                totalEmployeeRemarks: number;
                keyActions: string[];
                responseTimeliness: string;
                communicationClarity: string;
                inactionFlags: Array<{
                    observation: string;
                    evidence: string;
                }>;
            };
            applicantRemarkAnalysis: {
                summary: string;
                totalApplicantRemarks: number;
                keyActions: string[];
                responseTimeliness: string;
                sentimentTrend: string;
                complianceLevel: string;
            };
            delayAnalysis: {
                primaryDelayCategory: string;
                primaryCategoryConfidence: number;
                categorySummary: string;
                allApplicableCategories: Array<{
                    category: string;
                    confidence: number;
                    reasoning: string;
                }>;
                processGaps: string[];
                painPoints: string[];
                forcefulDelays: Array<{
                    reason: string;
                    confidence: number;
                    category: string;
                    evidence: string;
                    recommendation: string;
                }>;
            };
            sentimentSummary: string;
            ticketInsightSummary: string;
        };
        forensicReports: Record<string, any>;
    }> {
        // Extract unique tickets from workflowSteps and calculate delays
        const ticketMap = new Map<string, any[]>();

        // Group workflow steps by ticket ID
        for (const step of workflowSteps) {
            if (step.ticketId) {
                if (!ticketMap.has(step.ticketId)) {
                    ticketMap.set(step.ticketId, []);
                }
                ticketMap.get(step.ticketId)!.push(step);
            }
        }

        const validTickets: any[] = [];

        // Calculate metadata and delay for each ticket
        for (const [ticketId, steps] of ticketMap) {
            // Find application date (usually in first few steps) and delivery date (usually in last steps)
            const appDateStep = steps.find(s => s.rawRow?.['ApplicationDate'] && s.rawRow?.['ApplicationDate'] !== 'NULL');
            const delDateStep = steps.find(s => s.rawRow?.['DeliverdOn'] && s.rawRow?.['DeliverdOn'] !== 'NULL');

            let delay = 0;
            const appDateStr = appDateStep?.rawRow?.['ApplicationDate'];
            const deliveredDateStr = delDateStep?.rawRow?.['DeliverdOn'];

            if (appDateStr && deliveredDateStr) {
                try {
                    const [appMonth, appDay, appYear] = appDateStr.split('/').map(Number);
                    const [delMonth, delDay, delYear] = deliveredDateStr.split('/').map(Number);
                    const start = new Date(appYear, appMonth - 1, appDay);
                    const end = new Date(delYear, delMonth - 1, delDay);
                    delay = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                } catch (e) {
                    console.warn(`Failed to calculate delay for ticket ${ticketId}`);
                }
            }

            const lastStep = steps[steps.length - 1];

            // Analyzed ALL tickets as per user request (No delay filter)
            validTickets.push({
                id: ticketId,
                delay: delay,
                service: lastStep.serviceName || 'Unknown Service',
                parentService: lastStep.parentServiceName || lastStep.serviceName || 'Unknown',
                stage: lastStep.post || 'Unknown Stage',
                lastActionBy: lastStep.employeeName || 'Unknown'
            });
        }

        // Sort by delay descending first, then ID
        const tickets = validTickets.sort((a, b) => b.delay - a.delay || a.id.localeCompare(b.id));

        if (tickets.length === 0) {
            console.log('⚠️ No tickets found for forensic analysis');
            return { forensicReports: {} };
        }

        // Analyze ALL tickets (User Request)
        const targetTickets = tickets;

        console.log(`🕵️ Running Forensic Analysis on ALL ${targetTickets.length} ticket(s)`);

        // Generate forensic reports for all target tickets
        const forensicReports: Record<string, any> = {};

        let processedCount = 0;
        for (const ticket of targetTickets) {
            processedCount++;
            console.log(`\n🔍 Analyzing Ticket ${ticket.id} (${processedCount}/${targetTickets.length})...`);

            // Add delay to prevent Ollama overload/degradation
            if (processedCount > 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            const analysis = await this.runForensicAnalysisForTicket(ticket, workflowSteps, aiService);
            if (analysis) {
                forensicReports[ticket.id] = analysis;
                console.log(`✅ Forensic analysis complete for ticket ${ticket.id}`);
            } else {
                console.warn(`⚠️ Failed to generate forensic analysis for ticket ${ticket.id}`);
            }
        }


        // Return both formats: single remarkAnalysis (backward compat) + forensicReports map
        return {
            remarkAnalysis: forensicReports[targetTickets[0]?.id], // First ticket for backward compatibility
            forensicReports
        };
    }

    /**
     * Run forensic analysis for a single ticket
     */
    private async runForensicAnalysisForTicket(
        ticket: { id: string; delay: number; service: string; parentService: string; stage: string; lastActionBy: string },
        workflowSteps: any[],
        aiService: AIService
    ): Promise<{
        employeeRemarkAnalysis: any;
        applicantRemarkAnalysis: any;
        delayAnalysis: any;
        sentimentSummary: string;
        ticketInsightSummary: string;
    } | undefined> {
        // Reconstruct Full Conversation History from workflowSteps
        let conversationHistory = 'No remarks available';
        const ticketSteps = workflowSteps.filter(s => s.ticketId === ticket.id);

        if (ticketSteps.length > 0) {
            // USER DIRECTED: Following natural CSV sequence instead of sorting by time
            // which can be ambiguous with JDA's various time formats.
            console.log(`📊 Processing ${ticketSteps.length} workflow steps for ticket ${ticket.id} in CSV order`);

            // Format for AI Analysis - exactly as debug script
            conversationHistory = ticketSteps.map((step) => {
                const remarksField = (step.lifetimeRemarks || '').trim();
                const remarksFromField = (step.lifetimeRemarksFrom || '').trim();
                const date = step.rawRow?.['MaxEventTimeStamp'] || 'Unknown Date';

                // Note: Debug script doesn't explicitly filter empty fields in the map, but we keep our check?
                // Actually debug script DOES NOT filter empty fields in the map, it just returns the string.
                // But let's keep the filter(Boolean) from the original service to be safe, or remove it if we want EXACT replication.
                // Debug script:
                // return `[${date}] lifetimeRemarksFrom: "${remarksFromField.replace(/"/g, "'")}" | lifetimeRemarks: "${remarksField.replace(/"/g, "'")}"`;

                return `[${date}] lifetimeRemarksFrom: "${remarksFromField.replace(/"/g, "'")}" | lifetimeRemarks: "${remarksField.replace(/"/g, "'")}"`;
            }).join('\n'); // Debug script joins directly

            console.log(`📝 Reconstructed and sorted ${ticketSteps.length} history entries for ticket ${ticket.id}`);
            console.log(`TYPE CHECK: workflowSteps[0] keys: ${Object.keys(workflowSteps[0] || {}).join(', ')}`);
            console.log(`HISTORY PREVIEW: ${conversationHistory.substring(0, 200)}...`);
        }

        const prompt = createRemarkAnalysisPrompt({
            ticketId: ticket.id,
            flowType: ticket.service,
            flowTypeParent: ticket.parentService,
            conversationHistory: conversationHistory,
            totalDelay: ticket.delay,
            employeeName: ticket.lastActionBy || 'Unknown',
            stage: ticket.stage
        });

        // Add explicit file logging for user diagnostics
        try {
            const fs = require('fs');
            const logPath = require('path').join(process.cwd(), 'ai_io.log');
            const logEntry = `\n\n================================================================================\n` +
                `TICKET ID: ${ticket.id} | TIME: ${new Date().toISOString()}\n` +
                `--------------------------- INPUT (PROMPT) ------------------------------------\n` +
                `${prompt}\n` +
                `================================================================================\n`;
            fs.appendFileSync(logPath, logEntry);
        } catch (e) {
            console.error('Failed to log AI input to file:', e);
        }

        try {
            const response = await aiService.generate(prompt);
            const content = response.content;

            console.log(`--- FORENSIC ANALYSIS RAW RESPONSE (Ticket ${ticket.id}) ---`);
            console.log(content); // Print FULL content
            console.log('--- END RAW RESPONSE ---');

            // Add explicit file logging for user diagnostics
            try {
                const fs = require('fs');
                const logPath = require('path').join(process.cwd(), 'ai_io.log');
                const logEntry = `--------------------------- OUTPUT (RAW RESPONSE) ------------------------------\n` +
                    `${content}\n` +
                    `================================================================================\n`;
                fs.appendFileSync(logPath, logEntry);
            } catch (e) {
                console.error('Failed to log AI output to file:', e);
            }

            const parsed = this.cleanAndParseJSON(content);

            // Accept partial responses - llama3.2:3b sometimes generates incomplete JSON
            if (parsed) {
                if (parsed.employeeRemarkAnalysis) {
                    console.log(`✅ Forensic analysis parsed successfully for ticket ${ticket.id}`);
                    return {
                        employeeRemarkAnalysis: parsed.employeeRemarkAnalysis,
                        applicantRemarkAnalysis: parsed.applicantRemarkAnalysis || {
                            summary: "No applicant remarks available",
                            totalApplicantRemarks: 0,
                            keyActions: [],
                            responseTimeliness: "N/A",
                            sentimentTrend: "Neutral",
                            complianceLevel: "Unknown"
                        },
                        delayAnalysis: {
                            primaryDelayCategory: "Unknown",
                            primaryCategoryConfidence: 0,
                            categorySummary: "Analysis incomplete",
                            allApplicableCategories: [],
                            processGaps: [],
                            painPoints: [],
                            forcefulDelays: [],
                            ...(parsed.delayAnalysis || {}),
                            documentClarityAnalysis: (parsed.delayAnalysis?.documentClarityAnalysis) || {
                                documentClarityProvided: false,
                                documentNames: []
                            }
                        },
                        sentimentSummary: parsed.sentimentSummary || "Analysis complete.",
                        ticketInsightSummary: parsed.ticketInsightSummary || "Detailed forensic analysis of the critical path."
                    };
                } else if (parsed.summary || parsed.rootCause || parsed.delayAnalysis || parsed.sentimentSummary || parsed.ticketInsightSummary || parsed.englishSummary || parsed.employeeAnalysis) {
                    // Check if it's a FLAT response (Common Fallback for smaller models)
                    console.log(`⚠️ Forensic analysis parsed as FLAT object for ticket ${ticket.id} - adapting structure`);
                    return {
                        employeeRemarkAnalysis: {
                            summary: parsed.summary || parsed.employeeAnalysis || parsed.englishSummary || "Analysis derived from flat response",
                            totalEmployeeRemarks: 0,
                            keyActions: parsed.keyActions || [],
                            responseTimeliness: "Unknown",
                            communicationClarity: "Unknown",
                            inactionFlags: []
                        },
                        applicantRemarkAnalysis: {
                            summary: "No applicant remarks available",
                            totalApplicantRemarks: 0,
                            keyActions: [],
                            responseTimeliness: "N/A",
                            sentimentTrend: "Neutral",
                            complianceLevel: "Unknown"
                        },
                        delayAnalysis: {
                            primaryDelayCategory: parsed.primaryDelayCategory || "Unknown",
                            primaryCategoryConfidence: 0,
                            categorySummary: parsed.categorySummary || "Analysis incomplete",
                            allApplicableCategories: [],
                            processGaps: parsed.processGaps || [],
                            painPoints: parsed.painPoints || [],
                            forcefulDelays: parsed.forcefulDelays || [],
                            ...(parsed.delayAnalysis || {}),
                            documentClarityAnalysis: (parsed.delayAnalysis?.documentClarityAnalysis) || {
                                documentClarityProvided: false,
                                documentNames: []
                            }
                        },
                        sentimentSummary: parsed.sentimentSummary || "Analysis complete.",
                        ticketInsightSummary: parsed.ticketInsightSummary || parsed.summary || "Detailed forensic analysis of the critical path."
                    };
                }
                console.warn(`⚠️ valid JSON parsed but missing required forensic fields for ticket ${ticket.id}`);
                return undefined;
            }
        } catch (e) {
            console.error(`Failed to analyze remarks for ticket ${ticket.id}:`, e);
            return undefined;
        }
    }

    /**
     * Analyze generic remarks (for Playground)
     */
    public async analyzeGenericRemarks(conversationHistory: string, aiService: AIService): Promise<ForensicAnalysis | undefined> {
        let formattedHistory = conversationHistory;

        // Pre-process: If generic text (not already formatted), try to format as specific fields for the prompt
        // This handles Copy-Paste from Excel (Tab separated)
        if (!conversationHistory.includes('lifetimeRemarksFrom')) {
            formattedHistory = conversationHistory.split('\n').map(line => {
                if (!line.trim()) return '';

                // Handle Excel Copy-Paste (Tab Separated)
                const parts = line.split('\t');
                if (parts.length >= 2) {
                    const p0 = parts[0]?.trim() || '';
                    const p1 = parts[1]?.trim() || '';

                    // Smart Detection: detailed heuristics to find which column is Source
                    let source = 'Unknown Source';
                    let content = '';

                    // Heuristic 0: Empty columns. If one is missing, the other is likely Content.
                    if (!p0 && p1) {
                        return `Source: Unknown Source\nContent: ${p1}\n`;
                    }
                    if (p0 && !p1) {
                        return `Source: Unknown Source\nContent: ${p0}\n`;
                    }

                    // Heuristic 1: Look for "Source-like" keywords
                    const sourceKeywords = ['notification', 'reply', 'applicant', 'employee', 'jda', 'official', 'case closed', 'demand'];
                    const p0Lower = p0.toLowerCase();
                    const p1Lower = p1.toLowerCase();

                    const p0IsSource = sourceKeywords.some(k => p0Lower.includes(k));
                    const p1IsSource = sourceKeywords.some(k => p1Lower.includes(k));

                    // Heuristic 2: Length (Source is usually shorter than content)
                    const p0Short = p0.length < 60;
                    const p1Short = p1.length < 60;

                    // Decision Logic
                    if (p0IsSource && !p1IsSource) {
                        source = p0;
                        content = p1;
                    } else if (p1IsSource && !p0IsSource) {
                        source = p1;
                        content = p0;
                    } else if (p0Short && !p1Short) {
                        // assume shorter one is source if lengths vary significantly
                        source = p0;
                        content = p1;
                    } else if (p1Short && !p0Short) {
                        source = p1;
                        content = p0;
                    } else {
                        // Ambiguous/Default: User's latest screenshot shows Col 0 = Source-like, Col 1 = Content
                        // But headers are LifeTimeRemarks (0) and LifeTimeRemarksFrom (1).
                        // Let's assume the user's latest paste format: Col 0 = Source, Col 1 = Content
                        source = p0;
                        content = p1;
                    }

                    // If source is empty but content exists, assume p1 was content and p0 was empty source
                    if (!source && content) {
                        // Check again if we mapped correctly. 
                        // If p0 was empty, it naturally falls into `source = p0` if p1 is long.
                        // We just label it Unknown if empty.
                        source = 'Unknown Source';
                    }

                    return `Source: ${source || 'Unknown Source'}\nContent: ${content}\n`;
                }

                // Fallback for raw text: Attempt heuristic classification to help the LLM
                let source = "Unknown Source";
                const lower = line.toLowerCase();
                if (lower.startsWith('applicant') || lower.startsWith('citizen') || lower.startsWith('reply')) {
                    source = "Reply from Applicant";
                } else if (lower.startsWith('employee') || lower.startsWith('jda') || lower.startsWith('notification') || lower.startsWith('official')) {
                    source = "Notification sent to applicant";
                }

                return `Source: ${source}\nContent: ${line.trim()}\n`;
            }).join('\n');
        }

        // Use the centralized prompt template
        const { REMARK_ANALYSIS_USER_PROMPT } = await import('../prompts/templates.js');
        const { interpolate } = await import('../utils/promptUtils.js');

        const promptContext = {
            ticketId: 'PLAYGROUND-DEMO',
            flowType: 'Generic Request',
            flowTypeParent: 'General',
            stage: 'Forensic Review',
            totalDelay: '0', // Playground default
            conversationHistory: formattedHistory
        };

        const advancedPrompt = interpolate(REMARK_ANALYSIS_USER_PROMPT, promptContext);


        try {
            const response = await aiService.generate(advancedPrompt, {
                systemPrompt: 'You are a forensic data auditor. Output valid JSON only.',
                temperature: 0.3
            });

            console.log(`[Playground] Raw AI Response: ${response.content.substring(0, 100)}...`);

            // DEBUG: Write raw response to file
            try {
                const fs = await import('fs');
                fs.writeFileSync('playground_debug.log', `PROMPT: \n${advancedPrompt}\n\nRESPONSE: \n${response.content}`);
            } catch (err) {
                console.error('Failed to write debug log', err);
            }

            const parsed = this.cleanAndParseJSON(response.content);

            // Verify if analysis is meaningful (not empty)
            const isAnalysisEmpty = !parsed || (
                (parsed.employeeRemarkAnalysis?.summary === "" || parsed.employeeRemarkAnalysis?.totalEmployeeRemarks === 0) &&
                (parsed.applicantRemarkAnalysis?.summary === "" || parsed.applicantRemarkAnalysis?.totalApplicantRemarks === 0)
            );

            if (isAnalysisEmpty) {
                console.log('[Playground] Advanced prompt returned empty analysis. Retrying with simplified prompt...');

                const fallbackPrompt = `
You are a forensic auditor.Analyze these remarks briefly.
                INPUT:
                ${formattedHistory}

OUTPUT JSON ONLY:
                {
                    "employeeActions": "Summary of what employee did",
                    "applicantActions": "Summary of what applicant did",
                    "delayReason": "Why is it delayed? Choose one: Documentation, Process, Communication, External, Internal",
                    "sentiment": "Positive/Neutral/Negative"
                }
                    `;
                const fallbackResponse = await aiService.generate(fallbackPrompt, {
                    systemPrompt: 'Output JSON only.',
                    temperature: 0.2
                });

                const fallbackParsed = this.cleanAndParseJSON(fallbackResponse.content);
                if (fallbackParsed) {
                    return {
                        employeeRemarkAnalysis: {
                            summary: fallbackParsed.employeeActions || "No employee actions detected",
                            totalEmployeeRemarks: 1, // Estimate
                            keyActions: fallbackParsed.employeeActions ? [fallbackParsed.employeeActions] : [],
                            responseTimeliness: "Unknown",
                            communicationClarity: "Medium",
                            inactionFlags: []
                        },
                        applicantRemarkAnalysis: {
                            summary: fallbackParsed.applicantActions || "No applicant actions detected",
                            totalApplicantRemarks: 1, // Estimate
                            keyActions: fallbackParsed.applicantActions ? [fallbackParsed.applicantActions] : [],
                            responseTimeliness: "Unknown",
                            sentimentTrend: fallbackParsed.sentiment || "Neutral",
                            complianceLevel: "Unknown"
                        },
                        delayAnalysis: {
                            primaryDelayCategory: fallbackParsed.delayReason || "Unknown",
                            primaryCategoryConfidence: 0.7,
                            categorySummary: `Identified delay reason: ${fallbackParsed.delayReason}`,
                            allApplicableCategories: [],
                            processGaps: [],
                            painPoints: [],
                            forcefulDelays: []
                        },
                        sentimentSummary: fallbackParsed.sentiment || "Neutral",
                        ticketInsightSummary: `Fallback analysis: ${fallbackParsed.delayReason}`
                    };
                }
            }

            if (parsed) {
                // Ensure default structure if parts are missing
                return {
                    overallRemarkAnalysis: parsed.overallRemarkAnalysis,
                    employeeRemarkAnalysis: parsed.employeeRemarkAnalysis || {
                        summary: "No employee data detected",
                        totalEmployeeRemarks: 0,
                        keyActions: [],
                        responseTimeliness: "Unknown",
                        communicationClarity: "Unknown",
                        inactionFlags: []
                    },
                    applicantRemarkAnalysis: parsed.applicantRemarkAnalysis || {
                        summary: "No applicant data detected",
                        totalApplicantRemarks: 0,
                        keyActions: [],
                        responseTimeliness: "N/A",
                        sentimentTrend: "Neutral",
                        complianceLevel: "Unknown"
                    },
                    delayAnalysis: parsed.delayAnalysis || {
                        primaryDelayCategory: "Unknown",
                        primaryCategoryConfidence: 0,
                        categorySummary: "Analysis incomplete or no delay detected",
                        allApplicableCategories: [],
                        processGaps: [],
                        painPoints: [],
                        forcefulDelays: []
                    },
                    sentimentSummary: parsed.sentimentSummary || "Analysis complete.",
                    ticketInsightSummary: parsed.ticketInsightSummary || "Detailed forensic analysis complete."
                };
            }
            return undefined;
        } catch (e) {
            console.error('Failed to analyze playground remarks:', e);
            return undefined;
        }
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

        let candidate = clean;

        if (startIdx !== -1) {
            candidate = clean.substring(startIdx);
            // We DO NOT strictly enforce end index here because we want to handle truncation logic later
            // But we provide a "trimmed" version for Attempt 1b
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

        // Attempt 1: Direct parse of complete candidate
        let parsed = tryParse(candidate);
        if (parsed) return parsed;

        // Attempt 1b: Try parsing the "trimmed" version (original logic) just in case there's garbage at the end
        const lastClose = Math.max(candidate.lastIndexOf('}'), candidate.lastIndexOf(']'));
        if (lastClose !== -1 && lastClose > 0) {
            const trimmed = candidate.substring(0, lastClose + 1);
            parsed = tryParse(trimmed);
            if (parsed) return parsed;
        }

        // 4. Repairs - Use the FULL candidate for repairs
        try {
            let fixed = candidate;

            // Fix 0: Handle unescaped measurement quotes (e.g. 50'x80")
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

            // Fix 7: Convert single-quoted values to double-quoted
            fixed = fixed.replace(/:\s*'([^']*)'/g, ': "$1"');

            parsed = tryParse(fixed);
            if (parsed) return parsed;

            // Attempt 5: Relaxed Parsing (Function constructor)
            const dangerousKeywords = ['process', 'require', 'import', 'global', 'window', 'eval', 'function', '=>', 'class'];
            const hasDanger = dangerousKeywords.some(kw => fixed.includes(kw));

            if (!hasDanger) {
                try {
                    const relaxedParse = new Function('return (' + fixed + ')');
                    return relaxedParse();
                } catch (eRelaxed) {

                }
            }

            // Attempt 6: "Reconstruction" Strategy (The Nuclear Option)
            // If the full block fails (e.g. due to one bad string in 'delayAnalysis'),
            // try to extract the known sub-objects independently.
            console.warn("⚠️ Full JSON parse failed. Attempting to reconstruct from regex chunks...");

            const reconstructed: any = {};

            const extractObject = (text: string, key: string) => {
                try {
                    // Optimized regex to find "key": {
                    const startRegex = new RegExp(`"${key}"\\s*:\\s*\\{`, 'i');
                    const match = text.match(startRegex);
                    if (!match) return null;

                    let startIndex = match.index! + match[0].length - 1; // pointing to {
                    let braceCount = 0;
                    let foundEnd = false;
                    let endIndex = -1;

                    for (let i = startIndex; i < text.length; i++) {
                        if (text[i] === '{') braceCount++;
                        if (text[i] === '}') braceCount--;
                        if (braceCount === 0) {
                            endIndex = i;
                            foundEnd = true;
                            break;
                        }
                    }

                    let jsonBlock = "";
                    if (foundEnd) {
                        jsonBlock = text.substring(startIndex, endIndex + 1);
                    } else {
                        // TRUNCATED: Take everything from start to end of string and try to close it
                        jsonBlock = text.substring(startIndex);
                        jsonBlock = jsonBlock.replace(/,\s*$/, '') + '}'; // Close it roughly
                    }

                    // Highly aggressive sanitization for the Function constructor
                    jsonBlock = jsonBlock.replace(/\r?\n/g, ' ');

                    try {
                        const result = new Function('return (' + jsonBlock + ')')();
                        if (result) console.log(`   ✅ Extracted ${key}`);
                        return result;
                    } catch (eInner) {
                        const fixedBlock = jsonBlock.replace(/\\+/g, '\\');
                        try {
                            const result = new Function('return (' + fixedBlock + ')')();
                            if (result) console.log(`   ✅ Extracted ${key} (after backslash fix)`);
                            return result;
                        } catch (eFinal) {
                            console.warn(`   ❌ Failed to parse ${key}: ${eFinal instanceof Error ? eFinal.message : 'Unknown'}`);
                            console.log(`   BLOCK PREVIEW: ${jsonBlock.substring(0, 300)}...`);
                            return null;
                        }
                    }
                } catch (e) { return null; }
            };

            reconstructed.employeeRemarkAnalysis = extractObject(candidate, 'employeeRemarkAnalysis');
            reconstructed.applicantRemarkAnalysis = extractObject(candidate, 'applicantRemarkAnalysis');
            reconstructed.delayAnalysis = extractObject(candidate, 'delayAnalysis');

            // Extract top-level flat fields
            const getFlatField = (text: string, key: string) => {
                const regex = new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`, 'i');
                const match = text.match(regex);
                return match ? match[1] : null;
            };

            reconstructed.sentimentSummary = getFlatField(clean, 'sentimentSummary');
            reconstructed.ticketInsightSummary = getFlatField(clean, 'ticketInsightSummary');
            reconstructed.category = getFlatField(clean, 'category');
            reconstructed.englishSummary = getFlatField(clean, 'englishSummary');
            reconstructed.employeeAnalysis = getFlatField(clean, 'employeeAnalysis');
            reconstructed.applicantAnalysis = getFlatField(clean, 'applicantAnalysis');

            // If we recovered significant parts, return it
            if (reconstructed.employeeRemarkAnalysis || reconstructed.sentimentSummary || reconstructed.englishSummary) {
                console.log(`✅ Successfully reconstructed partial JSON for ${reconstructed.employeeRemarkAnalysis ? 'NESTED' : 'FLAT'} object.`);
                return reconstructed;
            }

            console.error("❌ JSON Parse Failed completely. Last candidate:", fixed.substring(0, 200) + "...");
            return null;
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
