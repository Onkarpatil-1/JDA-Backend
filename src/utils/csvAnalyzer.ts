import type { WorkflowStep, ProjectStatistics, JDAIntelligence, JDADepartment, JDAParentService, JDAService } from '../types/index.js';

/**
 * 7-Point Delay Categorization Framework (Rule-Based)
 */
export function ruleBasedDelayClassification(remark: string): string {
    const r = remark.toLowerCase();

    if (r.includes('missing') || r.includes('incomplete') || r.includes('incorrect') || r.includes('invalid') || r.includes('document')) return 'Documentation Issues';
    if (r.includes('understand') || r.includes('unclear') || r.includes('language') || r.includes('response')) return 'Communication Gaps';
    if (r.includes('approval') || r.includes('coordination') || r.includes('inspection') || r.includes('verification') || r.includes('technical review')) return 'Process Bottlenecks';
    if (r.includes('late') || r.includes('non-compliance') || r.includes('payment') || r.includes('unavailable')) return 'Applicant-Side Issues';
    if (r.includes('delayed processing') || r.includes('workload') || r.includes('system') || r.includes('server') || r.includes('down')) return 'Employee/System-Side Issues';
    if (r.includes('third-party') || r.includes('clearance') || r.includes('utility') || r.includes('audit')) return 'External Dependencies';
    if (r.includes('complex') || r.includes('dispute') || r.includes('legal') || r.includes('policy')) return 'Complexity/Special Cases';

    return 'Uncategorized'; // To be handled by LLM if needed
}

/**
 * Build Hierarchical JDA Data Structure
 */
export function buildJDAHierarchy(steps: WorkflowStep[]): JDAIntelligence {
    const departmentsMap = new Map<string, Map<string, Map<string, WorkflowStep[]>>>();

    // 1. Group by Dept -> Parent Service -> Service
    steps.forEach(step => {
        const deptName = step.departmentName || 'General';
        const parentService = step.parentServiceName || 'General';
        const service = step.serviceName || 'General';

        if (!departmentsMap.has(deptName)) {
            departmentsMap.set(deptName, new Map());
        }
        const parentMap = departmentsMap.get(deptName)!;

        if (!parentMap.has(parentService)) {
            parentMap.set(parentService, new Map());
        }
        const serviceMap = parentMap.get(parentService)!;

        if (!serviceMap.has(service)) {
            serviceMap.set(service, []);
        }
        serviceMap.get(service)!.push(step);
    });

    // 2. Build Output Structure
    const departments: JDADepartment[] = [];

    departmentsMap.forEach((parentMap, deptName) => {
        const parentServices: JDAParentService[] = [];

        parentMap.forEach((serviceMap, parentServiceName) => {
            const services: JDAService[] = [];

            serviceMap.forEach((tickets, serviceName) => {
                // Determine insight for this service level
                const avgDays = tickets.reduce((sum, t) => sum + t.totalDaysRested, 0) / tickets.length;
                const serviceInsight = `Avg Processing: ${avgDays.toFixed(1)} days. Total Tickets: ${tickets.length}`;

                services.push({
                    name: serviceName,
                    serviceLevelInsight: serviceInsight,
                    tickets: tickets.map(t => ({
                        ticketId: t.ticketId,
                        stepOwnerName: t.employeeName || 'Unknown', // Map Name
                        stepOwnerRole: t.post, // Map Role (Designation)
                        remarkOriginal: t.lifetimeRemarksFrom || 'No remarks',
                        remarkEnglishSummary: t.lifetimeRemarksFrom || 'No remarks', // Default to original, LLM will overwrite
                        detectedCategory: ruleBasedDelayClassification(t.lifetimeRemarksFrom || ''),
                        daysRested: t.totalDaysRested
                    }))
                });
            });

            parentServices.push({
                name: parentServiceName,
                services
            });
        });

        departments.push({
            name: deptName,
            parentServices
        });
    });

    return { departments };
}

/**
 * Calculate mean of an array of numbers
 */
function mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate standard deviation
 */
function standardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    const avg = mean(values);
    const squareDiffs = values.map((value) => Math.pow(value - avg, 2));
    return Math.sqrt(mean(squareDiffs));
}

/**
 * Calculate z-score for a value
 */
function zScore(value: number, avg: number, stdDev: number): number {
    if (stdDev === 0) return 0;
    return (value - avg) / stdDev;
}

/**
 * Analyze CSV workflow data and generate statistics
 */
export function analyzeWorkflowData(workflowSteps: WorkflowStep[]): ProjectStatistics {
    const totalWorkflowSteps = workflowSteps.length;

    // Extract unique tickets
    const uniqueTickets = new Set(workflowSteps.map(step => step.ticketId));
    const totalTickets = uniqueTickets.size;

    // Calculate processing time statistics
    const daysRested = workflowSteps.map(step => step.totalDaysRested);
    const avgDaysRested = parseFloat(mean(daysRested).toFixed(2));
    const maxDaysRested = Math.max(...daysRested);
    const minDaysRested = Math.min(...daysRested);
    const stdDaysRested = parseFloat(standardDeviation(daysRested).toFixed(2));

    // Count completed tickets (unique tickets that have a DeliveredOn date in ANY of their steps)
    const completedTicketIds = new Set(
        workflowSteps
            .filter(step => step.deliveredOn && step.deliveredOn !== '' && step.deliveredOn !== 'NULL')
            .map(step => step.ticketId)
    );
    const completedTickets = completedTicketIds.size;

    // Completion rate based on unique tickets
    const completionRate = totalTickets > 0
        ? parseFloat(((completedTickets / totalTickets) * 100).toFixed(1))
        : 0;

    // Identify anomalies (z-score > 3)
    const anomalies = workflowSteps.filter(step => {
        const z = zScore(step.totalDaysRested, avgDaysRested, stdDaysRested);
        return Math.abs(z) > 3;
    });
    const anomalyCount = anomalies.length;

    // Find critical bottleneck (role with highest average delay)
    const excludedRoles = ['APPLICANT', 'CITIZEN', 'SYSTEM', 'UNKNOWN'];

    const roleDelays = new Map<string, number[]>();
    workflowSteps.forEach(step => {
        // Normalize role for check
        const role = step.post.toUpperCase().trim();
        if (!roleDelays.has(step.post) && !excludedRoles.includes(role)) {
            roleDelays.set(step.post, []);
        }

        if (roleDelays.has(step.post)) {
            roleDelays.get(step.post)!.push(step.totalDaysRested);
        }
    });

    let criticalBottleneck: ProjectStatistics['criticalBottleneck'] | undefined;
    let maxAvgDelay = 0;

    roleDelays.forEach((delays, role) => {
        const avgDelay = mean(delays);
        if (avgDelay > maxAvgDelay && delays.length > 5) { // Only consider roles with >5 cases
            maxAvgDelay = avgDelay;
            const threshold = 5; // 5 days threshold
            const thresholdExceeded = ((avgDelay - threshold) / threshold) * 100;
            criticalBottleneck = {
                role,
                cases: delays.length,
                avgDelay: parseFloat(avgDelay.toFixed(1)),
                thresholdExceeded: parseFloat(thresholdExceeded.toFixed(0))
            };
        }
    });

    // Find top performers (employees with best avg time and high task count)
    const employeePerformance = new Map<string, { tasks: number; totalTime: number; role: string }>();

    const excludedEmployees = ['APPLICANT', 'CITIZEN', 'SYSTEM', 'UNKNOWN', 'Admin', 'Administrator'];

    workflowSteps.forEach(step => {
        const employeeName = step.lifetimeRemarksFrom || 'Unknown';
        const normalizedName = employeeName.toUpperCase().trim();

        // Skip if employee matches exclusion list
        if (excludedEmployees.some(ex => normalizedName.includes(ex.toUpperCase()))) {
            return;
        }

        if (!employeePerformance.has(employeeName)) {
            employeePerformance.set(employeeName, { tasks: 0, totalTime: 0, role: step.post });
        }
        const perf = employeePerformance.get(employeeName)!;
        perf.tasks++;
        perf.totalTime += step.totalDaysRested;
    });

    const topPerformers = Array.from(employeePerformance.entries())
        .map(([name, data]) => ({
            name,
            role: data.role,
            tasks: data.tasks,
            avgTime: parseFloat((data.totalTime / data.tasks).toFixed(1))
        }))
        .filter(p => p.tasks >= 10) // Only consider employees with 10+ tasks
        .sort((a, b) => a.avgTime - b.avgTime)
        .slice(0, 5);

    // Identify high-risk applications (concerning delays)
    const riskApplications = workflowSteps
        .map(step => {
            const z = zScore(step.totalDaysRested, avgDaysRested, stdDaysRested);
            const role = (step.lifetimeRemarksFrom || '').toUpperCase();
            const isApplicant = role.includes('APPLICANT') || role.includes('CITIZEN');

            return {
                id: step.ticketId,
                service: step.serviceName,
                zone: step.zoneId,
                role: step.post,
                dueDate: step.applicationDate,
                // Bias risk score slightly if it's an applicant remark to ensure inclusion in qualitative analysis
                risk: Math.min(100, Math.max(0, Math.round((Math.abs(z) / 10) * 100) + (isApplicant ? 20 : 0))),
                category: Math.abs(z) > 10 ? 'Critical' : Math.abs(z) > 5 ? 'High' : 'Medium',
                delay: step.totalDaysRested,
                zScore: parseFloat(z.toFixed(2)),
                remarks: step.lifetimeRemarks,
                lastActionBy: step.lifetimeRemarksFrom,
                applicantName: (step as any).applicantName || undefined,
                rawRow: (step as any).rawRow || undefined,
                isApplicantAction: isApplicant
            };
        })
        // Relax threshold from 3 to 1.5 to capture more context for AI
        .filter(app => Math.abs(app.zScore) > 1.5 || app.isApplicantAction)
        .sort((a, b) => {
            // Priority: Critical z-score first, then applicant remarks to ensure qualitative variety
            if (a.isApplicantAction && !b.isApplicantAction) return -1;
            if (!a.isApplicantAction && b.isApplicantAction) return 1;
            return b.zScore - a.zScore;
        })
        .slice(0, 15); // Increased from 10 to 15 to give AI more variety

    // Calculate zone performance
    const zonePerformance = new Map<string, { totalSteps: number; completedSteps: number; totalTime: number }>();
    workflowSteps.forEach(step => {
        if (!zonePerformance.has(step.zoneId)) {
            zonePerformance.set(step.zoneId, { totalSteps: 0, completedSteps: 0, totalTime: 0 });
        }
        const perf = zonePerformance.get(step.zoneId)!;
        perf.totalSteps++;
        perf.totalTime += step.totalDaysRested;
        if (step.deliveredOn && step.deliveredOn !== '') {
            perf.completedSteps++;
        }
    });

    const zoneData = Array.from(zonePerformance.entries())
        .map(([zone, data]) => ({
            name: zone,
            onTime: parseFloat(((data.completedSteps / data.totalSteps) * 100).toFixed(1)),
            avgTime: parseFloat((data.totalTime / data.totalSteps).toFixed(2))
        }))
        .sort((a, b) => b.onTime - a.onTime)
        .slice(0, 6);

    // Calculate department/role performance
    const deptPerformance = new Map<string, { totalTime: number; count: number }>();
    workflowSteps.forEach(step => {
        if (!deptPerformance.has(step.post)) {
            deptPerformance.set(step.post, { totalTime: 0, count: 0 });
        }
        const perf = deptPerformance.get(step.post)!;
        perf.totalTime += step.totalDaysRested;
        perf.count++;
    });

    const deptData = Array.from(deptPerformance.entries())
        .map(([dept, data]) => ({
            name: dept,
            avgTime: parseFloat((data.totalTime / data.count).toFixed(2))
        }))
        .filter(d => d.avgTime > 0)
        .sort((a, b) => b.avgTime - a.avgTime)
        .slice(0, 5);

    // Behavioral Metrics: Deep dive into employee remark patterns
    const employeeRemarksMap = new Map<string, Map<string, number>>();
    const redFlags: ProjectStatistics['behaviorMetrics']['redFlags'] = [];

    workflowSteps.forEach(step => {
        const name = step.lifetimeRemarksFrom || 'Unknown';
        const remark = (step.lifetimeRemarks || '').trim();

        if (remark && name !== 'Unknown' && name !== 'APPLICANT') {
            if (!employeeRemarksMap.has(name)) {
                employeeRemarksMap.set(name, new Map());
            }
            const remarks = employeeRemarksMap.get(name)!;
            remarks.set(remark, (remarks.get(remark) || 0) + 1);
        }
    });

    const employeeRemarks = Array.from(employeeRemarksMap.entries()).map(([name, remarksMap]) => {
        const sortedRemarks = Array.from(remarksMap.entries())
            .map(([text, count]) => ({ text, count }))
            .sort((a, b) => b.count - a.count);

        const totalRemarks = sortedRemarks.reduce((sum, r) => sum + r.count, 0);
        const topRemark = sortedRemarks[0];
        const repetitionRate = topRemark ? (topRemark.count / totalRemarks) : 0;

        // Find if this employee is an outlier in delay
        const perf = employeePerformance.get(name);
        const avgDelay = perf ? perf.totalTime / perf.tasks : 0;
        const delayOutlier = avgDelay > (avgDaysRested + stdDaysRested);

        // Anomaly Score: Combination of high repetition and high delay
        const anomalyScore = Math.min(1, (repetitionRate * 0.7) + (delayOutlier ? 0.3 : 0));

        if (repetitionRate > 0.6 && totalRemarks > 5) {
            redFlags.push({
                type: 'REPEATED_REMARK',
                entity: name,
                evidence: `Uses same remark "${topRemark.text}" for ${Math.round(repetitionRate * 100)}% of cases.`,
                severity: repetitionRate > 0.8 ? 'CRITICAL' : 'HIGH'
            });
        }

        if (delayOutlier && (perf?.tasks || 0) > 5) {
            redFlags.push({
                type: 'UNUSUAL_DELAY',
                entity: name,
                evidence: `Average processing time (${avgDelay.toFixed(1)}d) is significantly above average.`,
                severity: avgDelay > (avgDaysRested * 2) ? 'CRITICAL' : 'HIGH'
            });
        }

        return {
            employeeName: name,
            remarks: sortedRemarks.slice(0, 3),
            topDelayReason: topRemark?.text || 'Standard Processing',
            anomalyScore: parseFloat(anomalyScore.toFixed(2))
        };
    });

    // Global Topic Extraction (Simple Keyword Frequency on ALL tickets)
    const topicMap = new Map<string, number>();
    const stopWords = new Set(['the', 'and', 'is', 'to', 'in', 'of', 'for', 'with', 'on', 'at', 'by', 'from', 'a', 'an', 'this', 'that', 'it', 'as', 'be', 'are', 'was', 'were', 'has', 'have', 'had', 'been', 'will', 'shall', 'may', 'can', 'should', 'would', 'could', 'not', 'no', 'yes', 'ok', 'okay', 'done', 'remarks', 'remark', 'issue', 'issues', 'case', 'file', 'application']);

    workflowSteps.forEach(step => {
        const text = (step.lifetimeRemarks || '' + ' ' + (step.lifetimeRemarksFrom || '')).toLowerCase();
        // Simple tokenization
        const words = text.split(/[\s,.;:()\/]+/);
        words.forEach(w => {
            if (w.length > 3 && !stopWords.has(w) && !/^\d+$/.test(w)) {
                topicMap.set(w, (topicMap.get(w) || 0) + 1);
            }
        });
    });

    const globalTopics = Array.from(topicMap.entries())
        .map(([topic, count]) => ({
            topic: topic.charAt(0).toUpperCase() + topic.slice(1),
            count,
            sentiment: 'neutral' as 'neutral' // Placeholder, could use simple sentiment dictionary later
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15);

    return {
        totalWorkflowSteps,
        totalTickets,
        avgDaysRested,
        maxDaysRested,
        minDaysRested,
        stdDaysRested,
        completedTickets,
        completionRate,
        anomalyCount,
        criticalBottleneck,
        topPerformers,
        riskApplications,
        zonePerformance: zoneData,
        deptPerformance: deptData,
        behaviorMetrics: {
            employeeRemarks,
            redFlags: redFlags.slice(0, 10),
            globalTopics // Add to output
        },
        jdaHierarchy: buildJDAHierarchy(workflowSteps)
    };
}

/**
 * Parse CSV row to WorkflowStep
 */
export function parseWorkflowStep(row: any): WorkflowStep {
    return {
        ticketId: row['Ticket ID'] || row.TicketID || row.ticketId || '',
        serviceName: row['Service Name'] || row.ServiceName || row.serviceName || '',
        parentServiceName: row['Parent Service Name'] || row.ParentServiceName || row.parentServiceName || 'General Service',
        departmentName: row['Department Name'] || row.DepartmentName || row.departmentName || row.OwnerDepartmentId || 'General Department',
        post: row.Post || row.post || '',
        zoneId: row.ZoneID || row.zoneId || (row.DepartmentName?.match(/(?:Zone|ZONE)\s*[-:]?\s*(\d+)/i)?.[1]) || (row.Post?.match(/(?:Zone|ZONE)\s*[-:]?\s*(\d+)/i)?.[1]) || 'General',
        applicationDate: row['Application Date'] || row.ApplicationDate || row.applicationDate || '',
        deliveredOn: row.DeliverdOn || row.deliveredOn || '',
        totalDaysRested: parseFloat(row.TotalDaysRested || row.totalDaysRested || 0),
        lifetimeRemarks: row.LifeTimeRemarks || row.lifetimeRemarks || '',
        lifetimeRemarksFrom: row.LifeTimeRemarksFrom || row.lifetimeRemarksFrom || '',
        numberOfEntries: parseInt(row.NumberOfEntries || row.numberOfEntries || 0),
        // Capture applicant name if available in common columns
        applicantName: row.ApplicantName || row['Applicant Name'] || row.CustomerName || row['Customer Name'] || row.citizen_name || undefined,
        // Capture Employee Name from CSV
        employeeName: row['Employee Name'] || row.EmployeeName || row.employeeName || undefined,
        // Preserve all fields for AI diagnostic depth
        rawRow: row
    } as WorkflowStep;
}
