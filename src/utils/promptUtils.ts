/**
 * Prompt Utility Functions
 */

/**
 * Replaces {{placeholder}} in a template string with values from the context object.
 * Handles undefined values by replacing them with an empty string or a default.
 * 
 * @param template The template string containing {{variableName}}
 * @param context The object containing values to inject
 * @returns The interpolated string
 */
export function interpolate(template: string, context: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return context[key] !== undefined && context[key] !== null
            ? String(context[key])
            : ''; // specific fallback can be handled in builder if needed
    });
}
