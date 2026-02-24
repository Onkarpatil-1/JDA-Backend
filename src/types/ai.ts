/**
 * AI Type Definitions
 * Shared interfaces for AI prompts, contexts, and configurations.
 */


// --------------------------------------------------------------------------
// PROMPT CONTEXT TYPES
// --------------------------------------------------------------------------

/** Context for anomaly analysis prompt */
export interface AnomalyAnalysisContext {
    projectName: string;
    totalTickets: number;
    totalWorkflowSteps: number;
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

/** Context for bottleneck prediction prompt */
export interface BottleneckPredictionContext {
    completionRate: string;
    bottleneckRole: string;
    thresholdExceeded: number;
    zonePerformance: string;
    deptPerformance: string;
    highRiskApps: string;
}

/** Context for recommendations prompt */
export interface RecommendationsContext {
    anomalyCount: number;
    avgProcessingTime: string;
    bottleneckRole: string;
    bottleneckAvgDelay: string;
    primaryZones: string;
    rootCause: string;
    topThemes: string;
}


/** Context for remark analysis prompt */
export interface RemarkAnalysisContext {
    ticketId: string;
    flowType: string;
    flowTypeParent: string; // New field for context
    conversationHistory: string;
    totalDelay: number;
    employeeName: string;
    stage: string;
}
