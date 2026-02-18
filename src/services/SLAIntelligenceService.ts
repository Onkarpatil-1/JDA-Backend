import { OllamaService } from './OllamaService.js';
import { AIAnalysisService } from './AIAnalysisService.js';
import { ProjectService } from './ProjectService.js';
import {
    createAnomalyDetectionPrompt,
    createPredictionPrompt,
    createAlertPrompt
} from '../config/promptBuilders.js';
import {
    ANOMALY_DETECTION_SYSTEM_PROMPT,
    PREDICTION_SYSTEM_PROMPT,
    ALERT_SYSTEM_PROMPT,
    CHATBOT_SYSTEM_PROMPT
} from '../prompts/templates.js';
import {
    calculateMean,
    calculateStdDev,
    calculateTrend,
    calculateAverageChange
} from '../utils/mathUtils.js';
import type {
    MetricData,
    TimeSeriesData,
    AnomalyResult,
    PredictionResult,
    AlertRequest,
    AlertResponse,
    ForensicAnalysis
} from '../types/index.js';

/**
 * Main service for SLA Intelligence operations
 */
export class SLAIntelligenceService {
    private ollamaService: OllamaService;
    private projectService?: ProjectService;

    constructor(ollamaService: OllamaService, projectService?: ProjectService) {
        this.ollamaService = ollamaService;
        this.projectService = projectService;
    }

    /**
     * Detect anomalies in metric data
     */
    async detectAnomaly(
        current: MetricData,
        historical: TimeSeriesData
    ): Promise<AnomalyResult> {
        // Perform calculations in service layer
        const mean = calculateMean(historical.values);
        const stdDev = calculateStdDev(historical.values, mean);
        const zScore = (stdDev === 0) ? 0 : (current.value - mean) / stdDev;

        const prompt = createAnomalyDetectionPrompt({
            metricName: current.metricName,
            currentValue: current.value,
            timestamp: current.timestamp,
            historicalMean: mean.toFixed(2),
            historicalStdDev: stdDev.toFixed(2),
            calculatedZScore: zScore.toFixed(2),
            sampleSize: historical.values.length,
            recentValues: historical.values.slice(-10).join(', ')
        });

        const response = await this.ollamaService.generate(prompt, {
            systemPrompt: ANOMALY_DETECTION_SYSTEM_PROMPT,
            format: 'json',
            temperature: 0.2, // Low temperature for consistent results
        });

        try {
            const result = JSON.parse(response.content);
            return {
                ...result,
                detectedAt: new Date().toISOString(),
            };
        } catch (error) {
            console.error('Failed to parse anomaly detection response:', response.content);
            throw new Error('Invalid response format from LLM');
        }
    }

    /**
     * Predict future metric values
     */
    async predictMetrics(
        historical: TimeSeriesData,
        horizonDays: number = 3
    ): Promise<PredictionResult> {
        // Perform calculations in service layer
        const recentValues = historical.values.slice(-14);
        const trend = calculateTrend(recentValues);
        const avgChange = calculateAverageChange(recentValues);
        const mean7Day = calculateMean(recentValues.slice(-7));

        const prompt = createPredictionPrompt({
            metricName: historical.metricName,
            unit: historical.unit || 'N/A',
            dataPoints: historical.values.length,
            recentValues: recentValues.join(', '),
            recentTimestamps: historical.timestamps.slice(-14).join(', '),
            trend: trend,
            avgDailyChange: avgChange.toFixed(2),
            currentValue: recentValues[recentValues.length - 1],
            sevenDayAvg: mean7Day.toFixed(2),
            horizonDays: horizonDays
        });

        const response = await this.ollamaService.generate(prompt, {
            systemPrompt: PREDICTION_SYSTEM_PROMPT,
            format: 'json',
            temperature: 0.3,
        });

        try {
            const result = JSON.parse(response.content);
            return result;
        } catch (error) {
            console.error('Failed to parse prediction response:', response.content);
            throw new Error('Invalid response format from LLM');
        }
    }

    /**
     * Generate alert messages
     */
    async generateAlert(request: AlertRequest): Promise<AlertResponse> {
        const prompt = createAlertPrompt(request);

        const response = await this.ollamaService.generate(prompt, {
            systemPrompt: ALERT_SYSTEM_PROMPT,
            format: 'json',
            temperature: 0.4,
        });

        try {
            const result = JSON.parse(response.content);
            return result;
        } catch (error) {
            console.error('Failed to parse alert response:', response.content);
            throw new Error('Invalid response format from LLM');
        }
    }

    /**
     * General query interface for custom questions
     */
    async query(question: string, context?: Record<string, any>): Promise<string> {
        const contextStr = context ? `\n\nContext: ${JSON.stringify(context, null, 2)}` : '';
        const prompt = `${question}${contextStr}`;

        const response = await this.ollamaService.generate(prompt, {
            systemPrompt: 'You are an expert SLA monitoring assistant. Provide clear, concise answers.',
            temperature: 0.5,
        });

        return response.content;
    }

    /**
     * Chat-based query with conversation history and project context
     */
    async chatQuery(
        question: string,
        conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],
        context?: {
            projectId?: string;
            system?: string;
            data_source?: string;
            capabilities?: string[];
        }
    ): Promise<string> {
        // Build enhanced system prompt with context
        let systemPrompt = CHATBOT_SYSTEM_PROMPT;

        // Add project-specific context if available
        if (context?.projectId && this.projectService) {
            console.log('[CHATBOT DEBUG] Looking for project:', context.projectId);
            const project = this.projectService.getProject(context.projectId);
            console.log('[CHATBOT DEBUG] Project found:', project ? 'YES' : 'NO');
            if (project) {
                // Calculate risk distribution from riskApplications (case-insensitive)
                const highRiskApps = project.statistics.riskApplications.filter(app =>
                    app.category.toUpperCase() === 'HIGH' || app.category.toUpperCase() === 'CRITICAL'
                );
                const mediumRiskApps = project.statistics.riskApplications.filter(app =>
                    app.category.toUpperCase() === 'MEDIUM'
                );
                const lowRiskApps = project.statistics.riskApplications.filter(app =>
                    app.category.toUpperCase() === 'LOW'
                );

                console.log('[CHATBOT DEBUG] High risk apps:', highRiskApps.length);

                systemPrompt += `\n\nCurrent Project Context:
- Project: ${project.metadata.name}
- Total Tickets: ${project.statistics.totalTickets}
- Avg Processing Time: ${project.statistics.avgDaysRested.toFixed(1)} days
- Completion Rate: ${project.statistics.completionRate.toFixed(1)}%
- Anomalies Detected: ${project.statistics.anomalyCount}
- Critical Bottleneck: ${project.statistics.criticalBottleneck?.role || 'None'} (${project.statistics.criticalBottleneck?.cases || 0} cases, ${project.statistics.criticalBottleneck?.avgDelay?.toFixed(1) || 0} days avg delay)
- High Risk Applications: ${highRiskApps.length}
- Medium Risk Applications: ${mediumRiskApps.length}
- Low Risk Applications: ${lowRiskApps.length}`;

                // Add top high-risk applications details (limit to 15 for better coverage)
                if (highRiskApps.length > 0) {
                    systemPrompt += `\n\nDetailed High-Risk Applications (Top 15):`;
                    highRiskApps.slice(0, 15).forEach((app, idx) => {
                        systemPrompt += `\n${idx + 1}. Ticket ${app.id} - ${app.service} (${app.zone})
   - Assigned to: ${app.role}
   - Status: ${app.category} Risk
   - Current Delay: ${app.delay} days
   - Last Action By: ${app.lastActionBy || 'Unknown'}
   - Remark: ${app.remarks?.substring(0, 100) || 'None'}`;
                    });
                }

                // Add Zone Performance context
                if (project.statistics.zonePerformance.length > 0) {
                    systemPrompt += `\n\nZone Performance (Bottom 3 by Delay):`;
                    [...project.statistics.zonePerformance]
                        .sort((a, b) => b.avgTime - a.avgTime)
                        .slice(0, 3)
                        .forEach((zone, idx) => {
                            systemPrompt += `\n${idx + 1}. Zone ${zone.name}: ${zone.avgTime.toFixed(1)} days avg delay, ${zone.onTime.toFixed(1)}% on-time`;
                        });
                }

                // Add Department (Role) Performance
                if (project.statistics.deptPerformance.length > 0) {
                    systemPrompt += `\n\nDepartment Performance (Highest Delay):`;
                    project.statistics.deptPerformance.slice(0, 3).forEach((dept, idx) => {
                        systemPrompt += `\n${idx + 1}. ${dept.name}: ${dept.avgTime.toFixed(1)} days avg delay`;
                    });
                }

                // Add Behavioral Red Flags (Critical for forensic auditing)
                const redFlags = project.statistics.behaviorMetrics.redFlags;
                if (redFlags.length > 0) {
                    systemPrompt += `\n\nBehavioral Red Flags Detected:`;
                    redFlags.slice(0, 5).forEach((flag, idx) => {
                        systemPrompt += `\n- [${flag.severity}] ${flag.type} by ${flag.entity}: ${flag.evidence}`;
                    });
                }

                // Add top performers for reference
                if (project.statistics.topPerformers.length > 0) {
                    systemPrompt += `\n\nTop Performers:`;
                    project.statistics.topPerformers.slice(0, 3).forEach((perf, idx) => {
                        systemPrompt += `\n${idx + 1}. ${perf.name} (${perf.role}) - ${perf.tasks} tasks, ${perf.avgTime.toFixed(1)} days avg`;
                    });
                }
            }
        } else if (this.projectService) {
            // If no specific project selected, include ALL projects data
            const allProjects = this.projectService.getAllProjects();

            if (allProjects.length > 0) {
                systemPrompt += `\n\nAvailable Projects (${allProjects.length} total):`;

                // Add summary of all projects
                allProjects.forEach((proj, idx) => {
                    systemPrompt += `\n${idx + 1}. ${proj.name} (ID: ${proj.id})
   - Uploaded: ${new Date(proj.uploadedAt).toLocaleDateString()}
   - Total Tickets: ${proj.totalTickets}
   - Avg Processing: ${proj.avgProcessingTime.toFixed(1)} days
   - Completion Rate: ${proj.completionRate.toFixed(1)}%`;
                });

                // Get detailed data from the first project for context
                const firstProject = this.projectService.getProject(allProjects[0].id);
                if (firstProject) {
                    const highRiskApps = firstProject.statistics.riskApplications.filter(app => app.category === 'HIGH');

                    systemPrompt += `\n\nDetailed Data from "${firstProject.metadata.name}":`;
                    systemPrompt += `\n- Anomalies: ${firstProject.statistics.anomalyCount}`;
                    systemPrompt += `\n- Critical Bottleneck: ${firstProject.statistics.criticalBottleneck?.role || 'None'}`;

                    // Add sample high-risk tickets
                    if (highRiskApps.length > 0) {
                        systemPrompt += `\n\nSample High-Risk Tickets:`;
                        highRiskApps.slice(0, 3).forEach((app, idx) => {
                            systemPrompt += `\n${idx + 1}. Ticket ${app.id} - ${app.service}
   - Risk Score: ${app.risk.toFixed(2)}, Delay: ${app.delay} days`;
                        });
                    }
                }
            }
        }

        // Build message array for chat API
        const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
            { role: 'system', content: systemPrompt }
        ];

        // Add conversation history (limit to last 10 messages for context window)
        const recentHistory = conversationHistory.slice(-10);
        messages.push(...recentHistory);

        // Add current question
        messages.push({ role: 'user', content: question });

        // Use chat API for conversation-aware responses
        const response = await this.ollamaService.chat(messages, {
            temperature: 0.6, // Slightly higher for more natural conversation
        });

        return response.content;
    }

    /**
     * Analyze raw text for playground
     */
    async analyzeText(text: string): Promise<ForensicAnalysis | undefined> {
        const aiAnalysisService = new AIAnalysisService();
        return aiAnalysisService.analyzeGenericRemarks(text, this.ollamaService);
    }
}
