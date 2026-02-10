/**
 * Mathematical and statistical utility functions for SLA analysis
 */

/**
 * Calculate mean of an array of numbers
 */
export function calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate standard deviation
 */
export function calculateStdDev(values: number[], mean: number): number {
    if (values.length === 0) return 0;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
}

/**
 * Calculate trend direction
 */
export function calculateTrend(values: number[]): 'INCREASING' | 'DECREASING' | 'STABLE' {
    if (values.length < 2) return 'STABLE';

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const firstAvg = calculateMean(firstHalf);
    const secondAvg = calculateMean(secondHalf);

    if (firstAvg === 0) return 'STABLE'; // Avoid division by zero

    const change = ((secondAvg - firstAvg) / firstAvg) * 100;

    if (change > 5) return 'INCREASING';
    if (change < -5) return 'DECREASING';
    return 'STABLE';
}

/**
 * Calculate average daily rate of change
 */
export function calculateAverageChange(values: number[]): number {
    if (values.length < 2) return 0;

    let totalChange = 0;
    for (let i = 1; i < values.length; i++) {
        totalChange += values[i] - values[i - 1];
    }
    return totalChange / (values.length - 1);
}
