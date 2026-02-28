#!/usr/bin/env node
/**
 * Document Extraction Prompt Test Script
 * Tests DOCUMENT_EXTRACTION_PROMPT against Ollama llama3:8b
 *
 * Usage:
 *   node test-doc-extraction.js                  # uses localhost:11434
 *   node test-doc-extraction.js --host http://52.66.67.51:11434
 *   node test-doc-extraction.js --case negative  # test with no-doc conversation
 */

const http = require('http');
const https = require('https');

// ─── CONFIG ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const hostArg = args.indexOf('--host');
const OLLAMA_HOST = hostArg !== -1 ? args[hostArg + 1] : 'http://52.66.67.51:11434';
const MODEL = 'llama3:8b';
const CASE = args.includes('--case') ? args[args.indexOf('--case') + 1] : 'positive';

// ─── TEST DATA ──────────────────────────────────────────────────────────────

// POSITIVE CASE: Aadhar Card, Pan Card, Challan explicitly mentioned
const POSITIVE_CONVERSATION = `
[12/3/2025] Employee (Amit - Dealing Assistant): Notification sent to applicant : कृपया 5041 रुपये का चालान, आधार कार्ड और पैन कार्ड प्रस्तुत करें।
[12/4/2025] Employee (Akshay - Junior Engineer): Notification sent to applicant : pls submit challan of amount 5041 along with aadhar card and pan card
[12/8/2025] Applicant: Reply from Applicant : मैंने चालान नंबर 37842 और पैन कार्ड  जमा कर दिए हैं।
[12/8/2025] Employee (Amit - Dealing Assistant): Notification sent to applicant : कृपया आधार कार्ड प्रस्तुत करें।
[12/9/2025] Employee (Ajinkya - Accountant): Applicant has not responsed within 7 days
[12/10/2025] Employee (Anant - Assistant Town Planner): case closed
`.trim();

// NEGATIVE CASE: Only vague phrases, no specific documents
const NEGATIVE_CONVERSATION = `
[12/3/2025] Employee (Amit - Dealing Assistant): Notification sent to applicant : कृपया राशि जमा करें और मूल दस्तावेज प्रस्तुत करें।
[12/4/2025] Employee (Akshay - Junior Engineer): Notification sent to applicant : Please deposit amount and submit original documents
[12/8/2025] Applicant: Reply from Applicant : कृपया बताने की कृपा करें कि चालान की राशि क्या है? और मुझे कौन-कौन से दस्तावेज़ प्रस्तुत करने हैं?
[12/9/2025] Employee (Amit - Dealing Assistant): Notification sent to applicant : कृपया मूल दस्तावेज प्रस्तुत करें।
[12/10/2025] Employee (Ajinkya - Accountant): Applicant has not responsed and documents within 14 days
[12/11/2025] Employee (Anant - Assistant Town Planner): case closed
`.trim();

// OTLC CASE (ticket 10399 - financial recalculation case)
const OTLC_CONVERSATION = `
[26-12-2025] Employee (SHOSH - Dealing Assistant): Please check and report in detail.
[29-12-2025] Employee (GOUPO - Tehsildar): आवेदन के साथ आवंटन पत्र, लाईसेन्स डीड, वाद विवाद का शपथ पत्र इत्यादि अपलोड किये गये है।
[2/1/2026] Employee (SHOSH - Dealing Assistant): प्रकरण में वाद विवाद का शपथ पत्र संलग्न करावे।
[5/1/2026] Employee (SURBH - Accountant): पत्रावली अग्रिम कार्यवाही हेतु प्रस्तुत है।
[12/1/2026] Employee (SANGO - Deputy Commissioner): पूर्व में लीज के जमा चालानो की प्रति अपलोड करने हेतु आवेदक को हेतु सूचित किया जाना प्रस्तावित हे
[14/1/2026] Applicant: Notification sent to applicant : पूर्व में लीज के जमा चालानो की प्रति अपलोड करे।
[14/1/2026] Employee (SANGO - Deputy Commissioner): Reply from Applicant: Demand details and payment details receipts dated 17/10/2019 are attached. At that time there was a govt scheme to deposit 10 times the lease and get one time lease certificate.
[6/2/2026] Applicant: Reply from Applicant: Please find enclosed Deposit Challan receipts of Rs 85532 and the deposit ledger of JDA Control no. 642603000041. Please issue one time lease certificate.
[9/2/2026] Employee (SANGO - Deputy Commissioner): आवेदक द्वारा पैरा 42/एन अनुसार पूर्ण राशि जमा करवाई जा चुकी है। प्रकरण में लीज मुक्ति प्रमाण पत्र जारी किये जाने हेतु पत्रावली सहायक लेखाधिकारी को भिजवाया जाना प्रस्तावित है।
[9/2/2026] Applicant: लीज मुक्ति प्रमाण पत्र डिजिटल साइन कर जारी किया गया, जिसकी प्रति प्रार्थी को ऑनलाइन प्रेषित कर आवेदन निस्तारित किया गया।
`.trim();

const CONVERSATIONS = {
    positive: { id: '67523465ABC', flow: 'Free Hold - Purchased from Original Allottee Through Sale Deed', text: POSITIVE_CONVERSATION },
    negative: { id: '67523465', flow: 'Free Hold - Purchased from Original Allottee Through Sale Deed', text: NEGATIVE_CONVERSATION },
    otlc: { id: '10399', flow: 'One Time Lease Certificate (OTLC)', text: OTLC_CONVERSATION },
};

// ─── PROMPT ────────────────────────────────────────────────────────────────
const DOCUMENT_EXTRACTION_PROMPT = `You are a document extraction specialist for the Jaipur Development Authority (JDA). Your ONLY job is to identify which documents were mentioned in the ticket conversation.

Ticket Context:
- Ticket ID: {{ticketId}}
- Service Type: {{flowType}}
Conversation History:
{{conversationHistory}}
---
TASK: Extract document names that were explicitly mentioned in the conversation.
---

RECOGNIZED DOCUMENTS (search for these exact terms):

**Identity Documents:**
- Pan Card / पैन कार्ड / pan card
- Aadhar Card / Aadhar / Aadhaar / आधार कार्ड / आधार
- Passport / पासपोर्ट / passport
- Voter ID / Voter Card / वोटर कार्ड / वोटर आईडी
- Ration Card / राशन कार्ड / ration card

**Property & Legal Documents:**
- E-Site Plan / E-Site Map / ई-साइट प्लान / ई-साइट मैप / ई-नक्शा
- Sale Deed / विक्रय पत्र / sale deed
- Lease Deed / Patta / लीजडीड / पट्टा / lease deed
- Registered Documents / पंजीकृत दस्तावेज़ / registered documents
- Affidavit / शपथ पत्र / affidavit

**Certificates:**
- Death Certificate / मृत्यु प्रमाण पत्र / death certificate
- Marriage Certificate / विवाह प्रमाण पत्र / marriage certificate
- Birth Certificate / जन्म प्रमाण पत्र / birth certificate

**Financial Documents:**
- Challan / चालान / challan / payment receipt
- Bank NOC / Bank Statement / बैंक एनओसी / bank noc / bank statement
- Income Certificate / आय प्रमाण पत्र / income certificate

**Utility Documents:**
- Electricity Bill / बिजली बिल / electricity bill / विद्युत बिल
- Water Bill / पानी बिल / water bill / जल बिल

---

EXTRACTION RULES:
1. ZERO HALLUCINATION: Return [] if not found. Never guess.
2. BILINGUAL SEARCH: Search both Hindi and English variants.
3. VAGUE PHRASES = EMPTY: "required documents", "मूल दस्तावेज़", "आवश्यक दस्तावेज़" → []
4. BASE NAMES ONLY: Remove qualifiers. "Challan number 12345" → "Challan"
5. SUBMISSION DETECTION: If applicant says "I submitted" / "मैंने जमा कर दिए" → submissionConfirmed: true
6. WHEN UNCERTAIN: Return []

OUTPUT FORMAT (return ONLY valid JSON):

{
  "documentExtraction": {
    "documentsRequested": ["array of extracted doc names, or []"],
    "documentClarityProvided": true or false,
    "vaguePhraseDetected": true or false,
    "vaguePhraseUsed": "quoted phrase or null",
    "submissionConfirmed": true or false,
    "submissionConfirmationText": "quoted text or null",
    "extractionConfidence": 0.0-1.0,
    "extractionNotes": "1-2 sentences"
  }
}

Now analyze the conversation and return the JSON output.`;

// ─── HELPERS ────────────────────────────────────────────────────────────────

function buildPrompt(ticketId, flowType, conversationHistory) {
    return DOCUMENT_EXTRACTION_PROMPT
        .replace('{{ticketId}}', ticketId)
        .replace('{{flowType}}', flowType)
        .replace('{{conversationHistory}}', conversationHistory);
}

function callOllama(host, model, prompt) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify({
            model,
            prompt,
            stream: false,
            options: { temperature: 0.0, num_predict: 1024 }
        });

        const url = new URL(`${host.replace(/\/$/, '')}/api/generate`);
        const lib = url.protocol === 'https:' ? https : http;

        const req = lib.request({
            hostname: url.hostname,
            port: url.port || (url.protocol === 'https:' ? 443 : 80),
            path: url.pathname,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
            timeout: 120000
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json.response || '');
                } catch (e) {
                    reject(new Error(`Failed to parse Ollama response: ${data.slice(0, 200)}`));
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out after 120s')); });
        req.write(payload);
        req.end();
    });
}

function extractJSON(text) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) return null;
    try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
}

function separator(label) {
    const line = '═'.repeat(70);
    console.log(`\n${line}`);
    if (label) console.log(`  ${label}`);
    console.log(line);
}

// ─── EXPECTED RESULTS ───────────────────────────────────────────────────────
const EXPECTED = {
    positive: { docs: ['Challan', 'Aadhar Card', 'Pan Card'], submissionConfirmed: true, vague: false },
    negative: { docs: [], submissionConfirmed: false, vague: true },
    otlc: { docs: ['Affidavit', 'Challan'], submissionConfirmed: true, vague: false },
};

function validate(result, expected, caseName) {
    const extraction = result?.documentExtraction;
    if (!extraction) return { pass: false, issues: ['No documentExtraction field in response'] };

    const issues = [];
    const pass_docs = JSON.stringify(extraction.documentsRequested?.sort()) === JSON.stringify(expected.docs.sort());
    if (!pass_docs) issues.push(`❌ Documents: got [${extraction.documentsRequested?.join(', ')}] expected [${expected.docs.join(', ')}]`);
    else console.log(`  ✅ Documents: [${extraction.documentsRequested?.join(', ')}]`);

    if (extraction.submissionConfirmed !== expected.submissionConfirmed)
        issues.push(`❌ submissionConfirmed: got ${extraction.submissionConfirmed}, expected ${expected.submissionConfirmed}`);
    else console.log(`  ✅ submissionConfirmed: ${extraction.submissionConfirmed}`);

    if (extraction.vaguePhraseDetected !== expected.vague)
        issues.push(`❌ vaguePhraseDetected: got ${extraction.vaguePhraseDetected}, expected ${expected.vague}`);
    else console.log(`  ✅ vaguePhraseDetected: ${extraction.vaguePhraseDetected}`);

    return { pass: issues.length === 0, issues };
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
    const testCase = CONVERSATIONS[CASE];
    if (!testCase) {
        console.error(`Unknown case "${CASE}". Use: positive | negative | otlc`);
        process.exit(1);
    }

    separator(`JDA DOCUMENT EXTRACTION TEST — Case: "${CASE}"`);
    console.log(`  Ticket ID  : ${testCase.id}`);
    console.log(`  Model      : ${MODEL}`);
    console.log(`  Ollama Host: ${OLLAMA_HOST}`);

    separator('CONVERSATION INPUT');
    console.log(testCase.text);

    const prompt = buildPrompt(testCase.id, testCase.flow, testCase.text);

    separator('CALLING OLLAMA...');
    const startMs = Date.now();
    let rawResponse;
    try {
        rawResponse = await callOllama(OLLAMA_HOST, MODEL, prompt);
    } catch (e) {
        console.error(`\n❌ Failed to reach Ollama at ${OLLAMA_HOST}`);
        console.error(`   ${e.message}`);
        console.error(`\nIs Ollama running? Try: ollama serve`);
        process.exit(1);
    }
    const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
    console.log(`  ⏱  Done in ${elapsed}s`);

    separator('RAW AI RESPONSE');
    console.log(rawResponse);

    const parsed = extractJSON(rawResponse);

    separator('PARSED RESULT');
    if (parsed) {
        console.log(JSON.stringify(parsed, null, 2));
    } else {
        console.log('⚠️  Could not parse JSON from response');
    }

    separator('VALIDATION vs EXPECTED');
    const expected = EXPECTED[CASE];
    console.log(`  Expected docs       : [${expected.docs.join(', ')}]`);
    console.log(`  Expected submission : ${expected.submissionConfirmed}`);
    console.log(`  Expected vague      : ${expected.vague}`);
    console.log();

    if (parsed) {
        const { pass, issues } = validate(parsed, expected, CASE);
        console.log();
        if (pass) {
            console.log('  🎉 ALL CHECKS PASSED');
        } else {
            console.log('  ⚠️  SOME CHECKS FAILED:');
            issues.forEach(i => console.log(`     ${i}`));
        }
    } else {
        console.log('  ❌ Cannot validate — JSON parse failed');
    }

    separator('');
}

main().catch(e => { console.error(e); process.exit(1); });
