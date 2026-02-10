/**
 * AI Prompt Builders
 * These functions take data context and return the final interpolated prompt string.
 */

import { interpolate } from '../utils/promptUtils.js';
import { AI_CONFIG } from './aiConfig.js';
import {
    ANOMALY_ANALYSIS_USER_PROMPT,
    BOTTLENECK_PREDICTION_USER_PROMPT,
    TABULAR_INSIGHTS_USER_PROMPT,
    RECOMMENDATIONS_USER_PROMPT,
    PREDICTION_USER_PROMPT,
    ANOMALY_DETECTION_USER_PROMPT,
    ALERT_USER_PROMPT
} from '../prompts/templates.js';

import type {
    AnomalyAnalysisContext,
    BottleneckPredictionContext,
    TabularInsightsContext,
    RecommendationsContext,
    PredictionContext,
    AnomalyDetectionContext
} from '../types/ai.js';

import type { AlertRequest } from '../types/index.js';


// --------------------------------------------------------------------------
// ANOMALY & ANALYSIS BUILDERS
// --------------------------------------------------------------------------

export const createAnomalyAnalysisPrompt = (context: AnomalyAnalysisContext): string => {
    return interpolate(ANOMALY_ANALYSIS_USER_PROMPT, {
        ...context,
        topPerformers: context.topPerformers || 'None identified',
        highRiskApps: context.highRiskApps || 'None identified'
    });
};

export const createBottleneckPredictionPrompt = (context: BottleneckPredictionContext): string => {
    return interpolate(BOTTLENECK_PREDICTION_USER_PROMPT, context);
};

export const createTabularInsightsPrompt = (context: TabularInsightsContext): string => {
    return interpolate(TABULAR_INSIGHTS_USER_PROMPT, {
        ...context,
        behavioralRedFlags: context.behavioralRedFlags || 'No obvious behavioral anomalies detected.'
    });
};

export const createRecommendationsPrompt = (context: RecommendationsContext): string => {
    return interpolate(RECOMMENDATIONS_USER_PROMPT, context);
};


// --------------------------------------------------------------------------
// PREDICTION & ANOMALY DETECTION BUILDERS
// --------------------------------------------------------------------------

export const createPredictionPrompt = (context: PredictionContext): string => {
    return interpolate(PREDICTION_USER_PROMPT, {
        ...context,
        recentHistoryWindow: AI_CONFIG.TIME_SERIES_WINDOW
    });
};

export const createAnomalyDetectionPrompt = (context: AnomalyDetectionContext): string => {
    return interpolate(ANOMALY_DETECTION_USER_PROMPT, {
        ...context,
        zScoreThreshold: AI_CONFIG.ANOMALY_Z_SCORE_THRESHOLD,
        warningThreshold: AI_CONFIG.ANOMALY_WARNING_THRESHOLD,
        criticalThreshold: AI_CONFIG.ANOMALY_CRITICAL_THRESHOLD
    });
};


// --------------------------------------------------------------------------
// ALERT BUILDERS
// --------------------------------------------------------------------------

export function createAlertPrompt(request: AlertRequest): string {
    const deviation = ((request.currentValue - request.threshold) / request.threshold) * 100;

    return interpolate(ALERT_USER_PROMPT, {
        metricName: request.metricName,
        currentValue: request.currentValue,
        threshold: request.threshold,
        deviation: deviation.toFixed(1),
        severity: request.severity,
        additionalContext: request.context ? `- Additional Context: ${request.context}` : '',
        alertMaxLength: AI_CONFIG.ALERT_MAX_LENGTH
    });
}
