
import type { ProjectStatistics, AIInsights, ForensicAnalysis, ZoneOutlierReport, ZoneOutlierTicketReport } from '../types/index.js';
import type { AIService } from '../interfaces/AIService.js';
import {
    createAnomalyAnalysisPrompt,
    createBottleneckPredictionPrompt,
    createRecommendationsPrompt,
    createRemarkAnalysisPrompt,
    createDocumentExtractionPrompt,
    createCategoryClassificationPrompt,
    createZoneOutlierReportPrompt
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
     * Generate a Zone-Wise Outlier Report for JDA leadership.
     * Analyzes all tickets grouped by zone, detects Analytical vs Behavioral outliers.
     * Behavioral outliers = employees requesting already-submitted documents (fraud signal).
     */
    public async generateZoneOutlierReport(
        projectId: string,
        workflowSteps: any[],
        provider: AIProvider = 'ollama',
        apiKey?: string
    ): Promise<ZoneOutlierReport> {
        const aiService = this.aiFactory.getService(provider, apiKey);

        // Group steps by ticket
        const ticketMap = new Map<string, any[]>();
        for (const step of workflowSteps) {
            if (step.ticketId) {
                if (!ticketMap.has(step.ticketId)) ticketMap.set(step.ticketId, []);
                ticketMap.get(step.ticketId)!.push(step);
            }
        }

        const ticketReports: ZoneOutlierTicketReport[] = [];

        const BATCH_SIZE = 2;
        const ticketEntries = Array.from(ticketMap.entries());

        console.log(`\n🗺️  ZONE OUTLIER REPORT — Analyzing ${ticketEntries.length} tickets`);

        for (let i = 0; i < ticketEntries.length; i += BATCH_SIZE) {
            const batch = ticketEntries.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(async ([ticketId, steps]) => {
                try {
                    const lastStep = steps[steps.length - 1];
                    const zone = lastStep?.rawRow?.['ZoneName'] || lastStep?.zoneId || 'Unknown Zone';
                    const flowType = lastStep?.serviceName || 'Unknown Service';
                    const employeeName = lastStep?.employeeName || 'Unknown Employee';

                    // Calculate total delay
                    const appDateStep = steps.find((s: any) => s.rawRow?.['ApplicationDate'] && s.rawRow['ApplicationDate'] !== 'NULL');
                    const delDateStep = steps.find((s: any) => s.rawRow?.['DeliverdOn'] && s.rawRow['DeliverdOn'] !== 'NULL');
                    let totalDelay = 0;
                    if (appDateStep?.rawRow?.['ApplicationDate'] && delDateStep?.rawRow?.['DeliverdOn']) {
                        try {
                            const [am, ad, ay] = appDateStep.rawRow['ApplicationDate'].split('/').map(Number);
                            const [dm, dd, dy] = delDateStep.rawRow['DeliverdOn'].split('/').map(Number);
                            totalDelay = Math.floor((new Date(dy, dm - 1, dd).getTime() - new Date(ay, am - 1, ad).getTime()) / 86400000);
                        } catch { }
                    }

                    // Reconstruct conversation
                    const conversationHistory = steps.map((step: any) => {
                        const rf = (step.lifetimeRemarksFrom || '').trim();
                        const rm = (step.lifetimeRemarks || '').trim();
                        const date = step.rawRow?.['MaxEventTimeStamp'] || 'Unknown Date';
                        return `[${date}] lifetimeRemarksFrom: "${rf.replace(/"/g, "'")}" | lifetimeRemarks: "${rm.replace(/"/g, "'")}"`;
                    }).join('\n');

                    // Hybrid doc extraction (already used for forensic reports)
                    const docResult = await this.hybridDocumentExtraction(conversationHistory, ticketId, aiService);
                    const submittedDocs = docResult.submissionConfirmed && docResult.documents.length > 0
                        ? docResult.documents.join(', ')
                        : docResult.submissionConfirmed ? 'Applicant confirmed submission (specific docs unclear)' : 'None confirmed';
                    const requestedDocs = docResult.documents.length > 0
                        ? docResult.documents.join(', ')
                        : 'None identified';

                    // Generate outlier report with the leadership prompt
                    const prompt = createZoneOutlierReportPrompt({
                        ticketId,
                        zone,
                        flowType,
                        totalDelay,
                        employeeName,
                        conversationHistory,
                        submittedDocuments: submittedDocs,
                        requestedDocuments: requestedDocs
                    });

                    const response = await aiService.generate(prompt, { format: 'json', temperature: 0.1 });
                    const parsed = this.cleanAndParseJSON(response.content);

                    if (parsed?.outlierReport) {
                        const rpt = parsed.outlierReport;

                        // Strict stringification helper for arrays
                        const ensureStringArray = (arr: any): string[] => {
                            if (!Array.isArray(arr)) return [];
                            return arr.map(item => {
                                if (typeof item === 'string') return item;
                                if (item === null || item === undefined) return '';
                                // If it's an object with a single value (like { action: "foo" } or { document: "bar" }), extract the value
                                if (typeof item === 'object') {
                                    const vals = Object.values(item);
                                    if (vals.length > 0 && typeof vals[0] === 'string') return vals[0] as string;
                                    try { return JSON.stringify(item); } catch { return String(item); }
                                }
                                return String(item);
                            }).filter(s => s.length > 0);
                        };

                        ticketReports.push({
                            ticketId,
                            zone,
                            primaryCategory: rpt.primaryCategory === 'Behavioral Outlier' ? 'Behavioral Outlier' : 'Analytical Outlier',
                            severity: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(rpt.severity) ? rpt.severity : 'MEDIUM',
                            confidence: typeof rpt.confidence === 'number' ? rpt.confidence : 0.5,
                            outlierSummary: typeof rpt.outlierSummary === 'string' ? rpt.outlierSummary : 'No summary available',
                            rootCause: typeof rpt.rootCause === 'string' ? rpt.rootCause : 'Unknown',
                            impactStatement: typeof rpt.impactStatement === 'string' ? rpt.impactStatement : 'Unknown impact',
                            documentCrossCheck: {
                                falsyRequestedAfterSubmission: ensureStringArray(rpt.documentCrossCheck?.falsyRequestedAfterSubmission),
                                genuinelyMissing: ensureStringArray(rpt.documentCrossCheck?.genuinelyMissing),
                                crossCheckSummary: typeof rpt.documentCrossCheck?.crossCheckSummary === 'string' ? rpt.documentCrossCheck.crossCheckSummary : ''
                            },
                            keyEvidence: ensureStringArray(rpt.keyEvidence),
                            recommendations: ensureStringArray(rpt.recommendations),
                            employeeSignalFlags: Array.isArray(rpt.employeeSignalFlags) ? rpt.employeeSignalFlags.filter((f: any) => typeof f === 'object' && f.flag) : []
                        });
                        console.log(`  ✅ [ZoneOutlier] Ticket ${ticketId} → ${rpt.primaryCategory} | Severity: ${rpt.severity}`);
                    }
                } catch (err) {
                    console.error(`  ⚠️ [ZoneOutlier] Failed for ticket ${ticketId}`, err);
                }
            }));
        }

        // Build zone summary
        const zoneMap = new Map<string, { analytical: number; behavioral: number; critical: number; tickets: ZoneOutlierTicketReport[] }>();
        for (const rpt of ticketReports) {
            if (!zoneMap.has(rpt.zone)) zoneMap.set(rpt.zone, { analytical: 0, behavioral: 0, critical: 0, tickets: [] });
            const zm = zoneMap.get(rpt.zone)!;
            zm.tickets.push(rpt);
            if (rpt.primaryCategory === 'Analytical Outlier') zm.analytical++;
            else zm.behavioral++;
            if (rpt.severity === 'CRITICAL') zm.critical++;
        }

        const zoneSummary = Array.from(zoneMap.entries()).map(([zone, data]) => {
            // Pick top recommendation from highest severity ticket
            const topTicket = data.tickets.sort((a, b) => ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].indexOf(b.severity) - ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].indexOf(a.severity))[0];
            return {
                zone,
                totalTickets: data.tickets.length,
                analyticalOutliers: data.analytical,
                behavioralOutliers: data.behavioral,
                criticalCount: data.critical,
                topRecommendation: topTicket?.recommendations?.[0] || 'No critical recommendation'
            };
        });

        // Executive summary
        const totalBehavioral = ticketReports.filter(r => r.primaryCategory === 'Behavioral Outlier').length;
        const totalAnalytical = ticketReports.filter(r => r.primaryCategory === 'Analytical Outlier').length;
        const totalCritical = ticketReports.filter(r => r.severity === 'CRITICAL').length;
        const executiveSummary = `Zone Outlier Analysis covering ${ticketReports.length} tickets across ${zoneMap.size} zones. ` +
            `Detected ${totalBehavioral} Behavioral Outlier(s) (potential employee misconduct) and ${totalAnalytical} Analytical Outlier(s) (process/documentation gaps). ` +
            `${totalCritical} ticket(s) are flagged as CRITICAL risk and require immediate leadership attention.`;

        console.log(`\n🗺️  ZONE OUTLIER REPORT COMPLETE — ${ticketReports.length} tickets | ${totalBehavioral} Behavioral | ${totalAnalytical} Analytical | ${totalCritical} Critical`);

        return {
            projectId,
            generatedAt: new Date().toISOString(),
            zoneSummary,
            ticketReports,
            executiveSummary
        };
    }

    /**
     * Generate comprehensive AI analysis for a project
     */
    async analyzeProjectData(statistics: ProjectStatistics, projectName: string, provider: AIProvider = 'ollama', apiKey?: string, workflowSteps: any[] = []): Promise<AIInsights> {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`🤖 AI ANALYSIS STARTED`);
        console.log(`   Provider : ${provider.toUpperCase()}`);
        console.log(`   Auth     : ${apiKey ? 'Custom Key Provided' : 'System Credentials (.env)'}`);
        console.log(`${'='.repeat(60)}`);
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

            // 3. Deep Remark Analysis (Forensic) - Moved up to provide context for recommendations
            this.logProgress('Analyzing Remarks', 60, 'Performing deep forensic audit of remarks...');
            const forensicStartTime = Date.now();
            const { remarkAnalysis, forensicReports } = await this.analyzeRemarks(statistics, currentService, workflowSteps);
            const forensicElapsedSec = ((Date.now() - forensicStartTime) / 1000).toFixed(1);
            const ticketCount = Object.keys(forensicReports).length;
            console.log(`\n${'='.repeat(60)}`);
            console.log(`✅ FORENSIC ANALYSIS COMPLETE`);
            console.log(`   Provider : ${provider.toUpperCase()}`);
            console.log(`   Tickets  : ${ticketCount} analyzed`);
            console.log(`   Duration : ${forensicElapsedSec}s`);
            console.log(`   Reports  : ${Object.keys(forensicReports).join(', ') || 'none'}`);
            console.log(`${'='.repeat(60)}\n`);

            // 4. Recommendations - Now ground in forensic findings
            this.logProgress('Generating Strategies', 85, 'Formulating grounded efficiency improvements...');
            const recommendations = await this.generateRecommendations(
                statistics,
                currentService,
                anomalyAnalysis.rootCause,
                forensicReports
            );

            // JDA Intelligence Hierarchy is preserved without secondary analysis
            let jdaIntelligence = statistics.jdaHierarchy;

            console.log(`✅ ALL AI INSIGHTS COMPLETE — Provider: ${provider.toUpperCase()}`);
            this.logProgress('Finalizing', 100, 'Analysis complete.');

            return {
                rootCause: anomalyAnalysis.rootCause,
                predictions: bottleneckAnalysis.predictions,
                recommendations: recommendations,
                severity: anomalyAnalysis.severity, // Use AI-detected severity
                confidence: anomalyAnalysis.confidence, // Use AI-detected confidence
                remarkAnalysis,
                forensicReports,
                jdaIntelligence
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
     * Analyze anomalies using LLM
     */
    private async analyzeAnomalies(statistics: ProjectStatistics, projectName: string, aiService: AIService): Promise<{
        rootCause: string;
        predictions: string;
        severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        confidence: number;
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

        const response = await aiService.generate(prompt, { format: 'json' });

        console.log('--- ANOMALY ANALYSIS RAW RESPONSE (JSON) ---');
        console.log(response.content);
        console.log('--- END RAW RESPONSE ---');

        try {
            const result = JSON.parse(response.content);

            // Validate severity
            let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'HIGH';
            const s = result.severity?.toUpperCase();
            if (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(s)) {
                severity = s as any;
            }

            // Sanitize hallucinations like "The 'None' role is averaging 0 days delay"
            const sanitizeInsight = (text: string): string => {
                if (!text) return "";
                const lower = text.toLowerCase();
                if (lower.includes("'none' role") || lower.includes("none role") || lower.includes("0 days delay")) {
                    return "No critical process anomalies or forceful delays detected in the analyzed snapshot.";
                }
                return text;
            };

            return {
                rootCause: sanitizeInsight(result.rootCause) || "No critical process anomalies detected in the analyzed snapshot.",
                predictions: result.predictions || "SLA breaches likely if current volume persists.",
                severity,
                confidence: typeof result.confidence === 'number' ? result.confidence : 0.8
            };
        } catch (e) {
            console.error('Failed to parse anomaly JSON, using fallbacks:', e);
            return {
                rootCause: "High delay frequency detected in primary processing roles.",
                predictions: "SLA breaches likely if current volume persists.",
                severity: "HIGH",
                confidence: 0.7
            };
        }
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

        // Extract predictions (the whole response if it's not starting with an error)
        let predictions = response.content.trim();

        // If it starts with an error about missing data, it means Ollama hallucinated a rejection
        // even with our strict fallback rules, so we'll enforce the fallback here.
        if (predictions.toLowerCase().includes("provide the bottleneck data") ||
            predictions.toLowerCase().includes("don't see any bottleneck data")) {
            predictions = "No critical bottlenecks detected in the current workflow snapshot. System is operating within expected SLA parameters.";
        }

        return { predictions };
    }



    /**
     * Generate actionable recommendations
     */
    private async generateRecommendations(
        statistics: ProjectStatistics,
        aiService: AIService,
        forensicRootCause: string,
        forensicReports: Record<string, ForensicAnalysis>
    ): Promise<string[]> {
        // Extract common themes from forensic reports
        const themes = new Set<string>();
        Object.values(forensicReports).forEach(report => {
            report.overallRemarkAnalysis.employeeRemarksOverall.commonThemes.forEach(t => themes.add(t));
            report.overallRemarkAnalysis.applicantRemarksOverall.commonThemes.forEach(t => themes.add(t));
        });
        const topThemes = Array.from(themes).slice(0, 5).join(', ') || 'No specific themes identified';

        const prompt = createRecommendationsPrompt({
            anomalyCount: statistics.anomalyCount,
            avgProcessingTime: statistics.avgDaysRested.toFixed(1),
            bottleneckRole: statistics.criticalBottleneck?.role || 'None',
            bottleneckAvgDelay: statistics.criticalBottleneck?.avgDelay?.toFixed(1) || '0',
            primaryZones: statistics.zonePerformance.slice(0, 2).map(z => z.name).join(', '),
            rootCause: forensicRootCause,
            topThemes: topThemes
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
        remarkAnalysis?: ForensicAnalysis;
        forensicReports: Record<string, ForensicAnalysis>;
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

        const BATCH_SIZE = 2;
        let processedCount = 0;

        for (let i = 0; i < targetTickets.length; i += BATCH_SIZE) {
            const batch = targetTickets.slice(i, i + BATCH_SIZE);

            await Promise.all(batch.map(async (ticket) => {
                processedCount++;
                console.log(`\n🔍 Analyzing Ticket ${ticket.id} (${processedCount}/${targetTickets.length})...`);

                const analysis = await this.runForensicAnalysisForTicket(ticket, workflowSteps, aiService);
                if (analysis) {
                    forensicReports[ticket.id] = analysis;
                    console.log(`✅ Forensic analysis complete for ticket ${ticket.id}`);
                } else {
                    console.warn(`⚠️ Failed to generate forensic analysis for ticket ${ticket.id}`);
                }
            }));
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
    ): Promise<ForensicAnalysis | undefined> {
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

        // ─── HYBRID DOCUMENT EXTRACTION (EVIDENCE-QUOTE) ─────────────────────
        const docExtractionResult = await this.hybridDocumentExtraction(conversationHistory, String(ticket.id), aiService);
        const docsExtractedStr = docExtractionResult.documents.length > 0 ? `[${docExtractionResult.documents.join(', ')}]` : '[] (None)';

        // ─── CATEGORY CLASSIFICATION ──────────────────────────────────────────
        const { createCategoryClassificationPrompt } = await import('../config/promptBuilders.js');
        const categoryPrompt = createCategoryClassificationPrompt({
            ticketId: String(ticket.id),
            flowType: ticket.service || 'Unknown',
            conversationHistory: conversationHistory,
            documentsExtracted: docsExtractedStr
        });

        let primaryCategory = "Unknown";
        let categoryConfidence = 0;
        let categoryReasoning = "No reasoning provided";
        let categoryFactors: string[] = [];
        let categoryBreakdown = "No breakdown provided";

        try {
            const catResponse = await aiService.generate(categoryPrompt, {
                temperature: 0.1,
                format: 'json'
            });

            const catParsed = this.cleanAndParseJSON(catResponse.content);
            if (catParsed?.categoryClassification) {
                const cc = catParsed.categoryClassification;
                primaryCategory = cc.primaryCategory || primaryCategory;
                categoryConfidence = cc.confidence || categoryConfidence;
                categoryReasoning = cc.reasoning || categoryReasoning;
                categoryFactors = Array.isArray(cc.contributingFactors) ? cc.contributingFactors : categoryFactors;
                categoryBreakdown = cc.delayBreakdown || cc.reasoning || categoryBreakdown;
                console.log(`  📌 [Category Classification] Ticket ${ticket.id} -> ${primaryCategory} (Conf: ${categoryConfidence})`);
            }
        } catch (catErr) {
            console.error(`  ⚠️ [Category Classification] AI Service failed for ticket ${ticket.id}`, catErr);
        }
        // ─── END CATEGORY CLASSIFICATION ──────────────────────────────────────

        // ─── EMPLOYEE REMARK ANALYSIS ─────────────────────────────────────────
        const prompt = createRemarkAnalysisPrompt({
            ticketId: ticket.id,
            flowType: ticket.service,
            conversationHistory: conversationHistory,
            categoryIdentified: primaryCategory,
            documentsExtracted: docsExtractedStr
        });

        // Add explicit file logging for user diagnostics
        try {
            const fs = await import('fs');
            const path = await import('path');
            const logPath = path.join(process.cwd(), 'ai_io.log');
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
            const response = await aiService.generate(prompt, {
                systemPrompt: `You must strictly avoid copying instructional text or examples from the prompt.
DO NOT mention any specific documents or amounts unless they are explicitly named in the provided conversation history.
If any field contains schema-style placeholder wording, regenerate internally before responding.
Output only data grounded in the ACTUAL conversationHistory provided.`,
                temperature: 0.15,
                top_p: 0.9,
                format: 'json'
            });
            const content = response.content;

            console.log(`--- FORENSIC ANALYSIS RAW RESPONSE (Ticket ${ticket.id}) ---`);
            console.log(content); // Print FULL content
            console.log('--- END RAW RESPONSE ---');

            // Add explicit file logging for user diagnostics
            try {
                const fs = await import('fs');
                const path = await import('path');
                const logPath = path.join(process.cwd(), 'ai_io.log');
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
                // Ensure all REQUIRED fields for the new ForensicAnalysis interface are present
                const compliant: ForensicAnalysis = {
                    overallRemarkAnalysis: {
                        employeeRemarksOverall: {
                            totalEmployeeRemarks: 0,
                            summary: "Not analyzed",
                            commonThemes: [],
                            communicationQuality: "Unknown",
                            responseTimeliness: "Unknown",
                            topEmployeeActions: [],
                            inactionPatterns: []
                        },
                        applicantRemarksOverall: {
                            totalApplicantRemarks: 0,
                            summary: "Not analyzed",
                            commonThemes: [],
                            complianceLevel: "Unknown",
                            sentimentSummary: "Neutral",
                            delayPatterns: [],
                            topApplicantConcerns: []
                        }
                    },
                    employeeRemarkAnalysis: {
                        summary: parsed.remarkAnalysis?.employeeAnalysis?.summary ||
                            parsed.employeeAnalysis?.summary ||
                            "No employee analysis generated.",
                        totalEmployeeRemarks: parsed.remarkAnalysis?.employeeAnalysis?.totalEmployeeRemarks ||
                            parsed.employeeAnalysis?.totalEmployeeRemarks || 0,
                        keyActions: parsed.remarkAnalysis?.employeeAnalysis?.keyActions ||
                            parsed.employeeAnalysis?.keyActions || [],
                        responseTimeliness: parsed.remarkAnalysis?.employeeAnalysis?.responseTimeliness ||
                            parsed.employeeAnalysis?.responseTimeliness || "Unknown",
                        communicationClarity: parsed.remarkAnalysis?.employeeAnalysis?.communicationQuality ||
                            parsed.employeeAnalysis?.communicationQuality || "Medium",
                        inactionFlags: parsed.remarkAnalysis?.employeeAnalysis?.inactionFlags ||
                            parsed.employeeAnalysis?.inactionFlags || []
                    },
                    applicantRemarkAnalysis: {
                        summary: parsed.remarkAnalysis?.applicantAnalysis?.summary ||
                            parsed.applicantAnalysis?.summary ||
                            "No applicant analysis generated.",
                        totalApplicantRemarks: parsed.remarkAnalysis?.applicantAnalysis?.totalApplicantRemarks ||
                            parsed.applicantAnalysis?.totalApplicantRemarks || 0,
                        keyActions: parsed.remarkAnalysis?.applicantAnalysis?.keyActions ||
                            parsed.applicantAnalysis?.keyActions || [],
                        responseTimeliness: parsed.remarkAnalysis?.applicantAnalysis?.responseTimeliness ||
                            parsed.applicantAnalysis?.responseTimeliness || "Unknown",
                        sentimentSummary: parsed.remarkAnalysis?.applicantAnalysis?.sentimentSummary ||
                            parsed.applicantAnalysis?.sentimentSummary ||
                            parsed.remarkAnalysis?.applicantAnalysis?.sentimentTrend || // Fallback for old models
                            parsed.applicantAnalysis?.sentimentTrend || "Neutral",
                        complianceLevel: parsed.remarkAnalysis?.applicantAnalysis?.complianceLevel ||
                            parsed.applicantAnalysis?.complianceLevel || "Unknown",
                        complianceReason: parsed.remarkAnalysis?.applicantAnalysis?.complianceReason ||
                            parsed.applicantAnalysis?.complianceReason,
                        painPoints: parsed.remarkAnalysis?.applicantAnalysis?.painPoints ||
                            parsed.applicantAnalysis?.painPoints || []
                    },
                    delayAnalysis: {
                        primaryDelayCategory: primaryCategory,
                        primaryCategoryConfidence: categoryConfidence,
                        documentClarityAnalysis: {
                            documentClarityProvided: docExtractionResult.documents.length > 0,
                            documentNames: docExtractionResult.documents,
                            documentDetails: docExtractionResult.documentDetails
                        },
                        categorySummary: categoryBreakdown,
                        allApplicableCategories: [],
                        processGaps: Array.isArray(parsed.employeeAnalysis?.bottlenecks)
                            ? parsed.employeeAnalysis.bottlenecks.map((b: any) => typeof b === 'string' ? b : (b.bottleneck || JSON.stringify(b)))
                            : [], // Store bottlenecks as processGaps
                        painPoints: [],
                        forcefulDelays: [],
                        categoryClassification: {
                            primaryCategory: primaryCategory,
                            confidence: categoryConfidence,
                            reasoning: categoryReasoning,
                            contributingFactors: categoryFactors,
                            delayBreakdown: categoryBreakdown
                        }
                    },
                    sentimentSummary: parsed.remarkAnalysis?.applicantAnalysis?.sentimentSummary ||
                        parsed.applicantAnalysis?.sentimentSummary ||
                        parsed.remarkAnalysis?.applicantAnalysis?.sentimentTrend ||
                        parsed.applicantAnalysis?.sentimentTrend ||
                        parsed.sentimentSummary ||
                        "Neutral",
                    ticketInsightSummary: parsed.remarkAnalysis?.overallTicketInsight?.summary ||
                        parsed.overallTicketInsight?.summary ||
                        parsed.ticketInsightSummary ||
                        "No specific insights."
                };

                console.log(`✅ Forensic analysis parsed and validated for ticket ${ticket.id}`);
                return compliant;
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

        // ─── HYBRID DOCUMENT EXTRACTION (EVIDENCE-QUOTE) ─────────────────────
        const docExtractionResult = await this.hybridDocumentExtraction(formattedHistory, 'PLAYGROUND-DEMO', aiService);
        const docsExtractedStr = docExtractionResult.documents.length > 0 ? `[${docExtractionResult.documents.join(', ')}]` : '[] (None)';

        // ─── CATEGORY CLASSIFICATION ──────────────────────────────────────────
        const { createCategoryClassificationPrompt } = await import('../config/promptBuilders.js');
        const categoryPrompt = createCategoryClassificationPrompt({
            ticketId: 'PLAYGROUND-DEMO',
            flowType: 'Generic Request',
            conversationHistory: formattedHistory,
            documentsExtracted: docsExtractedStr
        });

        let primaryCategory = "Unknown";
        let categoryConfidence = 0;
        let categoryReasoning = "No reasoning provided";

        try {
            const catResponse = await aiService.generate(categoryPrompt, { temperature: 0.1, format: 'json' });
            const catParsed = this.cleanAndParseJSON(catResponse.content);
            if (catParsed?.categoryClassification) {
                const cc = catParsed.categoryClassification;
                primaryCategory = cc.primaryCategory || primaryCategory;
                categoryConfidence = cc.confidence || categoryConfidence;
                categoryReasoning = cc.reasoning || categoryReasoning;
            }
        } catch (e) {
            console.error("Playground category classification failed", e);
        }

        // Use the centralized prompt template
        const { REMARK_ANALYSIS_USER_PROMPT } = await import('../prompts/templates.js');
        const { interpolate } = await import('../utils/promptUtils.js');

        const promptContext = {
            ticketId: 'PLAYGROUND-DEMO',
            flowType: 'Generic Request',
            conversationHistory: formattedHistory,
            categoryIdentified: primaryCategory,
            documentsExtracted: docsExtractedStr
        };

        const advancedPrompt = interpolate(REMARK_ANALYSIS_USER_PROMPT, promptContext);

        try {
            const response = await aiService.generate(advancedPrompt, {
                systemPrompt: `You must strictly avoid copying instructional text or examples from the prompt.
DO NOT mention specific documents (like Aadhar, Pan, etc.) unless they are explicitly named in the provided conversation history.
If any field contains schema-style placeholder wording, regenerate internally before responding.
Output only data grounded in the ACTUAL conversationHistory provided.`,
                temperature: 0.15,
                top_p: 0.9,
                format: 'json'
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
            const isAnalysisEmpty = !parsed?.employeeAnalysis || (
                (parsed.employeeAnalysis?.summary === "" || parsed.employeeAnalysis?.totalEmployeeRemarks === 0)
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
                        overallRemarkAnalysis: {
                            employeeRemarksOverall: {
                                totalEmployeeRemarks: 1,
                                summary: fallbackParsed.employeeActions || "No employee actions",
                                commonThemes: [],
                                communicationQuality: "Unknown",
                                responseTimeliness: "Unknown",
                                inactionPatterns: [],
                                topEmployeeActions: []
                            },
                            applicantRemarksOverall: {
                                totalApplicantRemarks: 1,
                                summary: fallbackParsed.applicantActions || "No applicant actions",
                                commonThemes: [],
                                complianceLevel: "Unknown",
                                sentimentSummary: fallbackParsed.sentiment || "Neutral",
                                delayPatterns: [],
                                topApplicantConcerns: []
                            }
                        },
                        employeeRemarkAnalysis: {
                            summary: fallbackParsed.employeeActions || "No employee actions detected",
                            totalEmployeeRemarks: 1,
                            keyActions: [],
                            communicationClarity: "Medium",
                            responseTimeliness: "Unknown",
                            inactionFlags: []
                        },
                        applicantRemarkAnalysis: {
                            summary: fallbackParsed.applicantActions || "No applicant actions detected",
                            totalApplicantRemarks: 1,
                            keyActions: [],
                            sentimentSummary: fallbackParsed.sentiment || "Neutral",
                            complianceLevel: "Unknown",
                            responseTimeliness: "Unknown"
                        },
                        delayAnalysis: {
                            primaryDelayCategory: fallbackParsed.delayReason || primaryCategory,
                            primaryCategoryConfidence: categoryConfidence,
                            documentClarityAnalysis: {
                                documentClarityProvided: docExtractionResult.documents.length > 0,
                                documentNames: docExtractionResult.documents,
                                documentDetails: docExtractionResult.documentDetails
                            },
                            categorySummary: `Identified delay reason: ${fallbackParsed.delayReason}`,
                            allApplicableCategories: [],
                            processGaps: [],
                            painPoints: [],
                            forcefulDelays: [],
                            categoryClassification: {
                                primaryCategory: fallbackParsed.delayReason || primaryCategory,
                                confidence: categoryConfidence,
                                reasoning: categoryReasoning,
                                contributingFactors: [],
                                delayBreakdown: categoryReasoning
                            }
                        },
                        sentimentSummary: fallbackParsed.sentiment || "Neutral",
                        ticketInsightSummary: `Fallback analysis: ${fallbackParsed.delayReason}`
                    };
                }
            }

            if (parsed) {
                // Ensure all REQUIRED fields for the new ForensicAnalysis interface are present
                const compliant: ForensicAnalysis = {
                    overallRemarkAnalysis: {
                        employeeRemarksOverall: {
                            totalEmployeeRemarks: 0,
                            summary: "Not analyzed",
                            commonThemes: [],
                            communicationQuality: "Unknown",
                            responseTimeliness: "Unknown",
                            topEmployeeActions: [],
                            inactionPatterns: []
                        },
                        applicantRemarksOverall: {
                            totalApplicantRemarks: 0,
                            summary: "Not analyzed",
                            commonThemes: [],
                            complianceLevel: "Unknown",
                            sentimentSummary: "Neutral",
                            delayPatterns: [],
                            topApplicantConcerns: []
                        }
                    },
                    employeeRemarkAnalysis: {
                        summary: parsed.employeeAnalysis?.summary || "Analysis unavailable",
                        totalEmployeeRemarks: parsed.employeeAnalysis?.totalEmployeeRemarks || 0,
                        keyActions: parsed.employeeAnalysis?.keyActions || [],
                        responseTimeliness: parsed.employeeAnalysis?.responseTimeliness || "Unknown",
                        communicationClarity: parsed.employeeAnalysis?.communicationQuality || "Unknown",
                        inactionFlags: parsed.employeeAnalysis?.inactionFlags || []
                    },
                    applicantRemarkAnalysis: {
                        summary: "Analysis unavailable (Refactored to focus on Employee actions)",
                        totalApplicantRemarks: 0,
                        keyActions: [],
                        responseTimeliness: "Unknown",
                        sentimentSummary: "Neutral",
                        complianceLevel: "Unknown"
                    },
                    delayAnalysis: {
                        primaryDelayCategory: primaryCategory,
                        primaryCategoryConfidence: categoryConfidence,
                        documentClarityAnalysis: {
                            documentClarityProvided: docExtractionResult.documents.length > 0,
                            documentNames: docExtractionResult.documents,
                            documentDetails: docExtractionResult.documentDetails
                        },
                        categorySummary: categoryReasoning,
                        allApplicableCategories: [],
                        processGaps: parsed.employeeAnalysis?.bottlenecks || [],
                        painPoints: [],
                        forcefulDelays: [],
                        categoryClassification: {
                            primaryCategory: primaryCategory,
                            confidence: categoryConfidence,
                            reasoning: categoryReasoning,
                            contributingFactors: [],
                            delayBreakdown: categoryReasoning
                        }
                    },
                    sentimentSummary: parsed.sentimentSummary || "Unknown",
                    ticketInsightSummary: parsed.ticketInsightSummary || "No specific insights."
                };

                return compliant;
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

            reconstructed.sentimentTrend = getFlatField(clean, 'sentimentTrend');
            reconstructed.sentimentTrendDetails = getFlatField(clean, 'sentimentTrendDetails');
            reconstructed.sentimentSummary = getFlatField(clean, 'sentimentSummary') || reconstructed.sentimentTrend;
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

    /**
     * Hybrid Document Extraction (Evidence-Quote Based)
     * Replaces the naive keyword scanner to prevent extracting false positives (e.g. "applicant asked about aadhar").
     * Uses Prompt Chaining and deterministic Quote Verification.
     */
    private async hybridDocumentExtraction(
        conversationHistory: string,
        ticketId: string,
        aiService: AIService
    ): Promise<{ documents: string[]; documentDetails: Array<{ name: string; exactMatch: string; quote: string }>; submissionConfirmed: boolean }> {
        // ─── Deterministic code scanner ───
        const DOC_SCAN_MAP = [
            { name: 'Pan Card', aliases: ['pan card', 'pancard', 'पैन कार्ड'], wordAliases: ['pan'] },
            { name: 'Aadhar Card', aliases: ['aadhar card', 'aadhar', 'adhar card', 'adhar', 'aadhaar', 'aadhaar card', 'आधार कार्ड', 'आधार'] },
            { name: 'Passport', aliases: ['passport', 'पासपोर्ट'] },
            { name: 'Voter ID', aliases: ['voter id', 'voter card', 'वोटर कार्ड', 'voter i/d'] },
            { name: 'Ration Card', aliases: ['ration card', 'राशन कार्ड'] },
            { name: 'Site Plan', aliases: ['site plan', 'साइट प्लान', 'site map'] },
            { name: 'Sale Deed', aliases: ['sale deed', 'विक्रय पत्र', 'sale-deed'] },
            { name: 'Lease Deed', aliases: ['lease deed', 'leasedeed', 'patta', 'e-patta', 'ई-पट्टा', 'लीजडीड', 'पट्टा'] },
            { name: 'License Deed', aliases: ['license deed', 'licence deed', 'लाईसेन्स डीड'] },
            { name: 'Affidavit', aliases: ['affidavit', 'शपथ पत्र'] },
            { name: 'Death Certificate', aliases: ['death certificate', 'मृत्यु प्रमाण पत्र'] },
            { name: 'Marriage Certificate', aliases: ['marriage certificate', 'विवाह प्रमाण पत्र'] },
            { name: 'Birth Certificate', aliases: ['birth certificate', 'जन्म प्रमाण पत्र'] },
            { name: 'Challan', aliases: ['challan', 'चालान'] },
            { name: 'Demand Note', aliases: ['demand note', 'demand-note', 'डिमांड नोट', 'मांग पत्र'] },
            { name: 'Bank NOC', aliases: ['bank noc', 'bank n.o.c', 'बैंक एनओसी'] },
            { name: 'Income Certificate', aliases: ['income certificate', 'आय प्रमाण पत्र'] },
            { name: 'Electricity Bill', aliases: ['electricity bill', 'electric bill', 'light bill', 'bijli bill', 'बिजली बिल', 'बिजली का बिल'] },
            { name: 'Water Bill', aliases: ['water bill', 'paani bill', 'पानी बिल', 'पानी का बिल'] },
        ];

        const lower = conversationHistory.toLowerCase();
        const codeScanned = DOC_SCAN_MAP.filter(doc => {
            if (doc.name === 'Aadhar Card') {
                // Determine if we should ignore context for Aadhar
                // For 'आधार' we want to avoid picking up 'के आधार पर' or 'आधार पर'
                // We'll replace these false positive phrases before checking for aadhar
                const sanitizedForAadhar = lower.replace(/के\s*आधार\s*पर/g, '').replace(/आधार\s*पर/g, '');
                if (doc.aliases.some(a => sanitizedForAadhar.includes(a.toLowerCase()))) return true;
                if (doc.wordAliases) {
                    return doc.wordAliases.some(a => new RegExp(`\\b${a}\\b`, 'i').test(sanitizedForAadhar));
                }
                return false;
            }

            if (doc.aliases.some(a => lower.includes(a.toLowerCase()))) return true;
            if (doc.wordAliases) {
                return doc.wordAliases.some(a => new RegExp(`\\b${a}\\b`, 'i').test(lower));
            }
            return false;
        }).map(doc => doc.name);

        // ─── AI Chain Call ───
        const extractionPrompt = createDocumentExtractionPrompt({
            ticketId: ticketId,
            flowType: 'Document Extraction',
            conversationHistory: conversationHistory
        });

        let aiResultStr: string;
        try {
            const response = await aiService.generate(extractionPrompt);
            aiResultStr = response.content;
        } catch (e) {
            console.error(`  ⚠️ [Doc Extraction] AI Service failed for ${ticketId}. Falling back to scanner.`);
            return { documents: codeScanned, documentDetails: [], submissionConfirmed: false };
        }

        // Parse JSON output
        let aiResult: any = null;
        try {
            const start = aiResultStr.indexOf('{');
            const end = aiResultStr.lastIndexOf('}');
            if (start !== -1 && end !== -1) {
                aiResult = JSON.parse(aiResultStr.slice(start, end + 1));
            }
        } catch (e) {
            console.warn(`  ⚠️ [Doc Extraction] Failed to parse JSON for ${ticketId}. Falling back.`);
            return { documents: codeScanned, documentDetails: [], submissionConfirmed: false };
        }

        if (!aiResult) return { documents: codeScanned, documentDetails: [], submissionConfirmed: false };

        // ─── Quote Verifier ───
        const foundList = Array.isArray(aiResult.found) ? aiResult.found : [];
        const verified: string[] = [];
        const documentDetails: Array<{ name: string; exactMatch: string; quote: string }> = [];

        // Fuzzy match: Needs ~50% of the quote's words to exist in text
        const verifyQuote = (quote: string, text: string) => {
            if (!quote || quote.length < 5) return false;

            // Extract meaningful words (length > 2)
            const quoteWords = quote.toLowerCase()
                .replace(/[^a-z0-9\u0900-\u097F\s]/g, ' ')
                .split(/\s+/)
                .filter(w => w.length > 2);

            if (quoteWords.length === 0) return true; // If quote only had small words, don't fail it purely on that

            const txtLower = text.toLowerCase().replace(/[^a-z0-9\u0900-\u097F\s]/g, ' ');
            let matchCount = 0;
            for (const w of quoteWords) {
                // simple word boundary match in the sanitized text
                if (txtLower.includes(` ${w} `) || txtLower.startsWith(`${w} `) || txtLower.endsWith(` ${w}`) || txtLower === w) {
                    matchCount++;
                } else if (txtLower.includes(w)) {
                    // fallback to substring if word boundary fails
                    matchCount += 0.5;
                }
            }

            // AI often drops/changes 1-2 words. 40% match of significant words is a safe threshold for a "quote"
            return (matchCount / quoteWords.length) >= 0.4;
        };

        for (const item of foundList) {
            if (!item.document || !item.quote) continue;
            if (verifyQuote(item.quote, conversationHistory)) {
                verified.push(item.document);
                documentDetails.push({
                    name: item.document,
                    exactMatch: item.exactMatch || item.document, // Fallback if AI didn't return it
                    quote: item.quote
                });
            }
        }

        // ─── Final Output Logic ───
        const finalUnion = [...new Set([...verified, ...codeScanned])];

        // Add minimal details for documents found by scanner but missed by AI
        for (const docName of codeScanned) {
            if (!verified.includes(docName)) {
                // Find matching alias to include as exactMatch
                const docObj = DOC_SCAN_MAP.find(d => d.name === docName);
                let exactMatch = docName;
                let quote = "Document identified by system scanner.";

                if (docObj) {
                    const lowerText = conversationHistory.toLowerCase();
                    const matchedAlias = docObj.aliases.find(a => lowerText.includes(a.toLowerCase()));
                    if (matchedAlias) {
                        exactMatch = matchedAlias;
                        const matchIdx = lowerText.indexOf(matchedAlias.toLowerCase());
                        const snippetStart = Math.max(0, matchIdx - 60);
                        const snippetEnd = Math.min(conversationHistory.length, matchIdx + matchedAlias.length + 60);
                        quote = "..." + conversationHistory.substring(snippetStart, snippetEnd).replace(/\n/g, ' ').trim() + "...";
                    } else if (docObj.wordAliases) {
                        const matchedWord = docObj.wordAliases.find(a => new RegExp(`\\b${a}\\b`, 'i').test(lowerText));
                        if (matchedWord) {
                            exactMatch = matchedWord;
                            const match = lowerText.match(new RegExp(`\\b${matchedWord}\\b`, 'i'));
                            if (match && match.index !== undefined) {
                                const snippetStart = Math.max(0, Math.max(0, match.index) - 60);
                                const snippetEnd = Math.min(conversationHistory.length, (match.index || 0) + matchedWord.length + 60);
                                quote = "..." + conversationHistory.substring(snippetStart, snippetEnd).replace(/\n/g, ' ').trim() + "...";
                            }
                        }
                    }
                }

                documentDetails.push({
                    name: docName,
                    exactMatch: exactMatch,
                    quote: quote
                });
            }
        }

        console.log(`📄 [Doc Extraction] Ticket ${ticketId} | Code Scanner: [${codeScanned.join(', ')}] | AI Verified: [${verified.join(', ')}] | Final: [${finalUnion.join(', ')}]`);

        return {
            documents: finalUnion,
            documentDetails,
            submissionConfirmed: !!aiResult.submission_confirmed
        };
    }
}
