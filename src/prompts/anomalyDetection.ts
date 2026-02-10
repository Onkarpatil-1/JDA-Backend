import type { MetricData } from '../types/index.js';

/**
 * Context for anomaly detection prompt
 */
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

/**
 * Generate prompt for anomaly detection
 */
export const createAnomalyDetectionPrompt = (context: AnomalyDetectionContext): string => {
  return `You are an expert SLA monitoring system analyzing metrics for anomalies.

**Current Metric Data:**
- Metric Name: ${context.metricName}
- Current Value: ${context.currentValue}
- Timestamp: ${context.timestamp}

**Historical Context:**
- Historical Mean: ${context.historicalMean}
- Standard Deviation: ${context.historicalStdDev}
- Calculated Z-Score: ${context.calculatedZScore}
- Sample Size: ${context.sampleSize} data points
- Recent Values: [${context.recentValues}]

**Task:**
Analyze if the current value is anomalous based on:
1. Z-score threshold (|z| > 2 indicates anomaly)
2. Recent trend patterns
3. Business context for SLA metrics

**Output Format (JSON):**
{
  "isAnomaly": boolean,
  "severity": "NORMAL" | "WARNING" | "CRITICAL",
  "score": number (0-100),
  "explanation": "Brief explanation of why this is/isn't anomalous",
  "confidence": number (0-1),
  "metadata": {
    "zScore": ${context.calculatedZScore},
    "threshold": 2,
    "historicalMean": ${context.historicalMean},
    "historicalStdDev": ${context.historicalStdDev}
  }
}

**Severity Guidelines:**
- NORMAL: Z-score < 2, no concern
- WARNING: 2 <= Z-score < 3, monitor closely
- CRITICAL: Z-score >= 3, immediate attention required

Respond ONLY with valid JSON, no additional text.`;
};

/**
 * System prompt for anomaly detection
 */
export const ANOMALY_DETECTION_SYSTEM_PROMPT = `You are a specialized AI system for SLA monitoring and anomaly detection. You analyze metrics using statistical methods and provide actionable insights. Always respond in valid JSON format. Be precise with numerical calculations and conservative with severity classifications.`;
