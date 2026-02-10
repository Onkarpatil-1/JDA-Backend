/**
 * AI Type Definitions
 * Shared interfaces for AI prompts, contexts, and configurations.
 */

import type { AlertRequest } from './index.js';

// --------------------------------------------------------------------------
// PROMPT CONTEXT TYPES
// --------------------------------------------------------------------------

/** Context for anomaly analysis prompt */
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

/** Context for bottleneck prediction prompt */
export interface BottleneckPredictionContext {
    completionRate: string;
    bottleneckRole: string;
    thresholdExceeded: number;
    zonePerformance: string;
    deptPerformance: string;
    highRiskApps: string;
}

/** Context for tabular insights prompt */
export interface TabularInsightsContext {
    topPerformers: string;
    zonePerformance: string;
    riskApplications: string;
    behavioralRedFlags: string;
}

/** Context for recommendations prompt */
export interface RecommendationsContext {
    anomalyCount: number;
    avgProcessingTime: string;
    bottleneckRole: string;
    bottleneckAvgDelay: string;
    topPerformers: string;
    primaryZones: string;
}

/** Context for prediction prompt */
export interface PredictionContext {
    metricName: string;
    unit: string;
    dataPoints: number;
    recentValues: string;
    recentTimestamps: string;
    trend: 'INCREASING' | 'DECREASING' | 'STABLE';
    avgDailyChange: string;
    currentValue: number;
    sevenDayAvg: string;
    horizonDays: number;
}

/** Context for anomaly detection prompt */
export interface AnomalyDetectionContext {
    metricName: string;
    currentValue: number;
    timestamp: string;
    historicalMean: string;
    historicalStdDev: string;
    calculatedZScore: string;
    sampleSize: number;
    recentValues: string;
}
