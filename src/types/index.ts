// Core Types for SLA Intelligence

export interface MetricData {
    timestamp: string;
    value: number;
    metricName: string;
    metadata?: Record<string, any>;
}

export interface TimeSeriesData {
    metricName: string;
    values: number[];
    timestamps: string[];
    unit?: string;
}

export interface AnomalyResult {
    isAnomaly: boolean;
    severity: 'NORMAL' | 'WARNING' | 'CRITICAL';
    score: number;
    explanation: string;
    confidence: number;
    detectedAt: string;
    metadata?: {
        zScore?: number;
        threshold?: number;
        historicalMean?: number;
        historicalStdDev?: number;
    };
}

export interface PredictionResult {
    predictions: Array<{
        timestamp: string;
        predictedValue: number;
        confidence: number;
    }>;
    trend: 'INCREASING' | 'DECREASING' | 'STABLE';
    explanation: string;
    modelUsed: string;
}

export interface AlertRequest {
    metricName: string;
    currentValue: number;
    threshold: number;
    severity: 'WARNING' | 'CRITICAL';
    context?: string;
}

export interface AlertResponse {
    message: string;
    recommendation: string;
    urgency: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface OllamaConfig {
    host: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
}

export interface LLMResponse {
    content: string;
    model: string;
    tokensUsed?: number;
    responseTime: number;
}

// CSV Upload and Project Management Types
export interface WorkflowStep {
    ticketId: string;
    serviceName: string;
    post: string;
    zoneId: string;
    applicationDate: string;
    deliveredOn: string;
    totalDaysRested: number;
    lifetimeRemarks?: string;
    lifetimeRemarksFrom?: string;
    numberOfEntries?: number;
    applicantName?: string;
    rawRow?: Record<string, any>;
}

export interface ProjectMetadata {
    id: string;
    name: string;
    uploadedAt: string;
    totalRecords: number;
    totalTickets: number;
    avgProcessingTime: number;
    completionRate: number;
}

export interface ProjectData {
    metadata: ProjectMetadata;
    workflowSteps: WorkflowStep[];
    statistics: ProjectStatistics;
}

export interface ProjectStatistics {
    totalWorkflowSteps: number;
    totalTickets: number;
    avgDaysRested: number;
    maxDaysRested: number;
    minDaysRested: number;
    stdDaysRested: number;
    completedTickets: number;
    completionRate: number;
    anomalyCount: number;
    criticalBottleneck?: {
        role: string;
        cases: number;
        avgDelay: number;
        thresholdExceeded: number;
    };
    topPerformers: Array<{
        name: string;
        role: string;
        tasks: number;
        avgTime: number;
    }>;
    riskApplications: Array<{
        id: string;
        service: string;
        zone: string;
        role: string;
        dueDate: string;
        risk: number;
        category: string;
        delay: number;
        zScore: number;
        remarks?: string;
        lastActionBy?: string;
        applicantName?: string;
        rawRow?: Record<string, any>;
    }>;
    zonePerformance: Array<{
        name: string;
        onTime: number;
        avgTime: number;
    }>;
    deptPerformance: Array<{
        name: string;
        avgTime: number;
    }>;
    behaviorMetrics: {
        employeeRemarks: Array<{
            employeeName: string;
            remarks: Array<{
                text: string;
                count: number;
            }>;
            topDelayReason: string;
            anomalyScore: number; // 0 to 1 based on repetition and delays
        }>;
        redFlags: Array<{
            type: 'REPEATED_REMARK' | 'UNUSUAL_DELAY' | 'PROCESS_ORPHAN';
            entity: string;
            evidence: string;
            severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        }>;
    };
    aiInsights?: AIInsights; // AI-powered analysis results
}

// AI-Powered Insights
export interface AIInsights {
    anomalyPatterns: string;
    rootCause: string;
    predictions: string;
    recommendations: string[];
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    confidence: number;
    // Tabular insights
    employeeEfficiencyTable?: string;
    zoneEfficiencyTable?: string;
    breachRiskTable?: string;
    highPriorityTable?: string;
    behavioralRedFlagsTable?: string;
}
