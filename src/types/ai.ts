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
    conversationHistory: string;
    categoryIdentified: string;
    documentsExtracted: string;
}

/** Context for document extraction prompt */
export interface DocumentExtractionContext {
    ticketId: string;
    flowType: string;
    conversationHistory: string;
}

/** Context for category classification prompt */
export interface CategoryClassificationContext {
    ticketId: string;
    flowType: string;
    conversationHistory: string;
    documentsExtracted: string;
}

/** Context for zone outlier report prompt */
export interface ZoneOutlierReportContext {
    ticketId: string;
    zone: string;
    flowType: string;
    totalDelay: number;
    employeeName: string;
    conversationHistory: string;
    submittedDocuments: string; // Comma-separated confirmed submitted docs
    requestedDocuments: string; // Comma-separated docs the employee requested
}
