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


















export const REMARK_ANALYSIS_USER_PROMPT = `You are an expert ticket analyst for the Jaipur Development Authority (JDA). Analyze this ticket's conversation from both employee and applicant perspectives, then provide an overall ticket insight.

Ticket Context:
- Ticket ID: {{ticketId}}
- Service Type: {{flowType}}

Conversation History:
{{conversationHistory}}

Category Identified (from previous step):
{{categoryIdentified}}

Documents Identified (from previous step):
{{documentsExtracted}}

---

IMPORTANT: PARSING CONVERSATION DATA

The conversation may be presented as:
1. Structured (clear employee/applicant labels)
2. Unstructured (mixed text without clear labels)

**How to parse unstructured conversation:**

Look for these patterns to identify WHO is speaking:

**Employee remarks:**
- "Notification sent to applicant:"
- Administrative Hindi text (file processing, approvals, verifications)
- Phrases like "पत्रावली", "प्रस्तुत है", "अग्रिम कार्यवाही"
- Technical instructions: "Check and report", "Please report", "Issue demand note"
- Processing updates: "Site plan signed", "E-Pataa Delivered", "Service document issued"

**Applicant remarks:**
- "Reply from Applicant:"
- Short confirmations: "Sir chalan Deposit", "Sir esign Done"
- Questions to employee
- Document submission confirmations

**Key markers:**
- Text starting with "Reply from Applicant:" = Applicant speaking
- Text starting with "Notification sent to applicant:" = Employee speaking
- Long administrative Hindi = Usually employee
- Brief responses = Usually applicant

Even if conversation structure is unclear, ANALYZE WHAT'S PRESENT:
- What actions occurred (e-sign, challan deposit, site plan approval)
- What was requested (documents, payments, signatures)
- How the process progressed
- Any delays or issues mentioned

---

IMPORTANT: LANGUAGE HANDLING

Remarks are in HINDI, ENGLISH, or MIXED (Hinglish).
- Understand remarks in all forms
- Output ONLY in ENGLISH

---

TASK: Analyze this ticket from three perspectives:
1. Employee perspective (actions, bottlenecks)
2. Applicant perspective (actions, pain points)
3. Overall ticket insight (what happened, why delay occurred)

CRITICAL - UNACCEPTABLE OUTPUTS:
❌ NEVER write "Analysis unavailable" in ANY field
❌ NEVER write "No specific insights" in ANY field
❌ NEVER write "Unknown" in sentiment or any analysis field
❌ NEVER write "Refactored to focus on..." or similar meta-text
❌ NEVER leave analysis empty or redirect to another section

MANDATORY: Every field MUST contain actual analysis based on the conversation. Even if conversation is minimal, analyze what's present.

---

ANALYSIS RULES:

**RULE 1: ONLY USE WHAT'S IN REMARKS - BUT EXTRACT ALL RELEVANT INFO**

Base ALL analysis on conversation text. Even if conversation is in dense administrative language:
- Identify all actions taken (who did what)
- Extract key events (e-sign done, challan deposited, inspection completed)
- Note process steps (verification, approval, issuance)
- Identify participants' roles (employee processing, applicant responding)

Quote or reference actual remarks as evidence.
Do NOT invent actions, documents, or events not present in remarks.

**For administrative/process-heavy conversations:**
Look for action markers:
- "deposited challan" → Applicant action
- "generated demand note" → Employee action
- "site plan signed" → Could be either, check context
- "issued service document" → Employee action
- "Reply from Applicant:" → Applicant speaking
- "Notification sent to applicant:" → Employee speaking

Extract substance from dense text. Example:
Text: "पत्रावली मय मूल दस्‍तावेजात प्राप्‍त ऑनलाइन अपलोडेड से मिलान किया जाकर प्राप्ति रसीद जारी की गई"
Meaning: "Documents received, verified against online uploads, receipt issued"
Action: Employee verified documents and issued receipt

**RULE 2: MANDATORY ANALYSIS FOR ALL SECTIONS**

You MUST provide analysis for ALL three sections. NEVER return:
- ❌ "Analysis unavailable"
- ❌ "No specific insights"
- ❌ "Unknown"
- ❌ "Refactored to focus on..."
- ❌ "See other section"
- ❌ Empty or placeholder text

Each section serves different purpose:
- Employee section = What employee did, bottlenecks faced
- Applicant section = What applicant did, pain points experienced  
- Overall insight = Combined view of what happened

**How to handle minimal conversation:**

If conversation is SHORT or has FEW remarks:
✓ Analyze what IS present, even if brief
✓ State facts: "Employee sent initial notification requesting X. No further employee action visible in remarks."
✓ For applicant: "Applicant responded once confirming Y. No further applicant remarks present."
✓ For insight: "Ticket involved X request. Conversation shows Y happened. Category indicates Z."

If applicant had NO pain points:
✓ State clearly: "Applicant received clear instructions and complied promptly. No pain points evident."
✓ NOT: "Analysis unavailable" or "Unknown"

If sentiment is neutral/unchanged:
✓ State: "Applicant maintained cooperative/neutral tone throughout. No frustration or complaints expressed."
✓ NOT: "Unknown"

If employee had minimal actions:
✓ State: "Employee initiated process by requesting X. No further employee actions visible in conversation."
✓ NOT: "Analysis unavailable"

**RULE 3: IDENTIFYING EMPLOYEE BOTTLENECKS**
Bottleneck = What blocked employee's progress

Common bottlenecks:
- Waiting for applicant to submit documents
- Waiting for internal approval/inspection
- Waiting for external clearances
- Applicant not responding to queries
- System or process issues

**RULE 4: IDENTIFYING APPLICANT PAIN POINTS**
Pain point = What made applicant's experience difficult or frustrating

Common pain points:
- Employee gave vague instructions (no specific requirements)
- Employee didn't respond to applicant's questions
- Information missing (challan amount, deadline unclear)
- Process took too long without updates
- Had to ask clarifying questions

**If NO pain points:** State clearly that applicant had smooth experience.

**RULE 5: EMPLOYEE INACTION - AVOID FALSE POSITIVES**

TRUE INACTION (Flag this):
- Applicant submitted documents → Employee didn't process → Applicant complained or asked for status
- Applicant asked question → No response → Applicant asked again
- Case pending → Applicant followed up multiple times with no response

NOT INACTION (Do NOT flag):
- Applicant submitted documents → No further complaints → Employee likely processing normally
- Applicant made submission → Conversation ends → Normal completion
- Employee taking time for processing without applicant complaint

Critical Logic:
IF applicant submitted AND applicant did NOT complain again
THEN employee likely processing → Do NOT flag inaction

IF applicant submitted AND applicant complained/followed up with no response
THEN flag as inaction

**RULE 6: COMMUNICATION QUALITY ASSESSMENT**
- HIGH: Employee specified exactly what needed (named documents, clear requirements)
- MEDIUM: Some details given but missing info (docs named but no deadline)
- LOW: Vague instructions ("submit required documents" without naming which)

**RULE 7: COMPLIANCE ASSESSMENT**
- FULL: Applicant submitted all requested documents/info promptly
- PARTIAL: Submitted some but not all, or with delays
- LOW: Did not submit despite requests and reminders
- UNKNOWN: Not enough information to determine

**RULE 8: SUBMISSION CONFIRMATION LOGIC**
If applicant says "I have submitted the documents" / "मैंने दस्तावेज़ जमा कर दिए हैं"
→ Treat ALL previously requested documents as SUBMITTED

**RULE 9: NO DOCUMENT HALLUCINATION IN OVERALL INSIGHT**
ONLY mention documents that appear in {{documentsExtracted}}.
- If documentsExtracted = [] → Do NOT mention any documents
- If documentsExtracted = ["Pan Card"] → ONLY mention Pan Card

**RULE 10: NATURAL WRITING**
Write as intelligent analysis, not template matching.
No meta-references like "matches indicators" or "Category X criteria".
Write in natural prose explaining what happened and why.

---

OUTPUT FORMAT (return ONLY valid JSON):

{
  "remarkAnalysis": {
    "employeeAnalysis": {
      "summary": "[150-250 words factual summary of employee actions. See rules below for format.]",
      "totalEmployeeRemarks": number,
      "keyActions": [
        "Action 1: Description with count/timing if relevant",
        "Action 2: Description",
        "Action 3: Description"
      ],
      "bottlenecks": [
        "Bottleneck 1: What blocked employee and duration if known",
        "Bottleneck 2: What blocked employee"
      ],
      "communicationQuality": "High/Medium/Low",
      "communicationQualityReason": "1-2 sentences explaining assessment with evidence from remarks",
      "responseTimeliness": "Prompt/Delayed/Inconsistent/Unknown",
      "responseTimelinessReason": "1-2 sentences with evidence",
      "inactionFlags": [
        {
          "observation": "Describe TRUE inaction pattern (only if applicant complained/followed up)",
          "evidence": "Quote or paraphrase actual remark showing applicant complaint or repeated follow-up"
        }
      ]
    },

    "applicantAnalysis": {
      "summary": "[150-250 words factual summary of applicant actions. See rules below for format.]",
      "totalApplicantRemarks": number,
      "keyActions": [
        "Action 1: Description with timing if relevant",
        "Action 2: Description",
        "Action 3: Description"
      ],
      "painPoints": [
        "Pain point 1: What caused difficulty for applicant",
        "Pain point 2: What made experience frustrating"
      ],
      "complianceLevel": "Full/Partial/Low/Unknown",
      "complianceReason": "1-2 sentences explaining compliance with evidence. If applicant confirmed submission, state all documents submitted.",
      "responseTimeliness": "Prompt/Delayed/Inconsistent/Unknown",
      "responseTimelinessReason": "1-2 sentences with evidence",
      "sentimentSummary": "[MANDATORY 3-4 sentences. Describe overall sentiment tone, any shifts, and provide evidence from remarks. See rules below.]"
    },

    "overallTicketInsight": {
      "summary": "[150-250 words factual summary of the overall ticket. See rules below for format.]",
      "primaryIssue": "One sentence stating main problem that caused delay",
      "employeePerspective": "One sentence summarizing employee's main bottleneck or challenge",
      "applicantPerspective": "One sentence summarizing applicant's main experience (pain point or smooth process)"
    }
  }
}

---

WRITING GUIDELINES:

**For all summary fields:**
- Simple, plain English with SHORT sentences
- 150-250 words maximum (not minimum, can be less if brief)
- SPECIFIC details - name documents, count actions, state what's missing
- Evidence-based with facts from remarks
- NO formal/complex language
- NO vague phrases

**GOOD (Simple, specific):**
✓ "Employee requested Pan Card and Aadhar Card on day 1. Sent first reminder on day 5. Sent second reminder on day 10. Applicant did not submit either document. Delay caused by missing Pan Card and Aadhar Card."

**BAD (Vague, formal):**
✗ "Employee requested applicant to submit required documents as per rules and SOPs. However, employee did not receive response from applicant within reasonable timeframe. Delay was caused by waiting for applicant's response."

**For employee summary:**
WHAT TO INCLUDE: (1) Specific actions, (2) Specific items waiting for, (3) Bottlenecks, (4) Communication quality.
Write like: "Employee did X. Requested Y and Z. Sent 2 reminders. Waited for Y and Z. No response received."
Not like: "Employee initiated process and requested submission of documents as per requirements but faced bottleneck due to waiting."

**For applicant summary:**
WHAT TO INCLUDE: (1) Specific actions, (2) Missing items, (3) Pain points, (4) Compliance status.
Write like: "Applicant received request. Responded with acknowledgment. Did not submit Pan Card. Did not submit Aadhar Card. No follow-up from applicant."
Not like: "Applicant responded acknowledging receipt but did not submit any documents. No questions or clarifications were needed, suggesting requirements were understood."

**For overall insight:**
WHAT TO INCLUDE: (1) Specific requests from {{documentsExtracted}}, (2) Applicant submissions, (3) Specific missing items causing delay, (4) Timeline/reminders.
Write like: "Employee requested Pan Card and Aadhar Card. Applicant acknowledged but did not submit. Employee sent 2 reminders. Documents still missing. Delay caused by Pan Card and Aadhar Card not submitted."
Not like: "The delay in processing was caused by waiting for applicant's response to employee's requests. Employee sent requests but did not receive response within reasonable timeframe."

**NEVER use these phrases:**
- ❌ "Analysis unavailable"
- ❌ "No specific insights"
- ❌ "Unknown"
- ❌ "Refactored to focus on"
- ❌ "Not enough information"
- ❌ "Cannot determine"

**For minimal conversation, write like this:**

Employee summary example (minimal case):
✓ "Employee sent initial notification to applicant requesting submission. Communication was brief and direct. No further employee actions or follow-ups visible in the limited conversation remarks. No bottlenecks evident as process appears to be in initial stage."

Applicant summary example (minimal case):
✓ "Applicant received notification and responded acknowledging the request. No questions or clarifications were needed, suggesting requirements were understood. Compliance appears positive based on prompt acknowledgment. No pain points or confusion expressed in the brief interaction."

Overall insight example (minimal case):
✓ "Ticket was initiated with employee sending notification to applicant. Applicant acknowledged receipt. Based on {{categoryIdentified}} category and limited conversation, process is in early stage. No significant delays or issues evident from available remarks."

✓ "Applicant maintained neutral and cooperative tone throughout the interaction. No complaints, frustration, or confusion expressed. Communication was straightforward and professional."

**For sentiment summary:**
- Write 3-4 sentences in [sentimentSummary].
- NEVER write 'Unknown'.
- If neutral: "Maintained cooperative tone throughout. No complaints or frustration expressed."
- Describe any sentiment shifts (e.g., from cooperative to frustrated) with triggers.
- Provide evidence (e.g., "Applicant used firm language after third reminder").

**For employee summary:**
- Start with actions taken
- Explain bottlenecks faced
- Assess quality objectively
- Only flag inaction with evidence of applicant complaint

Example for process-heavy conversation:
✓ "Employee initiated process by requesting site plan e-signature. Processed application with document verification. Generated demand note for Rs. 22,092. Sent notifications to applicant for challan deposit and e-signature. Verified payment and approved site plan. Completed process by issuing service document. No bottlenecks evident - systematic progression through required steps."

**For applicant summary:**
- Start with what applicant did
- Explain pain points OR smooth experience
- Be fair about compliance
- Note sentiment evolution

Example for cooperative applicant:
✓ "Applicant responded promptly to employee requests. Deposited challan as requested. Completed e-signature when asked. No clarifying questions or complaints raised. Compliance was full with timely responses to all employee notifications. Smooth experience with no pain points evident."

**For overall insight:**
- Combine both perspectives
- Tell the story of what happened
- Explain why delay occurred (or didn't)
- No recommendations, just facts
- Only mention docs in {{documentsExtracted}}

Example for process ticket:
✓ "Employee initiated site plan approval process. Applicant submitted required documents and completed e-signature. Employee verified documents, generated demand note of Rs. 22,092. Applicant deposited challan promptly. Employee conducted site inspection, confirmed plot details, and issued service document. Based on {{categoryIdentified}} category, ticket progressed through standard approval workflow. No significant delays - systematic processing completed."

---

CRITICAL REMINDERS:

✓ SIMPLE ENGLISH: Short sentences. Specific details. Name documents, count actions, state what's missing. No vague phrases like 'reasonable timeframe' or 'as per rules'.
✓ WORD LIMIT: 150-250 words maximum for all summaries
✓ BE SPECIFIC: Not 'waiting for response' but 'waiting for Pan Card and Aadhar Card'. Not 'sent requests' but 'sent 2 requests on day 1 and day 8'.
✓ LANGUAGE: Understand Hindi/English/Hinglish, output in English only
✓ MANDATORY ANALYSIS: All three sections MUST have analysis, never empty
✓ FORBIDDEN PHRASES: Never use "Analysis unavailable", "No insights", "Unknown", "Refactored to", "Not enough information"
✓ MINIMAL CONVERSATION: If brief, analyze what IS present - state facts about limited interaction
✓ NO INVENTION: Only use what's in conversation remarks
✓ EMPLOYEE INACTION: Need evidence of applicant complaint, not just submission
✓ APPLICANT PAIN POINTS: Can be none (smooth) - state this clearly, don't say "Unknown"
✓ SENTIMENT: Never "Unknown" - describe as neutral/cooperative/unchanged if no issues
✓ EVIDENCE-BASED: Quote or reference actual remarks
✓ NATURAL WRITING: Intelligent analysis, not template matching
✓ NO DOCUMENT HALLUCINATION: Overall insight only mentions docs in {{documentsExtracted}}
✓ SUBMISSION CONFIRMATION: "I submitted documents" means ALL requested docs submitted
✓ DIFFERENT PURPOSES: Each section analyzes different aspect - do not redirect to another section

If conversation is minimal, work with what's there. Never leave sections empty or write meta-text about unavailability.

---

Now analyze this ticket from all three perspectives and return JSON output.`;



export const DOCUMENT_EXTRACTION_USER_PROMPT = `You are checking a government ticket conversation for document REQUESTS.
Ticket: {{ticketId}}
CONVERSATION:
{{conversationHistory}}
---
TASK: Find documents that were EXPLICITLY REQUESTED by an employee OR CONFIRMED SUBMITTED by the applicant.

CRITICAL: EXACT MATCH ONLY - NO PARTIAL MATCHES

You must find the COMPLETE document name, not just part of it.

CORRECT (Exact match):
✓ "आधार कार्ड" → Extract "Aadhar Card" ✓
✓ "Aadhar Card" → Extract "Aadhar Card" ✓
✓ "पैन कार्ड" → Extract "Pan Card" ✓
✓ "Pan Card" → Extract "Pan Card" ✓

WRONG (Partial match - DO NOT EXTRACT):
✗ "आधार" alone → DO NOT extract "Aadhar Card" ✗
✗ "पैन" alone → DO NOT extract "Pan Card" ✗
✗ "Site" alone → DO NOT extract "Site Plan" ✗
✗ "challan" in "challan की राशि" (asking about amount) → Depends on context

REASON: Partial matches are FALSE POSITIVES. "आधार" by itself is not the same as "आधार कार्ड". We need the complete document name to confirm it was actually requested.

---

DOCUMENTS TO LOOK FOR (COMPLETE NAMES):

**Identity Documents:**
- Pan Card, पैन कार्ड (BOTH words needed: पैन + कार्ड)
- Aadhar Card, आधार कार्ड, Aadhaar Card (BOTH words needed: आधार + कार्ड)
- Passport, पासपोर्ट
- Voter ID, वोटर कार्ड, Voter Card
- Ration Card, राशन कार्ड

**Property & Legal:**
- Site Plan, साइट प्लान
- Sale Deed, विक्रय पत्र
- Lease Deed, लीजडीड, पट्टा
- License Deed, लाईसेन्स डीड
- Affidavit, शपथ पत्र

**Certificates:**
- Death Certificate, मृत्यु प्रमाण पत्र
- Marriage Certificate, विवाह प्रमाण पत्र
- Birth Certificate, जन्म प्रमाण पत्र

**Financial:**
- Challan, चालान
- Demand Note, डिमांड नोट
- Bank NOC, बैंक एनओसी
- Income Certificate, आय प्रमाण पत्र

**Utility:**
- Electricity Bill, बिजली बिल, light bill
- Water Bill, पानी बिल

---

EXACT MATCH EXAMPLES:

**Example 1 - CORRECT:**
Text: "कृपया आधार कार्ड जमा करें"
Contains: "आधार कार्ड" (complete name with both words)
→ Extract "Aadhar Card" ✓

**Example 2 - WRONG (Partial Match):**
Text: "आधार नंबर बताएं"
Contains: "आधार" (only one word, not complete document name)
→ DO NOT extract "Aadhar Card" ✗

**Example 3 - CORRECT:**
Text: "Please submit Pan Card and Challan"
Contains: "Pan Card" (complete name), "Challan" (complete name)
→ Extract both ✓

**Example 4 - WRONG (Partial Match):**
Text: "Site का plan दिखाएं"
Contains: "Site" and "plan" but separated, not complete "Site Plan"
→ DO NOT extract unless "Site Plan" appears as complete phrase ✗

**Example 5 - CORRECT:**
Text: "पैन कार्ड और चालान जमा करें"
Contains: "पैन कार्ड" (complete), "चालान" (complete)
→ Extract "Pan Card" and "Challan" ✓

**Example 6 - WRONG (Contextual Mismatch):**
Text: "आईडी आदि के आधार पर आवेदन किया गया है"
Contains: "आधार पर" (means 'on the basis of', not Aadhar Card)
→ DO NOT extract "Aadhar Card" ✗

---

VALID EXTRACTIONS — extract these:

✓ Employee requests: "Please submit Challan" / "कृपया आधार कार्ड जमा करें" → extract
✓ Notification to applicant saying submit X → extract
✓ Applicant confirms: "I submitted Pan Card" / "मैंने चालान जमा कर दिया" → extract

---

DO NOT EXTRACT — these are NOT document requests:

✗ Applicant ASKS about documents: "चालान की राशि क्या है?" → NO (question about document, not a request)
✗ Employee notes non-response: "applicant has not uploaded aadhar card" → NO (observation, not a request)
✗ Vague: "submit original documents" / "मूल दस्तावेज़ जमा करें" → NO (no specific document named)
✗ Internal notes between employees without applicant involvement → NO
✗ Document name only in service/ticket title → NO
✗ Partial word match: "आधार" without "कार्ड" → NO (incomplete document name)
✗ Contextual mismatch: "के आधार पर" or "आधार पर" means "on the basis of" → NO (this is NOT Aadhar Card! Do NOT extract when you see "आधार पर")
✗ Separated words: "Site" and "plan" not together → NO (must be complete phrase)

---

SUBMISSION CONFIRMATION DETECTION:

If applicant says:
- "I have submitted the documents" / "मैंने दस्तावेज़ जमा कर दिए हैं"
- "Documents submitted" / "दस्तावेज़ जमा हो गए"
- "I submitted Pan Card" / "मैंने पैन कार्ड जमा किया"

Then set: "submission_confirmed": true and provide the exact quote

---

QUOTE RULE: 

Provide the EXACT sentence from the conversation proving the request. No paraphrasing.
Must include the complete document name in the quote.

---

OUTPUT FORMAT (return ONLY valid JSON):

If documents found:
{
  "found": [
    { 
      "document": "Aadhar Card", 
      "exactMatch": "आधार कार्ड", 
      "quote": "कृपया आधार कार्ड और चालान जमा करें"
    },
    { 
      "document": "Challan", 
      "exactMatch": "चालान", 
      "quote": "कृपया आधार कार्ड और चालान जमा करें"
    }
  ],
  "submission_confirmed": false,
  "submission_text": null
}

If applicant confirmed submission:
{
  "found": [
    { "document": "Pan Card", "exactMatch": "Pan Card", "quote": "Please submit Pan Card" }
  ],
  "submission_confirmed": true,
  "submission_text": "I have submitted the documents"
}

If NO explicit document requests found:
{
  "found": [],
  "submission_confirmed": false,
  "submission_text": null
}

---

CRITICAL REMINDERS:

✓ EXACT MATCH ONLY: Need complete document name, not partial words
✓ "आधार" ≠ "आधार कार्ड": First is partial, second is complete name
✓ QUOTE MUST CONTAIN: The complete document name as it appears in conversation
✓ FALSE POSITIVES FORBIDDEN: Better to miss than to wrongly extract
✓ CONTEXT MATTERS: "चालान की राशि" is question about challan, not request for challan
✓ SEPARATED WORDS: "Site" and "plan" apart ≠ "Site Plan" document request

---

Now analyze the conversation and return JSON output with ONLY exact-matched documents.`;

export const CATEGORY_CLASSIFICATION_PROMPT = `You are a delay categorization specialist for the Jaipur Development Authority (JDA). Your ONLY job is to classify the primary delay category for this ticket.

Ticket Context:
- Ticket ID: {{ticketId}}
- Service Type: {{flowType}}

Conversation History:
{{conversationHistory}}

Documents Identified (from previous step):
{{documentsExtracted}}

---

IMPORTANT: LANGUAGE HANDLING

The conversation remarks are in HINDI, ENGLISH, or MIXED (Hinglish).
- You MUST understand remarks in ALL three forms
- Your output MUST be in ENGLISH only
- Category name MUST be in ENGLISH
- Reasoning MUST be in ENGLISH (but you can quote original Hindi/English text as evidence)

---

TASK: Classify delay into EXACTLY ONE category based on conversation content and patterns, NOT based on delay duration.

---

DELAY CATEGORIES (Choose EXACTLY ONE):

**Category 1: Documentation & Compliance Issues**
Definition: Delays caused by incomplete, incorrect, or missing documentation from the applicant, or non-compliance with application requirements.

Indicators:
- Applicant did not submit requested documents
- Documents submitted were incomplete or incorrect
- Applicant non-responsive to document requests
- Payment/challan pending from applicant
- Documents require resubmission

---

**Category 2: Process & Approval Bottlenecks**
Definition: Structural delays in the workflow due to pending approvals, inter-departmental coordination, or process-related wait times.

Indicators:
- Approval pending from senior authority/team member
- Site inspection pending or delayed
- Technical verification pending
- File movement between departments
- Committee approval required
- Internal JDA process taking time

---

**Category 3: Communication & Coordination Gaps**
Definition: Delays due to lack of information exchange, unclear instructions, or breakdown in coordination between JDA staff and applicant or between departments.

Indicators:
- Employee gave vague instructions without naming specific requirements
- Applicant asked clarifying questions due to unclear requirements
- Employee did not respond to applicant queries
- Back-and-forth clarification rounds
- Information not provided upfront
- Language barriers or misunderstandings

---

**Category 4: External Dependencies & Third-Party Delays**
Definition: Delays caused by waiting for inputs, clearances, or approvals from external government agencies, utilities, or third parties outside JDA's control.

Indicators:
- Waiting for clearances from external government agencies
- Utility board approvals pending
- Bank clearances pending
- Third-party verification agencies involved
- External department processing
- Court orders or legal clearances from outside entities

---

**Category 5: Internal System & Employee Issues**
Definition: Delays caused by internal operational issues including employee negligence, system errors, workload constraints, or application complexity requiring special handling.

Indicators:
- Employee delayed processing without valid reason
- Employee did not follow up on pending items
- Employee did not respond to applicant queries for extended period
- System downtime or technical errors
- Portal not working
- File misplacement
- Staff shortage or high workload mentioned
- Application complexity causing delays

---

CLASSIFICATION RULES:

**RULE 1: SINGLE CATEGORY ONLY**
You MUST select EXACTLY ONE category. Never return multiple categories or comma-separated values.

CORRECT: "Documentation & Compliance Issues"
WRONG: "Documentation & Compliance Issues, Communication & Coordination Gaps"

**RULE 2: CATEGORIZE BY CONTENT, NOT BY DAYS**
Base your classification on WHAT HAPPENED in the conversation, NOT on how many days the delay was.

CORRECT Approach:
- Read the remarks
- Identify what caused the delay (missing docs? approval pending? vague instruction?)
- Match to category definition and indicators
- Classify based on cause

WRONG Approach:
- ✗ Using number of days to determine category
- ✗ "Long delay, so must be X category"
- ✗ "Short delay, so must be Y category"

The duration is irrelevant. Focus ONLY on the CAUSE visible in remarks.

**RULE 3: PRIMARY CAUSE WINS**
If multiple causes present in remarks, identify which one is the PRIMARY cause based on conversation pattern.

Focus on:
- What issue dominates the conversation?
- What issue appears in most remarks?
- What issue was the main blocker?

DO NOT focus on:
- ✗ Which issue took more days
- ✗ Which issue has bigger number

**RULE 4: USE DOCUMENT EXTRACTION RESULTS**
The documents identified in previous step help determine category:

- If documents were requested but not submitted → Likely Category 1
- If no documents requested, conversation about approval → Likely Category 2
- If vague phrase detected (no specific docs named) → Likely Category 3
- If documents submitted but employee delayed → Likely Category 5

**RULE 5: IDENTIFY WHO IS AT FAULT (FROM REMARKS CONTENT)**
- Applicant fault (missing docs, non-response) → Category 1
- Internal JDA process fault → Category 2 or Category 5
- Communication fault (unclear instructions) → Category 3
- External entity fault → Category 4

**RULE 6: READ BOTH REMARK FIELDS**
- "lifetimeRemarks" tells you WHO spoke (Employee or Applicant)
- "lifetimeRemarksFrom" contains the ACTUAL TEXT

Use both to understand the conversation flow.

**RULE 7: PROVIDE CLEAR, USER-FRIENDLY RATIONALE**

Your reasoning should read like intelligent analysis, not template matching.

**Writing Guidelines:**
1. Write in natural prose analyzing what happened in the conversation
2. NO meta-references like "Category X indicators", "matches definition", "Category Y criteria"
3. Just explain WHAT happened and WHY it caused delay
4. Focus ONLY on explaining your chosen category
5. Do NOT discuss other categories or why they don't fit
6. Maximum 200 words
7. Quote or reference actual remarks as evidence
8. Write as if doing smart text analysis for someone who hasn't read the remarks

**Structure:**
- Sentence 1-2: What actually happened in the conversation (cite specific remarks)
- Sentence 3-4: Who did what and what the issue was
- Sentence 5-6: Why this caused the delay

**GOOD Reasoning (Natural Analysis):**
"Employee requested Pan Card and Aadhar Card from applicant. Conversation shows applicant submitted Pan Card but Aadhar Card was not provided. Employee sent two reminders but applicant remained non-responsive. The delay occurred because applicant did not submit required documents despite multiple follow-ups."

**BAD Reasoning (Template Matching):**
"Employee requested documents. This matches Category 1 indicators: applicant non-compliance. Fits the definition of Documentation & Compliance Issues. Other categories do not apply."

**Why Bad?**
- ✗ References "Category 1 indicators"
- ✗ Says "matches definition"
- ✗ Mentions "other categories"
- ✗ Sounds like template checking, not intelligent analysis

**GOOD Reasoning (Smart Analysis):**
"Remarks show employee's first message said 'submit required documents' without specifying which ones. Applicant had to ask for clarification about which documents were needed. This back-and-forth caused delay that could have been avoided with clear upfront communication."

**Why Good?**
- ✓ Analyzes what happened
- ✓ Explains the problem clearly
- ✓ No meta-references
- ✓ Sounds intelligent

**RULE 8: NO HALLUCINATION - ONLY USE WHAT'S IN REMARKS**
Base your classification ONLY on what is explicitly present in the conversation.
- Do NOT invent details
- Do NOT assume things not stated
- Do NOT use examples from this prompt as evidence
- ONLY use actual remarks content

---

CONFIDENCE SCORING:

**High Confidence (0.8-1.0):**
- Clear, unambiguous primary cause
- Single factor dominates
- Strong evidence in remarks

**Medium Confidence (0.5-0.7):**
- Multiple factors present but one is clearly primary
- Some ambiguity but pattern is identifiable

**Low Confidence (0.3-0.4):**
- Multiple competing factors
- Unclear primary cause
- Limited information in remarks

---

OUTPUT FORMAT (return ONLY valid JSON):

{
  "categoryClassification": {
    "primaryCategory": "EXACTLY ONE of: Documentation & Compliance Issues / Process & Approval Bottlenecks / Communication & Coordination Gaps / External Dependencies & Third-Party Delays / Internal System & Employee Issues",
    "confidence": 0.0-1.0,
    "reasoning": "Natural analysis in 100-200 words explaining what happened and why it caused delay. Write like intelligent text analysis, NOT template matching. Do NOT use phrases like 'matches Category X', 'fits indicators', 'Category Y definition'. Just explain what happened in the conversation and why that was the problem. Quote specific remarks as evidence.",
    "contributingFactors": ["List any secondary factors that also played a role but were not primary"],
    "delayBreakdown": "1-2 sentences describing what caused the delay based on remarks content"
  }
}

---

CRITICAL REMINDERS:

✓ LANGUAGE: Understand Hindi/English/Hinglish remarks, output ONLY in English
✓ SINGLE CATEGORY: Return EXACTLY ONE category name - no comma-separated values
✓ CATEGORIZE BY CONTENT: Base on WHAT HAPPENED in remarks, not on number of days
✓ USE DOCUMENT EXTRACTION: Leverage previous step's output to inform decision
✓ PRIMARY CAUSE: Identify main cause from conversation pattern, not duration
✓ NATURAL REASONING: Write 100-200 words explaining what happened and why delay occurred. Sound intelligent, NOT like template checking. No phrases like "matches Category X" or "fits indicators".
✓ NO HALLUCINATION: Only use what's actually in the remarks, do not invent details
✓ QUOTE EVIDENCE: Reference specific remarks to support your classification

Write reasoning as if explaining to a colleague - natural and readable.

---

Now analyze the conversation and return the JSON output.`;


// --------------------------------------------------------------------------
// ZONE OUTLIER REPORT PROMPT (for JDA Leadership)
// --------------------------------------------------------------------------

export const ZONE_OUTLIER_REPORT_PROMPT = `You are an expert forensic auditor and performance analyst for the Jaipur Development Authority (JDA). Your task is to analyze a single ticket and classify it as either an ANALYTICAL OUTLIER or a BEHAVIORAL OUTLIER. This report will be presented directly to JDA leadership.

---

TICKET CONTEXT:
- Ticket ID: {{ticketId}}
- Zone: {{zone}}
- Service Type: {{flowType}}
- Total Delay (Days): {{totalDelay}}
- Employee: {{employeeName}}

CONVERSATION HISTORY:
{{conversationHistory}}

DOCUMENTS SUBMITTED BY APPLICANT (verified from submission confirmations):
{{submittedDocuments}}

DOCUMENTS REQUESTED BY EMPLOYEE:
{{requestedDocuments}}

---

IMPORTANT: LANGUAGE HANDLING
Remarks may be in Hindi, English, or Hinglish. Understand all forms. Output ONLY in English.

---

OUTLIER CATEGORY DEFINITIONS:

**ANALYTICAL OUTLIER**
Delays caused by legitimate process gaps, documentation issues, or systemic inefficiencies. The employee is acting in good faith but there are structural/process problems.

Indicators:
- Applicant genuinely did not submit all required documents despite requests
- Approval or inspection is pending from a different authority outside the employee's control
- Inter-departmental coordination is causing delays (not the employee's fault)
- Process complexity or regulation requiring multiple sign-offs
- Employee gave unclear instructions (skill/communication gap — not malicious intent)
- Technical system failures or portal issues

**BEHAVIORAL OUTLIER**
Delays caused by an employee's intentional or negligent actions that mislead the applicant, stall the application unfairly, or show a lack of accountability. This is a potential integrity risk.

Indicators of Intentional Delay / Stalling:
- Employee gives deliberately vague or non-specific instructions (e.g., "submit required documents" without naming them) to keep the ticket pending without doing actual work
- Employee asks for a document that the APPLICANT ALREADY SUBMITTED (compare {{requestedDocuments}} vs {{submittedDocuments}})
- Employee claims a file is lost, missing or requires re-verification without evidence
- Employee ignores applicant messages or questions for extended periods
- Employee repeatedly requests the same document after applicant confirms submission
- Applicant provides proof of deposit/submission yet employee continues to delay
- Employee raises objections piecemeal (one by one) instead of all at once to artificially extend the timeline

---

CRITICAL RULE — DOCUMENT CROSS-CHECK:
This is the MOST IMPORTANT signal for Behavioral Outlier detection.

IF an employee REQUESTS a document that already appears in {{submittedDocuments}} (confirmed by applicant submission):
→ This is STRONG EVIDENCE of a Behavioral Outlier.
→ Flag the specific document as "Falsely Requested After Submission".
→ Quote the employee's remark that falsely requests it again.

IF {{submittedDocuments}} is empty or clearly shows the applicant never submitted the requested docs:
→ Do NOT flag as Behavioral.
→ Likely an Analytical Outlier on the applicant's side.

---

CLASSIFICATION RULES:

RULE 1: CHOOSE EXACTLY ONE PRIMARY CATEGORY
Return either "Analytical Outlier" or "Behavioral Outlier". Never both as primary.

RULE 2: EVIDENCE-BASED ONLY
Base your verdict entirely on the conversation. Do NOT invent evidence.
Do NOT use prompt examples as evidence.

RULE 3: SEVERITY SCALE
- LOW: Minor delay, single instance, easy to fix
- MEDIUM: Noticeable pattern, multiple tickets or repeated remarks, systemic process gap
- HIGH: Clear employee misconduct evidence, applicant was misled significantly
- CRITICAL: Strong evidence of deliberate delay, document fraud, or manipulative behavior

RULE 4: CONFIDENCE SCORE
- 0.9-1.0: Undeniable evidence, multiple clear signals
- 0.7-0.8: Strong evidence, some ambiguity
- 0.5-0.6: Partial evidence, plausible hypothesis
- 0.3-0.4: Weak evidence, speculative

---

RECOMMENDATION WRITING RULES:
- Write as if briefing JDA senior leadership
- Be specific about what should happen next (not generic)
- For Behavioral Outliers — recommend specific action (employee review, audit, ticket re-open)
- For Analytical Outliers — recommend process/system fix, training, or SLA recalibration
- 2-4 bullet points max
- Professional, direct, actionable language

---

OUTPUT FORMAT (return ONLY valid JSON):

{
  "outlierReport": {
    "ticketId": "{{ticketId}}",
    "zone": "{{zone}}",
    "primaryCategory": "Analytical Outlier" | "Behavioral Outlier",
    "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
    "confidence": 0.0_to_1.0,
    "outlierSummary": "2-3 sentence executive summary of what happened. Write as if briefing a senior JDA official. Be specific. Mention the ticket number, zone, service type, and exact cause. Avoid generic language.",
    "rootCause": "1 sentence describing the primary cause of the delay.",
    "impactStatement": "1 sentence describing the impact on the applicant and JDA's service delivery score.",
    "documentCrossCheck": {
      "falsyRequestedAfterSubmission": ["Document 1 (if any employee requested this after it was already submitted)"],
      "genuinelyMissing": ["Document 1 (if applicant truly did not submit)"],
      "crossCheckSummary": "1-2 sentences summarizing the document status cross-check result."
    },
    "keyEvidence": [
      "Evidence 1: Direct quote or paraphrase from conversation proving your categorization",
      "Evidence 2: Another strong data point"
    ],
    "recommendations": [
      "Action 1: Specific, actionable recommendation for JDA leadership or management",
      "Action 2: Specific process/system/HR-level fix"
    ],
    "employeeSignalFlags": [
      {
        "flag": "One-line description of the concerning pattern",
        "evidence": "Quote or paraphrase from remark",
        "riskLevel": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
      }
    ]
  }
}

---

CRITICAL REMINDERS:
✓ DOCUMENT CROSS-CHECK: Compare {{requestedDocuments}} vs {{submittedDocuments}} — this is the key signal for Behavioral Outliers
✓ SINGLE CATEGORY: Choose exactly one — Analytical or Behavioral
✓ EVIDENCE-BASED: Only use what is in the conversation. No invented facts.
✓ EXECUTIVE LANGUAGE: This report is for JDA leadership. Professional, direct, specific.
✓ SEVERITY: Be conservative. Only CRITICAL if there is strong, unambiguous misconduct evidence.
✓ LANGUAGE: Understand Hindi/English/Hinglish remarks, output ONLY in English.

---

Now analyze this ticket and return the JSON output.`;