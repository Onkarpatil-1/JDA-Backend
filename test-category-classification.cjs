#!/usr/bin/env node
/**
 * JDA Category Classification — CSV Test Script
 *
 * Usage:
 *   node test-category-classification.cjs <path-to-csv>
 *   node test-category-classification.cjs data.csv --host http://localhost:11434
 *   node test-category-classification.cjs data.csv --model llama3.2:3b
 *   node test-category-classification.cjs data.csv --tickets 67523465,10399  (run only these)
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ─── CLI ARGS ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const CSV_FILE = args.find(a => !a.startsWith('--') && a.endsWith('.csv') || (!a.startsWith('--') && fs.existsSync(a)));
const getArg = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };

const OLLAMA_HOST = getArg('--host') || 'http://localhost:11434';
const MODEL_OVERRIDE = getArg('--model');
const TICKET_FILTER = getArg('--tickets') ? getArg('--tickets').split(',') : null;
const DEBUG = args.includes('--debug');

if (!CSV_FILE || !fs.existsSync(CSV_FILE)) {
    console.error(`\nUsage: node test-category-classification.cjs <path-to-csv> [options]`);
    console.error(`  --host   <url>      Ollama host (default: http://localhost:11434)`);
    console.error(`  --model  <name>     Model name (default: auto-detected)`);
    console.error(`  --tickets <ids>     Comma-separated ticket IDs to run (default: all)`);
    process.exit(1);
}

// ─── PROMPT ──────────────────────────────────────────────────────────────────
const CATEGORY_CLASSIFICATION_PROMPT = `You are a delay categorization specialist for the Jaipur Development Authority (JDA). Your ONLY job is to classify the primary delay category for this ticket.

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

Examples:
- Employee requested Pan Card, applicant did not submit
- Employee sent 2 reminders, applicant still not compliant
- Documents uploaded were wrong format/invalid

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

Examples:
- "Sent for site inspection" - pending for 10 days
- "Awaiting approval from Deputy Commissioner"
- "File sent to technical section for review"

---

**Category 3: Communication & Coordination Gaps**
Definition: Delays due to lack of information exchange, unclear instructions, or breakdown in coordination between JDA staff and applicant or between departments.

Indicators:
- Employee gave vague instructions (e.g., "submit required documents" without naming)
- Applicant asked clarifying questions due to unclear requirements
- Employee did not respond to applicant queries
- Back-and-forth clarification rounds
- Information not provided upfront (challan amount, deadlines, etc.)
- Language barriers or misunderstandings

Examples:
- Employee: "Submit required documents" (vague)
- Applicant: "Which documents?" (had to ask for clarification)
- Employee didn't specify challan amount, applicant had to inquire

---

**Category 4: External Dependencies & Third-Party Delays**
Definition: Delays caused by waiting for inputs, clearances, or approvals from external government agencies, utilities, or third parties outside JDA's control.

Indicators:
- Waiting for Fire NOC
- Electricity/Water board clearance pending
- Bank NOC or clearance pending
- Municipal corporation approval pending
- Revenue department processing
- Court orders or legal clearances
- Third-party verification agencies

Examples:
- "Awaiting Fire NOC from Fire Department"
- "Bank clearance pending"
- "Electricity connection approval from JVVNL pending"

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

Examples:
- Applicant submitted documents, employee took 15 days to review (no reason)
- Employee didn't respond to applicant query for 10 days
- "System was down, could not process"
- "File was misplaced, found after 7 days"

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
- Match to category definition
- Classify based on cause

WRONG Approach:
- ✗ "15-day delay, so must be Category 1"
- ✗ "Short delay, so Category 3"
- ✗ Using number of days to determine category

Example:
- 2-day delay due to missing Aadhar Card → Category 1 (Documentation)
- 20-day delay due to vague instruction → Category 3 (Communication)
→ Duration doesn't matter, CAUSE matters

**RULE 3: PRIMARY CAUSE WINS**
If multiple causes present in remarks, identify which one is the PRIMARY cause based on conversation pattern.

Focus on:
- What issue appeared first?
- What issue dominates the conversation?
- What issue appears in most remarks?

DO NOT focus on:
- ✗ Which issue took more days
- ✗ Which issue has bigger number

Example:
Remarks show:
- Employee gave vague instruction → Applicant asked for clarification
- After clarification, applicant didn't submit Aadhar Card → Multiple reminders sent

Analysis:
- Communication gap happened first (vague instruction)
- Documentation issue dominates conversation (multiple reminders, most remarks about this)
→ Choose Category 1 (Documentation) as PRIMARY
→ Note Category 3 (Communication) as contributing factor

**RULE 4: USE DOCUMENT EXTRACTION RESULTS**
The documents identified in previous step help determine category:

- If documents were requested but not submitted → Category 1
- If no documents requested, conversation about approval → Category 2
- If vague phrase detected (no specific docs named) → Category 3
- If documents submitted but employee delayed → Category 5

**RULE 5: IDENTIFY WHO IS AT FAULT (FROM REMARKS CONTENT)**
- Applicant fault (missing docs, non-response) → Category 1
- Internal JDA process fault → Category 2 or Category 5
- Communication fault (unclear instructions) → Category 3
- External entity fault → Category 4

**RULE 6: READ BOTH REMARK FIELDS**
- "lifetimeRemarks" tells you WHO spoke (Employee or Applicant)
- "lifetimeRemarksFrom" contains the ACTUAL TEXT

Use both to understand the conversation flow.

**RULE 7: PROVIDE DETAILED RATIONALE (CRITICAL FOR QUALITY ASSESSMENT)**
Your reasoning MUST clearly explain:
1. WHAT you observed in the remarks (quote or paraphrase specific evidence)
2. WHY this evidence points to the chosen category
3. HOW it matches the category definition and indicators
4. WHAT alternative categories you considered and why you rejected them (if applicable)

This detailed rationale helps us:
- Assess the quality of LLM classification decisions
- Identify patterns where the model might be confused
- Enable targeted fine-tuning and prompt improvements
- Build trust in automated categorization

**RULE 4: WHO IS AT FAULT?**
- Applicant fault (missing docs, non-response) → Category 1
- Internal JDA process fault → Category 2 or Category 5
- Communication fault (unclear instructions) → Category 3
- External entity fault → Category 4

**RULE 5: READ BOTH REMARK FIELDS**
- "lifetimeRemarks" tells you WHO spoke (Employee or Applicant)
- "lifetimeRemarksFrom" contains the ACTUAL TEXT

Use both to understand the conversation flow.

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
    "reasoning": "2-3 sentences explaining WHY this category was chosen. Reference specific evidence from remarks. If documents were involved, mention which ones and what happened.",
    "contributingFactors": ["List any secondary factors that also played a role but were not primary"],
    "delayBreakdown": "Describe what caused the delay in 1-2 sentences with specifics from remarks"
  }
}

---

EXAMPLES:

**Example 1: Documentation Issue**
Documents Extracted: ["Pan Card", "Aadhar Card"]
Remarks: Employee requested both. Applicant submitted Pan Card but not Aadhar Card. Employee sent 2 reminders.
Output:
{
  "categoryClassification": {
    "primaryCategory": "Documentation & Compliance Issues",
    "confidence": 0.95,
    "reasoning": "Employee clearly requested Pan Card and Aadhar Card (found in document extraction). Conversation shows applicant submitted Pan Card but Aadhar Card remained pending. Employee sent 2 reminders for Aadhar Card in subsequent remarks. Pattern matches Category 1 definition: missing documentation from applicant and non-compliance with document submission requirements. This is clearly applicant-side delay, not employee or process issue.",
    "contributingFactors": [],
    "delayBreakdown": "Delay was caused by applicant not submitting Aadhar Card despite clear request and multiple reminders."
  }
}

**Example 2: Communication Gap**
Documents Extracted: [] (empty - vague phrase detected)
Remarks: Employee said "submit required documents". Applicant asked "which documents?". Employee then clarified.
Output:
{
  "categoryClassification": {
    "primaryCategory": "Communication & Coordination Gaps",
    "confidence": 0.9,
    "reasoning": "Document extraction found zero documents because employee gave vague instruction 'submit required documents' without naming specific documents. This forced applicant to ask clarifying question 'which documents?'. Pattern shows lack of information exchange and unclear initial instruction, matching Category 3 definition perfectly. Employee later clarified, but initial communication gap is the primary cause. Not Category 1 because applicant was willing to comply once they knew what was needed.",
    "contributingFactors": ["After clarification, applicant complied promptly showing willingness"],
    "delayBreakdown": "Clarification delay due to employee not specifying document names upfront."
  }
}

**Example 3: Process Bottleneck**
Documents Extracted: [] (no documents mentioned)
Remarks: "Sent for site inspection", "Inspection pending", "Awaiting approval from senior authority"
Output:
{
  "categoryClassification": {
    "primaryCategory": "Process & Approval Bottlenecks",
    "confidence": 0.85,
    "reasoning": "Conversation keywords indicate internal JDA workflow: 'site inspection' and 'approval from senior authority'. No documents were mentioned (extraction returned empty), confirming this is about internal processes, not applicant documents. Pattern matches Category 2 definition: structural delays in workflow due to pending approvals. Site inspection and senior authority approval are standard JDA internal processes. Not Category 5 because this appears to be normal process flow, not employee negligence.",
    "contributingFactors": [],
    "delayBreakdown": "Delay waiting for site inspection completion and subsequent senior authority approval (internal JDA processes)."
  }
}

**Example 4: External Dependency**
Documents Extracted: []
Remarks: "Awaiting Fire NOC", "Fire Department has not responded", "Third-party clearance pending"
Output:
{
  "categoryClassification": {
    "primaryCategory": "External Dependencies & Third-Party Delays",
    "confidence": 0.9,
    "reasoning": "Remarks explicitly mention 'Fire NOC' and 'Fire Department', which is an external government agency outside JDA's control. Phrase 'third-party clearance' confirms external dependency. Pattern matches Category 4 definition: delays from external entities. JDA cannot expedite Fire Department's processing. Not Category 2 (internal process) because Fire Department is external to JDA. Not Category 5 because delay is not due to JDA employee inaction.",
    "contributingFactors": [],
    "delayBreakdown": "Waiting for Fire Department to issue NOC (external third-party process)."
  }
}

**Example 5: Employee Issue**
Documents Extracted: ["Pan Card", "Challan"] (both submitted by applicant)
Remarks: Applicant says "I have submitted the documents". No employee response or action visible for extended period.
Output:
{
  "categoryClassification": {
    "primaryCategory": "Internal System & Employee Issues",
    "confidence": 0.8,
    "reasoning": "Document extraction shows Pan Card and Challan were requested. Remarks show applicant confirmed 'I have submitted the documents', indicating compliance. However, conversation shows employee did not process or respond after receiving documents. No mention of waiting for approvals or inspections. Pattern matches Category 5 definition: employee negligence or delayed processing. Not Category 1 because applicant was compliant. Not Category 2 because no internal approval process mentioned.",
    "contributingFactors": ["Applicant was compliant and responsive"],
    "delayBreakdown": "Employee did not process application after receiving all required documents from applicant."
  }
}

**Example 6: Mixed Factors (Primary vs Contributing)**
Documents Extracted: ["Aadhar Card"]
Remarks: Employee first said "submit required documents" (vague). Applicant asked "which documents?". Employee clarified "Aadhar Card needed". After clarification, applicant didn't submit. Employee sent multiple reminders.
Output:
{
  "categoryClassification": {
    "primaryCategory": "Documentation & Compliance Issues",
    "confidence": 0.75,
    "reasoning": "Two issues present: (1) Initial vague instruction (Communication Gap), (2) Applicant not submitting Aadhar Card after clarification (Documentation Issue). Analyzing conversation pattern: vague instruction happened once at start. Document non-submission appears in multiple subsequent remarks with reminders. Documentation issue dominates the conversation flow. Category 1 is primary because most remarks are about requesting Aadhar Card. Alternative Category 3 (Communication) considered but rejected because after clarification was provided, applicant still did not comply, showing primary issue is documentation compliance, not communication.",
    "contributingFactors": ["Initial communication gap added to delay but was resolved"],
    "delayBreakdown": "Primary cause is applicant not submitting Aadhar Card after receiving clear request. Secondary factor was initial vague instruction requiring clarification."
  }
}

---

CRITICAL REMINDERS:

✓ LANGUAGE: Understand Hindi/English/Hinglish remarks, output ONLY in English
✓ SINGLE CATEGORY: Return EXACTLY ONE category name - no comma-separated values
✓ CATEGORIZE BY CONTENT: Base on WHAT HAPPENED, not on number of days
✓ USE DOCUMENT EXTRACTION: Leverage previous step's output to inform decision
✓ PRIMARY CAUSE: Identify main cause from conversation pattern, not duration
✓ DETAILED RATIONALE: Explain what you observed, why it fits the category, how it matches definition, what alternatives you considered
✓ READ BOTH FIELDS: lifetimeRemarks (who) and lifetimeRemarksFrom (what)
✓ QUOTE EVIDENCE: Reference specific remarks to support your classification

Your detailed reasoning helps us assess LLM quality and improve the system.

---

Now analyze the following conversation and return the JSON output.

Ticket Context:
- Ticket ID: {{ticketId}}
- Service Type: {{flowType}}

Documents Identified (from previous step):
{{documentsExtracted}}

Conversation History:
{{conversationHistory}}
`;

// ─── CSV PARSER (RFC-4180 compatible — handles quoted fields) ───────────────
function parseCSVLine(line, delimiter) {
    const fields = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') { current += '"'; i++; } // escaped quote
            else { inQuotes = !inQuotes; }
        } else if (ch === delimiter && !inQuotes) {
            fields.push(current.trim()); current = '';
        } else {
            current += ch;
        }
    }
    fields.push(current.trim());
    return fields;
}

function parseCSV(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, ''); // strip BOM
    const lines = content.split(/\r?\n/).filter(l => l.trim());
    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    const headers = parseCSVLine(lines[0], delimiter);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const cells = parseCSVLine(lines[i], delimiter);
        if (cells.length < 3) continue;
        const row = {};
        headers.forEach((h, idx) => { row[h] = (cells[idx] || '').trim(); });
        rows.push(row);
    }
    return rows;
}

function groupByTicket(rows) {
    const tickets = {};
    for (const row of rows) {
        const id = row['Ticket ID'] || row['TicketID'] || row['ticket_id'] || '';
        if (!id) continue;
        if (!tickets[id]) {
            tickets[id] = {
                id,
                service: row['ServiceName'] || row['ParentServiceName'] || '',
                department: row['DepartmentName'] || '',
                rows: []
            };
        }
        tickets[id].rows.push(row);
    }
    return tickets;
}

function buildConversationHistory(ticketData) {
    const lines = [];
    for (const row of ticketData.rows) {
        let label = (row['LifeTimeRemarks'] || '').trim();
        let remark = (row['LifeTimeRemarksFrom'] || '').trim();
        const empName = (row['Employee Name'] || '').trim();
        const post = (row['Post'] || '').trim();
        const date = (row['LifeTimeEventStampDate'] || '').trim();

        // Handle Excel Copy-Paste Tab Separated inside a single field if it occurred
        if (!remark && label.includes('\t')) {
            const parts = label.split('\t');
            label = parts[0]?.trim() || '';
            remark = parts[1]?.trim() || '';
        }

        if (!remark || remark === 'NULL' || remark === '') continue;

        const isApplicant =
            empName.toUpperCase() === 'APPLICANT' ||
            label.toLowerCase().includes('reply from applicant') ||
            remark.toLowerCase().startsWith('reply from applicant');

        const speaker = isApplicant
            ? 'Applicant'
            : `Employee (${empName}${post ? ' - ' + post : ''})`;

        lines.push(`[${date}] ${speaker}: ${remark}`);
    }
    return lines.join('\n');
}

// ─── SIMPLE DETERMINISTIC SCANNER (for {{documentsExtracted}}) ───────────────
const DOC_SCAN_MAP = [
    { name: 'Pan Card', aliases: ['pan card', 'pancard', 'पैन कार्ड'], wordAliases: ['pan'] },
    { name: 'Aadhar Card', aliases: ['aadhar card', 'aadhar', 'adhar card', 'adhar', 'aadhaar', 'aadhaar card', 'आधार कार्ड', 'आधार'] },
    { name: 'Passport', aliases: ['passport', 'पासपोर्ट'] },
    { name: 'Voter ID', aliases: ['voter id', 'voter card', 'वोटर कार्ड', 'voter i/d'] },
    { name: 'Ration Card', aliases: ['ration card', 'राशन कार्ड'] },
    { name: 'Site Plan', aliases: ['site plan', 'साइट प्लान', 'site map'] },
    { name: 'Sale Deed', aliases: ['sale deed', 'विक्रय पत्र', 'sale-deed'] },
    { name: 'Lease Deed', aliases: ['lease deed', 'leasedeed', 'patta', 'e-patta', 'ई-पट्टा', 'लीजडीड', 'पट्टा'] },
    { name: 'License Deed', aliases: ['license deed', 'licence deed', 'लाईसेन्स डीड'] },
    { name: 'Affidavit', aliases: ['affidavit', 'शपथ पत्र'] },
    { name: 'Death Certificate', aliases: ['death certificate', 'मृत्यु प्रमाण पत्र'] },
    { name: 'Marriage Certificate', aliases: ['marriage certificate', 'विवाह प्रमाण पत्र'] },
    { name: 'Birth Certificate', aliases: ['birth certificate', 'जन्म प्रमाण पत्र'] },
    { name: 'Challan', aliases: ['challan', 'चालान'] },
    { name: 'Demand Note', aliases: ['demand note', 'demand-note', 'डिमांड नोट', 'मांग पत्र'] },
    { name: 'Bank NOC', aliases: ['bank noc', 'bank n.o.c', 'बैंक एनओसी'] },
    { name: 'Income Certificate', aliases: ['income certificate', 'आय प्रमाण पत्र'] },
    { name: 'Electricity Bill', aliases: ['electricity bill', 'electric bill', 'light bill', 'bijli bill', 'बिजली बिल', 'बिजली का बिल'] },
    { name: 'Water Bill', aliases: ['water bill', 'paani bill', 'पानी बिल', 'पानी का बिल'] },
];

function codeScanner(conversationHistory) {
    const lower = conversationHistory.toLowerCase();
    return DOC_SCAN_MAP.filter(doc => {
        if (doc.aliases.some(a => lower.includes(a.toLowerCase()))) return true;
        if (doc.wordAliases) {
            return doc.wordAliases.some(a => new RegExp(`\\b${a}\\b`, 'i').test(lower));
        }
        return false;
    }).map(doc => doc.name);
}

// ─── OLLAMA HELPERS ──────────────────────────────────────────────────────────
async function getAvailableModel(host) {
    return new Promise((resolve) => {
        const url = new URL(`${host.replace(/\/$/, '')}/api/tags`);
        const lib = url.protocol === 'https:' ? https : http;
        const req = lib.request({ hostname: url.hostname, port: url.port || 11434, path: url.pathname, method: 'GET', timeout: 5000 }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const models = json.models || [];
                    const preferred = ['llama3:8b', 'llama3.1:8b', 'llama3.2:3b', 'llama3:latest'];
                    for (const p of preferred) {
                        if (models.some(m => m.name === p)) { resolve(p); return; }
                    }
                    resolve(models[0]?.name || null);
                } catch { resolve(null); }
            });
        });
        req.on('error', () => resolve(null));
        req.on('timeout', () => { req.destroy(); resolve(null); });
        req.end();
    });
}

function callOllama(host, model, prompt) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify({ model, prompt, stream: false, options: { temperature: 0.0, num_predict: 2048 } });
        const url = new URL(`${host.replace(/\/$/, '')}/api/generate`);
        const lib = url.protocol === 'https:' ? https : http;
        const req = lib.request({
            hostname: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
            timeout: 120000
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve(JSON.parse(data).response || ''); }
                catch (e) { reject(new Error(`Parse error: ${data.slice(0, 200)}`)); }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
        req.write(payload);
        req.end();
    });
}

function extractJSON(text) {
    const start = text.indexOf('{'); const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) return null;
    try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
}

// ─── DISPLAY ──────────────────────────────────────────────────────────────────
function sep(label = '') {
    console.log('\n' + '─'.repeat(70));
    if (label) console.log(`  ${label}`);
}

function printResult(ticketId, aiResult, elapsed) {
    if (!aiResult || !aiResult.categoryClassification) {
        console.log(`  ⚠️  AI Output     : Failed to parse JSON or invalid format`);
        return;
    }

    const { primaryCategory, confidence, reasoning, contributingFactors, delayBreakdown } = aiResult.categoryClassification;

    console.log(`  📌 Category      : ${primaryCategory}`);
    console.log(`  🎯 Confidence    : ${confidence}`);
    console.log(`  🔍 Reasoning     : ${reasoning}`);
    if (contributingFactors && contributingFactors.length > 0) {
        console.log(`  ➕ Contributing  : ${contributingFactors.join(', ')}`);
    }
    console.log(`  ⏱  Delay Break.  : ${delayBreakdown}`);
    console.log(`  ⌛ Time          : ${elapsed}s`);
}


// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
    sep(`JDA CATEGORY CLASSIFICATION — CSV TEST`);
    console.log(`  File       : ${path.resolve(CSV_FILE)}`);
    console.log(`  Ollama     : ${OLLAMA_HOST}`);

    // Auto-detect model
    let MODEL = MODEL_OVERRIDE;
    if (!MODEL) {
        console.log(`\n  Detecting available model...`);
        MODEL = await getAvailableModel(OLLAMA_HOST);
        if (!MODEL) {
            console.error(`  ❌ Could not detect model. Is Ollama running at ${OLLAMA_HOST}?`);
            process.exit(1);
        }
    }
    console.log(`  Model      : ${MODEL}`);

    // Parse CSV
    let rows;
    try { rows = parseCSV(CSV_FILE); }
    catch (e) { console.error(`\n❌ Failed to read CSV: ${e.message}`); process.exit(1); }

    const tickets = groupByTicket(rows);
    const ticketIds = TICKET_FILTER || Object.keys(tickets);

    console.log(`\n  Tickets found in CSV : ${Object.keys(tickets).length}`);
    console.log(`  Tickets to process   : ${ticketIds.length}`);

    // Summary table
    const summary = [];

    for (const id of ticketIds) {
        const ticket = tickets[id];
        if (!ticket) { console.log(`\n  ⚠️  Ticket "${id}" not found in CSV`); continue; }

        const conversationHistory = buildConversationHistory(ticket);
        if (!conversationHistory.trim()) {
            console.log(`\n  ⚠️  Ticket "${id}" has no remarks — skipping`);
            continue;
        }

        // Pass a proxy document array to prompt 
        const extractedDocs = codeScanner(conversationHistory);
        const docsString = extractedDocs.length > 0 ? `[${extractedDocs.join(', ')}]` : '[] (None)';

        sep(`TICKET: ${id} | ${ticket.service}`);
        console.log(`\nConversation:\n${conversationHistory}\n`);
        console.log(`Extracted Docs: ${docsString}\n`);

        const prompt = CATEGORY_CLASSIFICATION_PROMPT
            .replace('{{ticketId}}', id)
            .replace('{{flowType}}', ticket.service)
            .replace('{{conversationHistory}}', conversationHistory)
            .replace('{{documentsExtracted}}', docsString);

        let rawResponse = '';
        const start = Date.now();
        try {
            rawResponse = await callOllama(OLLAMA_HOST, MODEL, prompt);
        } catch (e) {
            console.log(`  ❌ Ollama error: ${e.message}`);
            summary.push({ id, category: 'ERROR', confidence: '-' });
            continue;
        }
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);

        const parsed = extractJSON(rawResponse);

        sep(`RESULT — Ticket ${id}`);
        console.log(`  📋 Ticket        : ${id}`);
        printResult(id, parsed, elapsed);

        summary.push({
            id,
            category: parsed?.categoryClassification?.primaryCategory || 'Parse Error',
            confidence: parsed?.categoryClassification?.confidence || '-',
            elapsed
        });
    }

    // Final summary table
    sep(`SUMMARY — All Processed Tickets`);
    console.log();
    const col = (s, n) => String(s).padEnd(n);
    console.log(`  ${col('Ticket ID', 18)} ${col('Category', 50)} ${col('Confidence', 10)}`);
    console.log(`  ${'─'.repeat(80)}`);
    for (const s of summary) {
        console.log(`  ${col(s.id, 18)} ${col(s.category, 50)} ${col(s.confidence, 10)}`);
    }
    console.log();
}

main().catch(e => { console.error(`\n❌ Fatal error:`, e); process.exit(1); });
