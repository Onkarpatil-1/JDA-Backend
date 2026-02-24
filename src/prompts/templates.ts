/**
 * AI Prompt Templates (Text Only)
 * This file contains the raw text strings for all AI prompts.
 * Dynamic values are represented by {{variableName}}.
 */

// --------------------------------------------------------------------------
// SYSTEM PROMPTS
// --------------------------------------------------------------------------


// --------------------------------------------------------------------------
// USER PROMPTS
// --------------------------------------------------------------------------

export const ANOMALY_ANALYSIS_USER_PROMPT = `
Analyze the following SLA performance data for Project "{{projectName}}".

CONTEXT:
Total Tickets: {{totalTickets}}
Workflow Steps: {{totalWorkflowSteps}}
Top Performers: {{topPerformers}}
High Risk Apps: {{highRiskApps}}
Anomaly Count: {{anomalyCount}}
Avg Processing Time: {{avgProcessingTime}}
Bottleneck Role: {{bottleneckRole}} ({{bottleneckCases}} cases, {{bottleneckAvgDelay}} avg delay)

INSTRUCTIONS:
1. **ROOT CAUSE**: Identify the SINGLE most critical bottleneck. You MUST cite a specific "Role", "Zone", or "Application" and the exact avg delay.
    - BAD: "Inefficient workflows are causing delays."
    - GOOD: "The '{{bottleneckRole}}' role is averaging {{bottleneckAvgDelay}} days delay, significantly impacting timelines."
2. **30D RISK**: Predict the next bottleneck. Cite specific Ticket IDs or Agents that are trending negatively if available in the data, or base it on the high-risk apps.
3. **STRATEGIC ACTIONS**: Innovative interventions only. No "improve training".
    - BAD: "Streamline the process."
    - GOOD: "Implement auto-assign for 'Zone 09' to cut 'Assistant Advocate' wait time by 1.5 days."

OUTPUT FORMAT (JSON):
{
  "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
  "confidence": 0.0 to 1.0,
  "rootCause": "String with specific data citations",
  "predictions": "String with specific details",
  "recommendations": ["Action 1 (Specific)", "Action 2 (Specific)", "Action 3 (Specific)"]
}
`;

export const BOTTLENECK_PREDICTION_USER_PROMPT = `
Based on the following bottleneck data:
{{bottleneckData}}

Identify the top 3 specific bottlenecks (Role + Zone) that require immediate intervention.
For each, explain *why* using the "maxDelay" and "avgDelay" data points.

OUTPUT:
1. [Role] in [Zone]: [Explanation with numbers]
2. ...
3. ...
`;


export const RECOMMENDATIONS_USER_PROMPT = `You are an SLA workflow optimization expert. Suggest 3 specific, actionable recommendations:

Current Data Points:
- Anomaly Count: {{anomalyCount}}
- Average Time: {{avgProcessingTime}} days
- Critical Bottleneck: {{bottleneckRole}} ({{bottleneckAvgDelay}} days avg)
- Top Performers: {{topPerformers}}
- Primary Zones: {{primaryZones}}

Task: Provide 3 concrete recommendations.
IMPORTANT:
- Max 10 words per recommendation.
- Use action verbs.
- Mention specific roles / zones.

Format:
1. [Recommendation]
2. [Recommendation]
3. [Recommendation]`;



















export const REMARK_ANALYSIS_USER_PROMPT = `You are an expert internal auditor for the Jaipur Development Authority (JDA). Analyze this specific ticket's conversation to identify what actually happened, who did what, and what caused delays.

Ticket Context:
- Ticket ID: {{ticketId}}
- ServiceName: {{flowType}}
- ParentServiceName: {{flowTypeParent}}
- Current Stage: {{stage}}
- Total Delay: {{totalDelay}} days

Conversation History (Chronological):
{{conversationHistory}}

---

INPUT DATA:

1. "lifetimeRemarksFrom" - The actual message text
   - "Notification sent to applicant: [message]" -> Employee said this
   - "Reply from Applicant: [message]" -> Applicant said this
   - Plain text -> Determine who said it from context

2. "lifetimeRemarks" - Message type label (use as hint)

Language: Mixed Hindi/English - output everything in English

---

CRITICAL RULES:

ONLY use information explicitly present in the conversation. DO NOT infer, assume, or generate content not in remarks.

1. NO INVENTED DATA - Do not create document names, dates, or actions not mentioned
2. NO EXAMPLE TEXT - Never copy example phrases from this prompt
3. EXACT MATCHES ONLY - A document is ONLY mentioned if its EXACT NAME appears in the remark text
4. OUTPUT MUST BE PLAIN TEXT - Write in natural English sentences
5. NO REPETITIVE LABELS - Write recommendations directly without label prefixes
6. SINGLE CATEGORY ONLY - primaryDelayCategory must be ONE category name, never multiple, never comma-separated
7. DOCUMENT SUBMISSION CONFIRMATION - If applicant says "I have submitted the documents" or "दस्तावेज़ जमा कर दिए हैं" or similar confirmation, treat ALL previously requested documents as submitted, not missing.

---

DOCUMENT EXTRACTION - STRICT RULES:

ABSOLUTE REQUIREMENT: A document can ONLY be extracted if you can find its EXACT NAME in the conversationHistory text.

BEFORE extracting "Pan Card":
- Search conversationHistory for: "Pan Card" OR "पैन कार्ड" OR "pan card"
- If found → Extract "Pan Card"
- If NOT found → Do NOT extract

BEFORE extracting "Aadhar Card":
- Search conversationHistory for: "Aadhar Card" OR "Aadhar" OR "आधार कार्ड" OR "aadhar" OR "aadhaar"
- If found → Extract "Aadhar Card"  
- If NOT found → Do NOT extract

BEFORE extracting "Challan":
- Search conversationHistory for: "Challan" OR "चालान" OR "challan"
- If found → Extract "Challan"
- If NOT found → Do NOT extract

IF conversationHistory says: "submit required documents" or "मूल दस्तावेज़ जमा करें"
THEN documentNames = [] (EMPTY - no specific documents named)

IF conversationHistory says: "Please submit Pan Card and Aadhar Card"
THEN documentNames = ["Pan Card", "Aadhar Card"] (both explicitly named)

DOCUMENT SUBMISSION LOGIC - CRITICAL:

IF applicant says ANY of these phrases:
- "I have submitted the documents" / "मैंने दस्तावेज़ जमा कर दिए हैं"
- "Documents submitted" / "दस्तावेज़ जमा हो गए"
- "All documents uploaded" / "सभी दस्तावेज़ अपलोड हो गए"
- "Required documents submitted" / "आवश्यक दस्तावेज़ जमा किए"
- "I submitted" / "मैंने जमा कर दिया"

THEN treat ALL previously requested documents as SUBMITTED (not missing/pending)

Example:
- Employee: "Please submit Pan Card and Aadhar Card"
- Applicant: "I have submitted the documents"
- INTERPRETATION: Both Pan Card AND Aadhar Card are submitted (not one missing)

CRITICAL: Documents DO NOT have types, variations, or qualifiers.

CORRECT: "Pan Card", "Aadhar Card", "Challan"
WRONG: "original Pan Card", "type of Aadhar Card", "Challan number 12345"

Recognized documents (must appear verbatim in text):

Identity: Pan Card/पैन कार्ड, Aadhar Card/Aadhar/आधार कार्ड/आधार, Passport/पासपोर्ट, Voter ID/वोटर कार्ड, Ration Card/राशन कार्ड

Property & Legal: Site Plan/साइट प्लान, Sale Deed/विक्रय पत्र, Lease Deed/Patta/लीजडीड/पट्टा, Registered Documents/पंजीकृत दस्तावेज़, Original Documents/मूल दस्तावेज़, Affidavit/शपथ पत्र

Certificates: Death Certificate/मृत्यु प्रमाण पत्र, Marriage Certificate/विवाह प्रमाण पत्र, Birth Certificate/जन्म प्रमाण पत्र

Financial: Challan/चालान, Bank NOC/बैंक एनओसी, Income Certificate/आय प्रमाण पत्र

Utility: Electricity Bill/बिजली बिल, Water Bill/पानी बिल

VAGUE PHRASES (result in EMPTY documentNames):
- "required documents"/आवश्यक दस्तावेज़
- "original documents"/मूल दस्तावेज़
- "pending documents"/लंबित दस्तावेज़
- "all documents"/सभी दस्तावेज़
- "submit documents"/दस्तावेज़ जमा करें

---

DELAY CATEGORIES - SINGLE SELECTION ONLY:

You MUST choose exactly ONE category. Never use multiple categories or comma-separated values.

**Category 1: Documentation & Compliance Issues**
**Category 2: Process & Approval Bottlenecks**
**Category 3: Communication & Coordination Gaps**
**Category 4: External Dependencies & Third-Party Delays**
**Category 5: Internal System & Employee Issues**

CORRECT: "Documentation & Compliance Issues"
WRONG: "Documentation & Compliance Issues, Communication & Coordination Gaps"

---

OVERALL REMARKS ANALYSIS - EXPANDED CONTEXT:

These sections must be DETAILED and COMPREHENSIVE with rich context about bottlenecks and pain points.

**Employee Remarks Overall (TOP BOTTLENECKS):**
Write 150-200 words identifying ALL bottlenecks employee faced:
- Which specific documents employee was waiting for (name each one)
- How many times each document was requested
- How many reminders sent and when
- What approvals or inspections employee was waiting for
- How long employee waited for each item
- What specific actions employee took and when
- Communication clarity - specific vs vague requests with examples
- Response patterns - how quickly employee responded to applicant queries
- Any gaps in employee follow-up

Be EXPANSIVE - paint complete picture of employee's experience and challenges.

**Applicant Remarks Overall (COMMON PAIN POINTS):**
Write 150-200 words identifying ALL pain points applicant experienced:
- What specific confusion or frustration applicant expressed
- What information applicant was missing that caused delays
- Which employee instructions were unclear and why
- What questions applicant had to ask for clarification
- What documents applicant submitted and when (if submission confirmed, state ALL docs submitted)
- What challenges applicant faced in providing documents
- What complaints or concerns applicant raised
- How applicant's tone/sentiment changed over time and why
- What caused applicant stress or difficulty

Be EXPANSIVE - paint complete picture of applicant's experience and struggles.

---

OUTPUT FORMAT (JSON):

{
  "overallRemarkAnalysis": {
    "employeeRemarksOverall": {
      "totalEmployeeRemarks": number,
      "summary": "Write 150-200 words with RICH CONTEXT about bottlenecks employee faced. Be DETAILED and EXPANSIVE. Include: (1) Specific documents employee waited for - name each one and how many times requested, (2) Exact number of reminders sent and when, (3) What approvals/inspections pending and for how long, (4) Specific communication examples - quote vague vs clear instructions, (5) Employee response patterns with timing details, (6) Any employee inaction or delays, (7) Overall impact of bottlenecks on employee's workflow. Paint full picture of employee's challenges. Example length: Employee was primarily blocked waiting for Aadhar Card from applicant throughout this 15-day ticket. Initially requested both Pan Card and Aadhar Card in first message with clear, specific instructions. Applicant submitted Pan Card within 2 days showing good compliance for that document. However, Aadhar Card remained pending. Employee sent first reminder on day 7 with polite follow-up message. When no response received, employee sent second reminder on day 12 with more urgent tone. Employee also had to wait 2 days for internal site inspection approval from senior authority between day 8-10. Communication quality was generally high - employee specified exact document names upfront. Response to applicant query about challan amount was prompt (within 1 day). Primary bottleneck was the 13-day wait for Aadhar Card which prevented case progression despite employee's diligent follow-up.",
      "commonThemes": ["Detailed theme 1 with context", "Detailed theme 2 with context"],
      "communicationQuality": "High/Medium/Low with detailed reason citing specific examples",
      "responseTimeliness": "Prompt/Delayed/Inconsistent with detailed timing breakdown",
      "inactionPatterns": ["Detailed inaction pattern with timeframe and impact"],
      "topEmployeeActions": ["Detailed action 1 with frequency and context", "Detailed action 2", "Detailed action 3"]
    },
    "applicantRemarksOverall": {
      "totalApplicantRemarks": number,
      "summary": "Write 150-200 words with RICH CONTEXT about pain points applicant experienced. Be DETAILED and EXPANSIVE. Include: (1) Specific confusion applicant expressed and why, (2) What information was missing causing applicant difficulty, (3) Exact questions applicant asked for clarification, (4) Communication gaps that frustrated applicant with examples, (5) Documents applicant submitted - if applicant confirmed submission, state ALL documents submitted not missing, (6) Challenges applicant faced and how they expressed them, (7) Sentiment changes with specific triggers, (8) Overall impact on applicant experience. Paint full picture of applicant's struggles. Example length: Applicant experienced significant pain point from unclear initial instruction. Employee's first message said 'submit required documents' without naming specific ones, forcing applicant to reply asking 'which documents are required?' This caused 2-day clarification delay and initial frustration. After employee clarified (Pan Card and Aadhar Card needed), applicant promptly submitted Pan Card showing willingness to comply. Applicant then asked about challan amount because employee didn't specify - another information gap causing delay. When employee provided amount, applicant confirmed 'I have submitted the documents' indicating both Pan Card and Aadhar Card were submitted, not just one. However, employee sent reminders suggesting Aadhar Card was missing - this may indicate system upload issue rather than applicant non-compliance. Applicant's sentiment started cooperative, became confused due to vague instruction, then frustrated when reminders sent despite confirmation of submission. Main pain point was communication gap and possible technical issue not applicant's fault.",
      "commonThemes": ["Detailed theme 1 with examples", "Detailed theme 2 with examples"],
      "complianceLevel": "Full/Partial/Low/Unknown with detailed breakdown including document count and specific names",
      "sentimentTrend": "Detailed evolution with specific triggers: Started [state] when [event]. Became [state] after [trigger]. Ended [state] due to [reason].",
      "delayPatterns": ["Detailed delay pattern with duration and cause"],
      "topApplicantConcerns": ["Detailed concern 1 with frequency and context", "Detailed concern 2"]
    }
  },

  "employeeRemarkAnalysis": {
    "summary": "80-100 words about employee actions. Name documents requested if in remarks. State if vague instruction given.",
    "totalEmployeeRemarks": number,
    "keyActions": ["Action 1", "Action 2", "Action 3"],
    "responseTimeliness": "Prompt/Delayed/Inconsistent/Unknown",
    "communicationClarity": "High/Medium/Low/Unknown",
    "inactionFlags": [{"observation": "Observation", "evidence": "Quote"}]
  },

  "applicantRemarkAnalysis": {
    "summary": "80-100 words about applicant actions. If applicant said 'I submitted documents', state ALL requested documents are submitted. Name documents if in remarks.",
    "totalApplicantRemarks": number,
    "keyActions": ["Action 1", "Action 2", "Action 3"],
    "responseTimeliness": "Prompt/Delayed/Inconsistent/Unknown",
    "sentimentTrend": "Evolution with evidence",
    "complianceLevel": "Full/Partial/Low/Unknown"
  },

  "delayAnalysis": {
    "primaryDelayCategory": "EXACTLY ONE of: Documentation & Compliance Issues OR Process & Approval Bottlenecks OR Communication & Coordination Gaps OR External Dependencies & Third-Party Delays OR Internal System & Employee Issues",
    "primaryCategoryConfidence": 0.0-1.0,
    "documentClarityAnalysis": {
      "documentClarityProvided": true or false,
      "documentNames": ["ONLY documents whose exact names appear in conversationHistory. Empty [] if none named."]
    },
    "categorySummary": "60-80 words explaining delay. If applicant confirmed submission of documents, acknowledge this and consider if delay might be system issue not applicant fault.",
    "allApplicableCategories": [{"category": "ONE category only", "confidence": 0.0-1.0, "reasoning": "Reason"}],
    "processGaps": ["Process improvement"],
    "painPoints": ["Pain point"],
    "forcefulDelays": [{"reason": "Reason", "confidence": 0.0-1.0, "category": "Category or None", "evidence": "Quote", "recommendation": "Recommendation"}]
  },

  "sentimentSummary": "2-3 sentences about applicant experience.",

  "ticketInsightSummary": "80-100 words factual summary. State what employee requested. State what applicant did - if applicant said 'submitted documents', state all requested documents were submitted. Explain delay cause. If applicant confirmed submission but employee sent reminders, note possible system issue. No recommendations."
}

---

CRITICAL VERIFICATION:

1. ✓ Did I search conversationHistory for each document before adding to documentNames?
2. ✓ If applicant said "I submitted documents", did I treat ALL requested docs as submitted?
3. ✓ Is primaryDelayCategory exactly ONE category?
4. ✓ Is employeeRemarksOverall.summary 150-200 words with RICH context?
5. ✓ Is applicantRemarksOverall.summary 150-200 words with RICH context?
6. ✓ Did I avoid document types?
7. ✓ Did ticketInsightSummary contain NO recommendations?

If any answer is NO, fix before responding.

Respond with valid JSON.`;