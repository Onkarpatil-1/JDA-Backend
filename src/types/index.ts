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
    employeeName?: string; // New: Actual Name
    departmentName?: string;
    parentServiceName?: string;
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
        globalTopics: Array<{ topic: string; count: number; sentiment: 'negative' | 'neutral' }>; // New field
    };
    aiInsights?: AIInsights; // AI-powered analysis results
    jdaHierarchy?: JDAIntelligence; // Rule-based hierarchy
}

// JDA Intelligence Hierarchy Types
export interface JDATicket {
    ticketId: string;
    stepOwnerName: string; // New: Actual Name
    stepOwnerRole: string; // Post
    remarkOriginal: string; // LifeTimeRemarksFrom
    remarkEnglishSummary: string;
    employeeAnalysis?: string; // New: AI analysis of employee actions
    applicantAnalysis?: string; // New: AI analysis of applicant perspective
    detectedCategory: string; // 7 categories
    daysRested: number;
}

export interface JDAService {
    name: string;
    serviceLevelInsight: string;
    tickets: JDATicket[];
}

export interface JDAParentService {
    name: string;
    services: JDAService[];
}

export interface JDADepartment {
    name: string;
    parentServices: JDAParentService[];
}

export interface JDAIntelligence {
    departments: JDADepartment[];
}

export interface ForensicAnalysis {
    overallRemarkAnalysis?: {
        employeeRemarksOverall: {
            totalEmployeeRemarks: number;
            summary: string;
            commonThemes: string[];
            communicationQuality: string;
            responseTimeliness: string;
            inactionPatterns: string[];
            topEmployeeActions: string[];
        };
        applicantRemarksOverall: {
            totalApplicantRemarks: number;
            summary: string;
            commonThemes: string[];
            complianceLevel: string;
            sentimentTrend: string;
            delayPatterns: string[];
            topApplicantConcerns: string[];
        };
    };
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
    remarkAnalysis?: ForensicAnalysis;
    // Per-ticket forensic analysis map (NEW)
    forensicReports?: Record<string, ForensicAnalysis>;
    // New JDA Intelligence Structure
    jdaIntelligence?: JDAIntelligence;
}
