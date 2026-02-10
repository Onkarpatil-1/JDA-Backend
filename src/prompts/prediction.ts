import type { TimeSeriesData } from '../types/index.js';

/**
 * Generate prompt for time-series prediction
 */
export function createPredictionPrompt(
    historical: TimeSeriesData,
    horizonDays: number = 3
): string {
    const recentValues = historical.values.slice(-14); // Last 2 weeks
    const trend = calculateTrend(recentValues);
    const avgChange = calculateAverageChange(recentValues);

    return `You are an expert time-series forecasting system for SLA metrics.

**Historical Data:**
- Metric Name: ${historical.metricName}
- Unit: ${historical.unit || 'N/A'}
- Data Points: ${historical.values.length}
- Recent Values (last 14): [${recentValues.join(', ')}]
- Recent Timestamps: [${historical.timestamps.slice(-14).join(', ')}]

**Statistical Analysis:**
- Trend Direction: ${trend}
- Average Daily Change: ${avgChange.toFixed(2)}
- Current Value: ${recentValues[recentValues.length - 1]}
- 7-day Average: ${calculateMean(recentValues.slice(-7)).toFixed(2)}

**Task:**
Predict the next ${horizonDays} values for this metric using:
1. Historical trend analysis
2. Seasonal patterns (if any)
3. Recent volatility
4. Domain knowledge of SLA metrics

**Output Format (JSON):**
{
  "predictions": [
    {
      "timestamp": "YYYY-MM-DD",
      "predictedValue": number,
      "confidence": number (0-1)
    }
  ],
  "trend": "INCREASING" | "DECREASING" | "STABLE",
  "explanation": "Brief explanation of prediction rationale",
  "modelUsed": "Statistical trend analysis with LLM reasoning"
}

**Guidelines:**
- Predictions should be realistic based on historical data
- Confidence should decrease for longer horizons
- Consider that SLA metrics typically have upper/lower bounds
- Account for day-of-week patterns if visible

Respond ONLY with valid JSON, no additional text.`;
}

/**
 * System prompt for predictions
 */
export const PREDICTION_SYSTEM_PROMPT = `You are a specialized AI forecasting system for SLA and performance metrics. You combine statistical analysis with domain knowledge to make accurate predictions. Always respond in valid JSON format. Be conservative with predictions and honest about uncertainty.`;

// Helper functions
function calculateTrend(values: number[]): 'INCREASING' | 'DECREASING' | 'STABLE' {
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const firstAvg = calculateMean(firstHalf);
    const secondAvg = calculateMean(secondHalf);

    const change = ((secondAvg - firstAvg) / firstAvg) * 100;

    if (change > 5) return 'INCREASING';
    if (change < -5) return 'DECREASING';
    return 'STABLE';
}

function calculateAverageChange(values: number[]): number {
    let totalChange = 0;
    for (let i = 1; i < values.length; i++) {
        totalChange += values[i] - values[i - 1];
    }
    return totalChange / (values.length - 1);
}

function calculateMean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
}
