import type { MetricData, TimeSeriesData } from '../types/index.js';

/**
 * Generate prompt for anomaly detection
 */
export function createAnomalyDetectionPrompt(
    current: MetricData,
    historical: TimeSeriesData
): string {
    const mean = calculateMean(historical.values);
    const stdDev = calculateStdDev(historical.values, mean);
    const zScore = (current.value - mean) / stdDev;

    return `You are an expert SLA monitoring system analyzing metrics for anomalies.

**Current Metric Data:**
- Metric Name: ${current.metricName}
- Current Value: ${current.value}
- Timestamp: ${current.timestamp}

**Historical Context:**
- Historical Mean: ${mean.toFixed(2)}
- Standard Deviation: ${stdDev.toFixed(2)}
- Calculated Z-Score: ${zScore.toFixed(2)}
- Sample Size: ${historical.values.length} data points
- Recent Values: [${historical.values.slice(-10).join(', ')}]

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
    "zScore": ${zScore.toFixed(2)},
    "threshold": 2,
    "historicalMean": ${mean.toFixed(2)},
    "historicalStdDev": ${stdDev.toFixed(2)}
  }
}

**Severity Guidelines:**
- NORMAL: Z-score < 2, no concern
- WARNING: 2 <= Z-score < 3, monitor closely
- CRITICAL: Z-score >= 3, immediate attention required

Respond ONLY with valid JSON, no additional text.`;
}

/**
 * System prompt for anomaly detection
 */
export const ANOMALY_DETECTION_SYSTEM_PROMPT = `You are a specialized AI system for SLA monitoring and anomaly detection. You analyze metrics using statistical methods and provide actionable insights. Always respond in valid JSON format. Be precise with numerical calculations and conservative with severity classifications.`;

// Helper functions
function calculateMean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
}

function calculateStdDev(values: number[], mean: number): number {
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
}
