
import { AIFactory } from './src/services/AIFactory.js';
import { createRemarkAnalysisPrompt } from './src/config/promptBuilders.js';
import dotenv from 'dotenv';
dotenv.config();

// MOCK DATA: User provided CSV content (Raw) for Ticket 149353
const csvContent = `Ticket ID,OwnerDepartmentId,DepartmentName,ParentServiceName,ServiceName,ApplicationDate,DueDate,DeliverdOn,EmployeeIdTo,Employee Name,RoleId,Post,DepartmentIdTo,MaxEventTimeStamp,LifeTimeEventStampDate,TotalDaysRested,RunDate,CurrentStatusID,SubStatusID,LifeTimeRemarks,LifeTimeRemarksFrom
149353,127,Deputy Commissioner (Zone 09),Name Transfer,Purchased Through Sale Deed,12/3/2025,12/31/2025,12/12/2025,5380,ROHYA,5,Accountant,127,12/10/2025,20:06.1,1,2/5/2026,10,1,For demand calculation ,
149353,127,Deputy Commissioner (Zone 09),Name Transfer,Purchased Through Sale Deed,12/3/2025,12/31/2025,12/12/2025,5380,ROHYA,5,Accountant,127,12/10/2025,41:34.6,1,2/5/2026,10,1,verify demand,
149353,127,Deputy Commissioner (Zone 09),Name Transfer,Purchased Through Sale Deed,12/3/2025,12/31/2025,12/12/2025,5473,TARVA,1,Deputy Commissioner,127,12/10/2025,33:48.5,0,2/5/2026,10,1,Demand Generated for Transfer for approval please,
149353,127,Deputy Commissioner (Zone 09),Name Transfer,Purchased Through Sale Deed,12/3/2025,12/31/2025,12/12/2025,NULL,APPLICANT,NULL,APPLICANT,0,NULL,42:03.5,55,2/5/2026,10,1,Case Closed,नाम हस्तांतंरण पत्र डिजिटल साइन कर जारी किया गया, जिसकी प्रति प्रार्थी को ऑनलाइन प्रेषित कर आवेदन निस्तारित किया गया |
149353,127,Deputy Commissioner (Zone 09),Name Transfer,Purchased Through Sale Deed,12/3/2025,12/31/2025,12/12/2025,5177,TANSI,6,Tehsildar,127,12/8/2025,31:04.4,0,2/5/2026,10,1,निजी खातेदारी की योजना जगदम्बा नगर के भूखण्ड संख्या 43 क्षेत्रफल 83.63 वर्ग मीटर की फ्री होल्ड लीजडीड दिनांक 30.07.2022 को एम जी डवलपर्स जरिये निदेशक श्री शिव कुमार मीणा पुत्र श्री रामलाल मीणा के नाम से जारी की गयी है। तत्पश्चात एम जी डवलपर्स जरिये निदेशक श्री शिव कुमार मीणा द्वारा उक्त भूखण्ड का बेचान जरिये रजिस्ट्रर्ड विक्रय पत्र दिनांक 09.09.2023 के द्वारा श्री जितेन्द्र शर्मा पुत्र श्री महेन्द्र कुमार रूंथला को कर दिया गया। आवेदक श्री जितेन्द्र शर्मा द्वारा उक्त भूखण्ड का नाम हस्तान्तरण हेतु आवेदन किया गया है। अतः पत्रावली अवलोकनार्थ एवं आदेशार्थ प्रस्तुत है。,
149353,127,Deputy Commissioner (Zone 09),Name Transfer,Purchased Through Sale Deed,12/3/2025,12/31/2025,12/12/2025,5380,ROHYA,5,Accountant,127,12/10/2025,41:50.4,0,2/5/2026,10,1,सपोर्टिंग इनपुट दर्शित कर पत्रावली अग्रिम कार्यवाही हेतु प्रेषित है。,
149353,127,Deputy Commissioner (Zone 09),Name Transfer,Purchased Through Sale Deed,12/3/2025,12/31/2025,12/12/2025,5473,TARVA,1,Deputy Commissioner,127,12/10/2025,52:24.1,2,2/5/2026,10,1,योजना सहायक द्वारा प्रस्तुत सपोर्टिंग इनपुट के आधार पर स्वनिर्मित नाम हस्तांतरण पत्र का ड्राफ्ट अवलोकन पश्चात अनुमोदन की स्थिति में हस्ताक्षरार्थ प्रस्तुत है。,
149353,127,Deputy Commissioner (Zone 09),Name Transfer,Purchased Through Sale Deed,12/3/2025,12/31/2025,12/12/2025,5473,TARVA,1,Deputy Commissioner,127,12/10/2025,13:22.7,0,2/5/2026,10,1,ऑनलाइन जांच की जाकर ऑनलाइन पत्रावली नियमानुसार अग्रिम कार्यवाही हेतु अग्रेषित है。,
149353,127,Deputy Commissioner (Zone 09),Name Transfer,Purchased Through Sale Deed,12/3/2025,12/31/2025,12/12/2025,5473,TARVA,1,Deputy Commissioner,127,12/10/2025,09:24.3,0,2/5/2026,10,1,Reply from Applicant,"Reply from Applicant :  : Payment Done, Deposit Receipt Attached, kindly do needful."
149353,127,Deputy Commissioner (Zone 09),Name Transfer,Purchased Through Sale Deed,12/3/2025,12/31/2025,12/12/2025,3586,NARKU,4,Dealing Assistant,127,12/10/2025,09:32.7,5,2/5/2026,10,1,Examine and put up file,
149353,127,Deputy Commissioner (Zone 09),Name Transfer,Purchased Through Sale Deed,12/3/2025,12/31/2025,12/12/2025,NULL,Notification For Applicant,NULL,APPLICANT,127,NULL,56:26.1,0,2/5/2026,10,1,Notification sent to applicant,"Notification sent to applicant : मांग पत्र अनुसार राशि जमा कराकर चालान की प्रति ऑनलाईन अपलोड करे。"
149353,127,Deputy Commissioner (Zone 09),Name Transfer,Purchased Through Sale Deed,12/3/2025,12/31/2025,12/12/2025,3586,NARKU,4,Dealing Assistant,127,12/10/2025,23:12.9,0,2/5/2026,10,1,Deposited amount is confirmed from challan number 1009956 dated 09-12-2025,
149353,127,Deputy Commissioner (Zone 09),Name Transfer,Purchased Through Sale Deed,12/3/2025,12/31/2025,12/12/2025,3586,NARKU,4,Dealing Assistant,127,12/10/2025,05:11.2,0,2/5/2026,10,1,issue demand note,
`;

// Helper: Custom Object Construction for Ticket 149353
// Note: Dates are MM/DD/YYYY in data
// CORRECTED: Based on actual CSV structure where columns are sometimes swapped
const workflowSteps = [
    { ticketId: "149353", lifetimeRemarks: "For demand calculation", lifetimeRemarksFrom: "", rawRow: { MaxEventTimeStamp: "12/10/2025", Post: "Accountant" } },
    { ticketId: "149353", lifetimeRemarks: "verify demand", lifetimeRemarksFrom: "", rawRow: { MaxEventTimeStamp: "12/10/2025", Post: "Accountant" } },
    { ticketId: "149353", lifetimeRemarks: "Demand Generated for Transfer for approval please", lifetimeRemarksFrom: "", rawRow: { MaxEventTimeStamp: "12/10/2025", Post: "Deputy Commissioner" } },
    { ticketId: "149353", lifetimeRemarks: "Case Closed", lifetimeRemarksFrom: "नाम हस्तांतंरण पत्र डिजिटल साइन कर जारी किया गया, जिसकी प्रति प्रार्थी को ऑनलाइन प्रेषित कर आवेदन निस्तारित किया गया |", rawRow: { MaxEventTimeStamp: "NULL", Post: "APPLICANT" } },
    { ticketId: "149353", lifetimeRemarks: "", lifetimeRemarksFrom: "निजी खातेदारी की योजना जगदम्बा नगर के भूखण्ड संख्या 43 क्षेत्रफल 83.63 वर्ग मीटर की फ्री होल्ड लीजडीड दिनांक 30.07.2022 को एम जी डवलपर्स जरिये निदेशक श्री शिव कुमार मीणा पुत्र श्री रामलाल मीणा के नाम से जारी की गयी है। तत्पश्चात एम जी डवलपर्स जरिये निदेशक श्री शिव कुमार मीणा द्वारा उक्त भूखण्ड का बेचान जरिये रजिस्ट्रर्ड विक्रय पत्र दिनांक 09.09.2023 के द्वारा श्री जितेन्द्र शर्मा पुत्र श्री महेन्द्र कुमार रूंथला को कर दिया गया। आवेदक श्री जितेन्द्र शर्मा द्वारा उक्त भूखण्ड का नाम हस्तान्तरण हेतु आवेदन किया गया है। अतः पत्रावली अवलोकनार्थ एवं आदेशार्थ प्रस्तुत है。", rawRow: { MaxEventTimeStamp: "12/8/2025", Post: "Tehsildar" } },
    { ticketId: "149353", lifetimeRemarks: "", lifetimeRemarksFrom: "सपोर्टिंग इनपुट दर्शित कर पत्रावली अग्रिम कार्यवाही हेतु प्रेषित है।", rawRow: { MaxEventTimeStamp: "12/10/2025", Post: "Accountant" } },
    { ticketId: "149353", lifetimeRemarks: "", lifetimeRemarksFrom: "योजना सहायक द्वारा प्रस्तुत सपोर्टिंग इनपुट के आधार पर स्वनिर्मित नाम हस्तांतरण पत्र का ड्राफ्ट अवलोकन पश्चात अनुमोदन की स्थिति में हस्ताक्षरार्थ प्रस्तुत है。", rawRow: { MaxEventTimeStamp: "12/10/2025", Post: "Deputy Commissioner" } },
    { ticketId: "149353", lifetimeRemarks: "", lifetimeRemarksFrom: "ऑनलाइन जांच की जाकर ऑनलाइन पत्रावली नियमानुसार अग्रिम कार्यवाही हेतु अग्रेषित है。", rawRow: { MaxEventTimeStamp: "12/10/2025", Post: "Deputy Commissioner" } },
    { ticketId: "149353", lifetimeRemarks: "Reply from Applicant", lifetimeRemarksFrom: "Reply from Applicant :  : Payment Done, Deposit Receipt Attached, kindly do needful.", rawRow: { MaxEventTimeStamp: "12/10/2025", Post: "Deputy Commissioner" } },
    { ticketId: "149353", lifetimeRemarks: "", lifetimeRemarksFrom: "Examine and put up file", rawRow: { MaxEventTimeStamp: "12/10/2025", Post: "Dealing Assistant" } },
    { ticketId: "149353", lifetimeRemarks: "Notification sent to applicant", lifetimeRemarksFrom: "Notification sent to applicant : मांग पत्र अनुसार राशि जमा कराकर चालान की प्रति ऑनलाईन अपलोड करे。", rawRow: { MaxEventTimeStamp: "NULL", Post: "APPLICANT" } },
    { ticketId: "149353", lifetimeRemarks: "", lifetimeRemarksFrom: "Deposited amount is confirmed from challan number 1009956 dated 09-12-2025", rawRow: { MaxEventTimeStamp: "12/10/2025", Post: "Dealing Assistant" } },
    { ticketId: "149353", lifetimeRemarks: "", lifetimeRemarksFrom: "issue demand note", rawRow: { MaxEventTimeStamp: "12/10/2025", Post: "Dealing Assistant" } }
];

// REUSE LOGIC FROM AIAnalysisService.analyzeRemarks
const reconstructHistory = (steps: any[]) => {
    // USER DIRECTED: Following natural CSV sequence instead of sorting by time
    // which can be ambiguous with JDA's various time formats.
    return steps.map((step) => {
        const remarksField = (step.lifetimeRemarks || '').trim();
        const remarksFromField = (step.lifetimeRemarksFrom || '').trim();
        const date = step.rawRow?.['MaxEventTimeStamp'] || 'Unknown Date';

        // Send both fields exactly as they appear in CSV
        return `[${date}] lifetimeRemarksFrom: "${remarksFromField.replace(/"/g, "'")}" | lifetimeRemarks: "${remarksField.replace(/"/g, "'")}"`;
    }).join('\n');
};

async function runDebug() {
    console.log("🚀 Starting Debug Analysis for Ticket 149353 (Name Transfer)");

    const conversationHistory = reconstructHistory(workflowSteps);

    // 1. Construct the Prompt
    const prompt = createRemarkAnalysisPrompt({
        ticketId: "149353",
        flowType: "Name Transfer",
        flowTypeParent: "Purchased Through Sale Deed",
        conversationHistory: conversationHistory,
        totalDelay: 64, // 12/3/2025 to 2/5/2026
        employeeName: "TARVA",
        stage: "Deputy Commissioner"
    });

    console.log("\n\n====================================================================================================");
    console.log("📨 INPUT PROMPT SENT TO OLLAMA:");
    console.log("====================================================================================================\n");
    console.log(prompt);
    console.log("\n====================================================================================================\n\n");

    // 2. Run Inference
    const aiFactory = AIFactory.getInstance();
    const aiService = aiFactory.getService('ollama');

    try {
        console.log("⏳ Sending request to Ollama (llama3.2:3b)... Please wait...");
        const response = await aiService.generate(prompt);

        console.log("\n\n====================================================================================================");
        console.log("🤖 OUTPUT GENERATED BY OLLAMA:");
        console.log("====================================================================================================\n");
        console.log(response.content);
        console.log("\n====================================================================================================");

    } catch (error) {
        console.error("❌ Error running analysis:", error);
    }
}

runDebug();
