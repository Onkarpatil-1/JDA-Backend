
import { AIAnalysisService } from './src/services/AIAnalysisService.js';
import { AIFactory } from './src/services/AIFactory.js';
import { OllamaService } from './src/services/OllamaService.js';

async function runTest() {
    console.log('🧪 STAGE: Starting Forensic Accuracy Test\n');

    const aiAnalysisService = new AIAnalysisService();
    const ollamaService = new OllamaService({
        host: 'http://localhost:11434',
        model: 'llama3.2:3b',
        temperature: 0.15
    });

    const positiveScenario = [
        {
            ticketId: 'POSITIVE_001',
            employeeName: 'TEST_EMP_A',
            roleName: 'Dealing Assistant',
            lifetimeRemarks: 'notification sent to applicant',
            lifetimeRemarksFrom: 'Notification sent to applicant : कृपया 5041 रुपये का चालान, आधार कार्ड और पैन कार्ड प्रस्तुत करें।',
            rawRow: { 'MaxEventTimeStamp': '46044' }
        },
        {
            ticketId: 'POSITIVE_001',
            employeeName: 'TEST_EMP_B',
            roleName: 'Junior Engineer',
            lifetimeRemarks: '',
            lifetimeRemarksFrom: 'pls submit challan of amount 5041 along with aadhar and pan card',
            rawRow: { 'MaxEventTimeStamp': '46055' }
        },
        {
            ticketId: 'POSITIVE_001',
            employeeName: 'APPLICANT',
            roleName: 'Applicant',
            lifetimeRemarks: 'Reply from Applicant',
            lifetimeRemarksFrom: 'Reply from Applicant : मैंने चालान नंबर 37842 और आवश्यक दस्तावेज़ जमा कर दिए हैं।',
            rawRow: { 'MaxEventTimeStamp': '46055' }
        },
        {
            ticketId: 'POSITIVE_001',
            employeeName: 'SYSTEM',
            roleName: 'System',
            lifetimeRemarks: '',
            lifetimeRemarksFrom: 'Applicant has responsed within 7 days',
            rawRow: { 'MaxEventTimeStamp': '46055' }
        },
        {
            ticketId: 'POSITIVE_001',
            employeeName: 'SYSTEM',
            roleName: 'System',
            lifetimeRemarks: 'notification sent to applicant',
            lifetimeRemarksFrom: 'case closed',
            rawRow: { 'MaxEventTimeStamp': '46055' }
        }
    ];

    const negativeScenario = [
        {
            ticketId: 'NEGATIVE_002',
            employeeName: 'TEST_EMP_C',
            roleName: 'Dealing Assistant',
            lifetimeRemarks: 'notification sent to applicant',
            lifetimeRemarksFrom: 'Notification sent to applicant : Please deposit amount and submit original documents',
            rawRow: { 'MaxEventTimeStamp': '46044' }
        },
        {
            ticketId: 'NEGATIVE_002',
            employeeName: 'TEST_EMP_D',
            roleName: 'Junior Engineer',
            lifetimeRemarks: '',
            lifetimeRemarksFrom: 'कृपया राशि जमा करें और मूल दस्तावेज प्रस्तुत करें।',
            rawRow: { 'MaxEventTimeStamp': '46055' }
        },
        {
            ticketId: 'NEGATIVE_002',
            employeeName: 'APPLICANT',
            roleName: 'Applicant',
            lifetimeRemarks: 'Reply from Applicant',
            lifetimeRemarksFrom: 'Reply from Applicant : कृपया बताने की कृपा करें कि चालान की राशि क्या है? और मुझे कौन-कौन से दस्तावेज़ प्रस्तुत करने हैं?',
            rawRow: { 'MaxEventTimeStamp': '46055' }
        },
        {
            ticketId: 'NEGATIVE_002',
            employeeName: 'SYSTEM',
            roleName: 'System',
            lifetimeRemarks: '',
            lifetimeRemarksFrom: 'Applicant has not responsed within 7 days',
            rawRow: { 'MaxEventTimeStamp': '46055' }
        },
        {
            ticketId: 'NEGATIVE_002',
            employeeName: 'SYSTEM',
            roleName: 'System',
            lifetimeRemarks: 'notification sent to applicant',
            lifetimeRemarksFrom: 'case closed',
            rawRow: { 'MaxEventTimeStamp': '46055' }
        }
    ];

    const tickets = [
        { id: 'POSITIVE_001', delay: 1, service: 'TICKET_A', parentService: 'PARENT_A', stage: 'Closed', lastActionBy: 'TEST_EMP_B' },
        { id: 'NEGATIVE_002', delay: 7, service: 'TICKET_B', parentService: 'PARENT_B', stage: 'Closed', lastActionBy: 'TEST_EMP_D' }
    ];

    console.log('🔍 Scenario 1: POSITIVE (Specific communication)\n');
    const posResult = await aiAnalysisService['runForensicAnalysisForTicket'](tickets[0], positiveScenario, ollamaService);
    console.log('\n--- POSITIVE RESULT ---\n');
    console.log(JSON.stringify(posResult, null, 2));

    console.log('\n\n🔍 Scenario 2: NEGATIVE (Vague communication)\n');
    const negResult = await aiAnalysisService['runForensicAnalysisForTicket'](tickets[1], negativeScenario, ollamaService);
    console.log('\n--- NEGATIVE RESULT ---\n');
    console.log(JSON.stringify(negResult, null, 2));
}

runTest().catch(console.error);
