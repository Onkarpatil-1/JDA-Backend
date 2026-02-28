/**
 * AI Prompt Builders
 * These functions take data context and return the final interpolated prompt string.
 */

import { interpolate } from '../utils/promptUtils.js';
import { AI_CONFIG } from './aiConfig.js';
import {
    ANOMALY_ANALYSIS_USER_PROMPT,
    BOTTLENECK_PREDICTION_USER_PROMPT,
    RECOMMENDATIONS_USER_PROMPT,
    REMARK_ANALYSIS_USER_PROMPT,
    DOCUMENT_EXTRACTION_USER_PROMPT,
    CATEGORY_CLASSIFICATION_PROMPT,
    ZONE_OUTLIER_REPORT_PROMPT
} from '../prompts/templates.js';

import type {
    AnomalyAnalysisContext,
    BottleneckPredictionContext,
    RecommendationsContext,
    RemarkAnalysisContext,
    DocumentExtractionContext,
    CategoryClassificationContext,
    ZoneOutlierReportContext
} from '../types/ai.js';


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
    const data = `
Completion Rate: ${context.completionRate}%
Critical Bottleneck: ${context.bottleneckRole} (${context.thresholdExceeded} cases exceeding threshold)
Zone Performance:
${context.zonePerformance}
Department Performance:
${context.deptPerformance}
High Risk Applications:
${context.highRiskApps}
    `.trim();

    return interpolate(BOTTLENECK_PREDICTION_USER_PROMPT, { bottleneckData: data });
};

export const createRecommendationsPrompt = (context: RecommendationsContext): string => {
    return interpolate(RECOMMENDATIONS_USER_PROMPT, context);
};



export const createRemarkAnalysisPrompt = (context: RemarkAnalysisContext): string => {
    return interpolate(REMARK_ANALYSIS_USER_PROMPT, context);
};

export const createDocumentExtractionPrompt = (context: DocumentExtractionContext): string => {
    return interpolate(DOCUMENT_EXTRACTION_USER_PROMPT, context);
};

export const createCategoryClassificationPrompt = (context: CategoryClassificationContext): string => {
    return interpolate(CATEGORY_CLASSIFICATION_PROMPT, context);
};

export const createZoneOutlierReportPrompt = (context: ZoneOutlierReportContext): string => {
    return interpolate(ZONE_OUTLIER_REPORT_PROMPT, {
        ...context,
        totalDelay: String(context.totalDelay)
    });
};
