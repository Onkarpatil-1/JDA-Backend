/**
 * Context for prediction prompt
 */
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

/**
 * Generate prompt for time-series prediction
 */
export const createPredictionPrompt = (context: PredictionContext): string => {
  return `You are an expert time-series forecasting system for SLA metrics.

**Historical Data:**
- Metric Name: ${context.metricName}
- Unit: ${context.unit}
- Data Points: ${context.dataPoints}
- Recent Values (last 14): [${context.recentValues}]
- Recent Timestamps: [${context.recentTimestamps}]

**Statistical Analysis:**
- Trend Direction: ${context.trend}
- Average Daily Change: ${context.avgDailyChange}
- Current Value: ${context.currentValue}
- 7-day Average: ${context.sevenDayAvg}

**Task:**
Predict the next ${context.horizonDays} values for this metric using:
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
};

/**
 * System prompt for predictions
 */
export const PREDICTION_SYSTEM_PROMPT = `You are a specialized AI forecasting system for SLA and performance metrics. You combine statistical analysis with domain knowledge to make accurate predictions. Always respond in valid JSON format. Be conservative with predictions and honest about uncertainty.`;
