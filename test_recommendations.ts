
import { AIAnalysisService } from './src/services/AIAnalysisService.js';
import { OllamaService } from './src/services/OllamaService.js';

async function runRecommendationTest() {
    console.log('🧪 STAGE: Starting Grounded Recommendations Test\n');

    const aiAnalysisService = new AIAnalysisService();
    const ollamaService = new OllamaService({
        host: 'http://localhost:11434',
        model: 'llama3.2:3b',
        temperature: 0.15
    });

    const mockStatistics = {
        totalWorkflowSteps: 10,
        totalTickets: 2,
        avgDaysRested: 12.5,
        maxDaysRested: 20,
        minDaysRested: 5,
        stdDaysRested: 3.2,
        completedTickets: 1,
        completionRate: 50,
        anomalyCount: 2,
        criticalBottleneck: {
            role: 'Dealing Assistant',
            cases: 5,
            avgDelay: 8.5,
            thresholdExceeded: 70
        },
        topPerformers: [
            { name: 'SUPER_EMP_A', role: 'Clerk', tasks: 12, avgTime: 1.2 }
        ],
        riskApplications: [],
        zonePerformance: [
            { name: 'ZONE_01', onTime: 80, avgTime: 5 },
            { name: 'ZONE_02', onTime: 40, avgTime: 15 }
        ],
        deptPerformance: [],
        behaviorMetrics: {
            employeeRemarks: [],
            redFlags: []
        }
    };

    const mockForensicReports = {
        'TICKET_001': {
            overallRemarkAnalysis: {
                employeeRemarksOverall: {
                    totalEmployeeRemarks: 2,
                    summary: 'Employee requested Challan and PAN Card multiple times.',
                    commonThemes: ['Challan collection', 'Documentation delays'],
                    communicationQuality: 'Medium',
                    responseTimeliness: 'Delayed',
                    inactionPatterns: [],
                    topEmployeeActions: []
                },
                applicantRemarksOverall: {
                    totalApplicantRemarks: 1,
                    summary: 'Applicant confused about Challan amount.',
                    commonThemes: ['Amount clarification', 'Form submission'],
                    complianceLevel: 'Partial',
                    sentimentTrend: 'Neutral',
                    delayPatterns: [],
                    topApplicantConcerns: []
                }
            },
            employeeRemarkAnalysis: { summary: '', totalEmployeeRemarks: 2, keyActions: [], responseTimeliness: '', communicationClarity: '', inactionFlags: [] },
            applicantRemarkAnalysis: { summary: '', totalApplicantRemarks: 1, keyActions: [], responseTimeliness: '', sentimentTrend: '', complianceLevel: '' },
            delayAnalysis: { primaryDelayCategory: 'Documentation & Compliance Issues', primaryCategoryConfidence: 0.9, documentClarityAnalysis: { documentClarityProvided: false, documentNames: ['Challan', 'PAN Card'] }, categorySummary: '', allApplicableCategories: [], processGaps: [], painPoints: [], forcefulDelays: [] },
            sentimentSummary: '',
            ticketInsightSummary: ''
        }
    };

    const forensicRootCause = "The 'Dealing Assistant' in 'ZONE_02' is causing an 8.5 day delay primarily due to unclear Challan amount requests and missing PAN cards.";

    console.log('📝 Calling generateRecommendations with mock forensic context...\n');

    // Accessing private method for testing
    const recommendations = await (aiAnalysisService as any).generateRecommendations(
        mockStatistics,
        ollamaService,
        forensicRootCause,
        mockForensicReports
    );

    console.log('\n--- FINAL RECOMMENDATIONS ---\n');
    recommendations.forEach((rec: string, i: number) => {
        console.log(`${i + 1}. ${rec}`);
    });

    console.log('\n--- AUDIT CHECK ---');
    const genericTerms = ['ml model', 'machine learning', 'qa team', 'collaboration', 'training'];
    const hallucinated = recommendations.some((r: string) =>
        genericTerms.some(term => r.toLowerCase().includes(term))
    );

    if (hallucinated) {
        console.log('❌ FAILED: Found generic hallucinations in recommendations.');
    } else {
        console.log('✅ PASSED: Recommendations are specific and grounded.');
    }
}

runRecommendationTest().catch(console.error);
