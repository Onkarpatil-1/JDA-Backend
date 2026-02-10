import type { ProjectStatistics } from '../types/index.js';

/**
 * Context for anomaly analysis prompt
 */
export interface AnomalyAnalysisContext {
    anomalyCount: number;
    avgProcessingTime: string;
    maxProcessingTime: number;
    stdDev: string;
    topPerformers: string;
    highRiskApps: string;
    bottleneckRole: string;
    bottleneckCases: number;
    bottleneckAvgDelay: string;
}

/**
 * Generate prompt for anomaly analysis
 */
export const createAnomalyAnalysisPrompt = (context: AnomalyAnalysisContext): string => {
    return `You are an expert SLA workflow analyst. Analyze these specific anomalies and performance data:

Project Statistics:
- Total Anomalies: ${context.anomalyCount}
- Average Processing Time: ${context.avgProcessingTime} days
- Max Processing Time: ${context.maxProcessingTime} days
- Standard Deviation: ${context.stdDev} days

Top Performing Employees:
${context.topPerformers || 'None identified'}

High-Risk Applications & Services:
${context.highRiskApps || 'None identified'}

Critical Bottleneck:
- Role: ${context.bottleneckRole}
- Cases: ${context.bottleneckCases}
- Average Delay: ${context.bottleneckAvgDelay} days

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
};

/**
 * Context for bottleneck prediction prompt
 */
export interface BottleneckPredictionContext {
    completionRate: string;
    bottleneckRole: string;
    thresholdExceeded: number;
    zonePerformance: string;
    deptPerformance: string;
    highRiskApps: string;
}

/**
 * Generate prompt for bottleneck prediction
 */
export const createBottleneckPredictionPrompt = (context: BottleneckPredictionContext): string => {
    return `You are an expert SLA workflow predictor. Predict future bottlenecks based on this data:

Current Metrics:
- Completion Rate: ${context.completionRate}%
- Critical Bottleneck: ${context.bottleneckRole}
- Threshold Exceeded: ${context.thresholdExceeded}%

Zone Performance:
${context.zonePerformance}

Role/Dept Performance:
${context.deptPerformance}

Specific At-Risk Cases:
${context.highRiskApps}

Task: Predict likely bottlenecks in the next 30 days. 
IMPORTANT: 
- Max 2 bullet points.
- Use names of services, zones, and roles.
- Be extremely blunt and direct.

PREDICTION:`;
};

/**
 * Context for tabular insights prompt
 */
export interface TabularInsightsContext {
    topPerformers: string;
    zonePerformance: string;
    riskApplications: string;
    behavioralRedFlags: string;
}

/**
 * Generate prompt for tabular insights
 */
export const createTabularInsightsPrompt = (context: TabularInsightsContext): string => {
    return `You are a Senior SLA Diagnostic Auditor. Your goal is to find the LOGICAL REASON for delays and identify INTERNAL RED FLAGS where employees may be forcefully delaying tickets.
 
Employee Context:
${context.topPerformers}

Behavioral Red Flags (Data-Detected):
${context.behavioralRedFlags || 'No obvious behavioral anomalies detected.'}

Zone Context:
${context.zonePerformance}

Detailed At-Risk Applications (with History):
${context.riskApplications}

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
};

/**
 * Context for recommendations prompt
 */
export interface RecommendationsContext {
    anomalyCount: number;
    avgProcessingTime: string;
    bottleneckRole: string;
    bottleneckAvgDelay: string;
    topPerformers: string;
    primaryZones: string;
}

/**
 * Generate prompt for recommendations
 */
export const createRecommendationsPrompt = (context: RecommendationsContext): string => {
    return `You are an SLA workflow optimization expert. Suggest 3 specific, actionable recommendations:

Current Data Points:
- Anomaly Count: ${context.anomalyCount}
- Average Time: ${context.avgProcessingTime} days
- Critical Bottleneck: ${context.bottleneckRole} (${context.bottleneckAvgDelay} days avg)
- Top Performers: ${context.topPerformers}
- Primary Zones: ${context.primaryZones}

Task: Provide 3 concrete recommendations. 
IMPORTANT:
- Max 10 words per recommendation.
- Use action verbs.
- Mention specific roles/zones.

Format:
1. [Recommendation]
2. [Recommendation]
3. [Recommendation]`;
};
