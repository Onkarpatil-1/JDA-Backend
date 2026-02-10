/**
 * AI System Configuration & Constants
 * Edit this file to change the "persona" or "behavior" of the AI.
 */

// --------------------------------------------------------------------------
// SYSTEM PROMPTS (The "Brain" Instructions)
// --------------------------------------------------------------------------

// --------------------------------------------------------------------------
// OPERATION CONSTANTS (Thresholds & Limits)
// --------------------------------------------------------------------------

export const AI_CONFIG = {
    /** Z-Score threshold. If |z| > this, it's an anomaly. */
    ANOMALY_Z_SCORE_THRESHOLD: 2,

    /** Current Z-Score warning range start [2, 3) */
    ANOMALY_WARNING_THRESHOLD: 2,

    /** Current Z-Score critical range start [3, infinity) */
    ANOMALY_CRITICAL_THRESHOLD: 3,

    /** How many days into the future to predict by default */
    PREDICTION_DEFAULT_HORIZON: 3,

    /** Max length of alert messages in characters */
    ALERT_MAX_LENGTH: 200,

    /** Number of historical data points to consider "Recent" */
    RECENT_HISTORY_WINDOW: 10,

    /** Number of days for time-series context */
    TIME_SERIES_WINDOW: 14
};
