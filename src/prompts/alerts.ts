import type { AlertRequest } from '../types/index.js';

/**
 * Generate prompt for alert message creation
 */
export function createAlertPrompt(request: AlertRequest): string {
    const deviation = ((request.currentValue - request.threshold) / request.threshold) * 100;

    return `You are an SLA alert generation system creating actionable alerts for operations teams.

**Alert Context:**
- Metric Name: ${request.metricName}
- Current Value: ${request.currentValue}
- Threshold: ${request.threshold}
- Deviation: ${deviation.toFixed(1)}%
- Severity: ${request.severity}
${request.context ? `- Additional Context: ${request.context}` : ''}

**Task:**
Generate a clear, actionable alert message with:
1. What happened (the issue)
2. Why it matters (impact)
3. What to do (recommendation)

**Output Format (JSON):**
{
  "message": "Clear, concise alert message describing the issue",
  "recommendation": "Specific action steps for the operations team",
  "urgency": "LOW" | "MEDIUM" | "HIGH"
}

**Guidelines:**
- Use clear, non-technical language
- Be specific about the impact
- Provide actionable recommendations
- Match urgency to severity (WARNING=MEDIUM, CRITICAL=HIGH)
- Keep message under 200 characters
- Make recommendations concrete and specific

Respond ONLY with valid JSON, no additional text.`;
}

/**
 * System prompt for alert generation
 */
export const ALERT_SYSTEM_PROMPT = `You are a specialized alert generation system for SLA monitoring. You create clear, actionable alerts that help operations teams respond quickly to issues. Always respond in valid JSON format. Focus on clarity and actionability.`;
