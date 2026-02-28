#!/usr/bin/env node
/**
 * JDA Document Extraction — CSV Test Script
 *
 * Usage:
 *   node test-doc-extraction.cjs <path-to-csv>
 *   node test-doc-extraction.cjs data.csv --host http://52.66.67.51:11434
 *   node test-doc-extraction.cjs data.csv --model llama3.2:3b
 *   node test-doc-extraction.cjs data.csv --tickets 67523465,10399  (run only these)
 *
 * CSV must be tab-separated with headers:
 *   Ticket ID, LifeTimeRemarks, LifeTimeRemarksFrom, Employee Name,
 *   ServiceName, LifeTimeEventStampDate, ...
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ─── CLI ARGS ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const CSV_FILE = args.find(a => !a.startsWith('--') && a.endsWith('.csv') || (!a.startsWith('--') && fs.existsSync(a)));
const getArg = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };

const OLLAMA_HOST = getArg('--host') || 'http://52.66.67.51:11434';
const MODEL_OVERRIDE = getArg('--model');
const TICKET_FILTER = getArg('--tickets') ? getArg('--tickets').split(',') : null;
const DEBUG = args.includes('--debug');

if (!CSV_FILE || !fs.existsSync(CSV_FILE)) {
    console.error(`\nUsage: node test-doc-extraction.cjs <path-to-csv> [options]`);
    console.error(`  --host   <url>      Ollama host (default: http://localhost:11434)`);
    console.error(`  --model  <name>     Model name (default: auto-detected)`);
    console.error(`  --tickets <ids>     Comma-separated ticket IDs to run (default: all)`);
    process.exit(1);
}

// ─── PROMPT (Simple Evidence-Quote — works with llama3.2:3b) ─────────────────
// Key insight: small models work fine when asked to ONLY list what they found
// with a quote. Asking them to fill a 19-field JSON template causes them to skip quotes.
const PROMPT_TEMPLATE = `You are checking a government ticket conversation for document REQUESTS.

Ticket: {{ticketId}} | Service: {{flowType}}

CONVERSATION:
{{conversationHistory}}

---
TASK: Find documents that were EXPLICITLY REQUESTED by an employee OR CONFIRMED SUBMITTED by the applicant.

DOCUMENTS TO LOOK FOR:
Pan Card, पैन कार्ड | Aadhar Card, आधार, आधार कार्ड | Passport, पासपोर्ट | Voter ID, वोटर कार्ड | Ration Card, राशन कार्ड | Site Plan, साइट प्लान | Sale Deed, विक्रय पत्र | Lease Deed, लीजडीड, पट्टा | License Deed, लाईसेन्स डीड | Affidavit, शपथ पत्र | Death Certificate, मृत्यु प्रमाण पत्र | Marriage Certificate, विवाह प्रमाण पत्र | Birth Certificate, जन्म प्रमाण पत्र | Challan, चालान | Demand Note, डिमांड नोट | Bank NOC, बैंक एनओसी | Income Certificate, आय प्रमाण पत्र | Electricity Bill, बिजली बिल, light bill | Water Bill, पानी बिल

VALID — extract these:
✓ Employee requests: "Please submit Challan" / "कृपया आधार कार्ड जमा करें" → extract
✓ Notification to applicant saying submit X → extract
✓ Applicant confirms: "I submitted Pan Card" / "मैंने चालान जमा कर दिया" → extract

DO NOT EXTRACT — these are NOT document requests:
✗ Applicant ASKS about documents: "चालान की राशि क्या है?" → NO (question, not a request)
✗ Employee notes non-response: "applicant has not uploaded aadhar card" → NO (observation, not a request)
✗ Vague: "submit original documents" / "मूल दस्तावेज़ जमा करें" → NO (no specific document named)
✗ Internal notes between employees without applicant involvement → NO
✗ Document name only in service/ticket title → NO

QUOTE RULE: Provide the EXACT sentence from the conversation proving the request. No paraphrasing.

Return JSON (only documents with confirmed requests/submissions):
{
  "found": [
    { "document": "Challan", "quote": "pls submit challan of amount 5041" }
  ],
  "submission_confirmed": false,
  "submission_text": null
}

If NO explicit document requests found: { "found": [], "submission_confirmed": false, "submission_text": null }`;


// ─── QUOTE VERIFIER ───────────────────────────────────────────────────────────
function verifyWithQuotes(aiResult, conversationHistory) {
    if (!aiResult?.found) return { verified: [], rejected: [] };

    const convLower = conversationHistory.toLowerCase();
    const verified = [];
    const rejected = [];

    for (const item of aiResult.found) {
        const docName = item.document;
        const quote = item.quote;

        if (!quote) {
            rejected.push({ doc: docName, reason: 'no quote provided' });
            continue;
        }

        // Fuzzy match: Needs ~40% of the quote's words to exist in text
        const quoteWords = quote.toLowerCase()
            .replace(/[^a-z0-9\u0900-\u097F\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 2);

        if (quoteWords.length === 0) {
            verified.push(docName);
            continue;
        }

        const txtLower = convLower.replace(/[^a-z0-9\u0900-\u097F\s]/g, ' ');
        let matchCount = 0;
        for (const w of quoteWords) {
            if (txtLower.includes(` ${w} `) || txtLower.startsWith(`${w} `) || txtLower.endsWith(` ${w}`) || txtLower === w) {
                matchCount++;
            } else if (txtLower.includes(w)) {
                matchCount += 0.5;
            }
        }

        if ((matchCount / quoteWords.length) >= 0.4) {
            verified.push(docName);
        } else {
            rejected.push({ doc: docName, reason: `fabricated quote: "${quote.slice(0, 60)}" (match: ${(matchCount / quoteWords.length).toFixed(2)})` });
        }
    }

    return { verified, rejected };
}

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
    // Column mapping (confirmed from CSV structure):
    //   LifeTimeRemarks     = short label/type tag ("notification sent to applicant", "Reply from Applicant")
    //   LifeTimeRemarksFrom = ACTUAL full remark text (quoted in CSV as it contains commas)
    const lines = [];
    for (const row of ticketData.rows) {
        const label = (row['LifeTimeRemarks'] || '').trim();       // short tag → used for speaker detection
        const remark = (row['LifeTimeRemarksFrom'] || '').trim();   // full text → ACTUAL CONTENT
        const empName = (row['Employee Name'] || '').trim();
        const post = (row['Post'] || '').trim();
        const date = (row['LifeTimeEventStampDate'] || '').trim();

        if (!remark || remark === 'NULL' || remark === '') continue;

        // Detect who is speaking
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


// ─── DETERMINISTIC CODE SCANNER (100% trustworthy, no AI) ────────────────────
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
        // Check normal substring aliases
        if (doc.aliases.some(a => lower.includes(a.toLowerCase()))) return true;
        // Check word-boundary aliases (short terms like 'pan', 'adhar')
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
                    // Prefer 8b variants, then 3b
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

function printResult(ticketId, aiResult, codeScanned, conversationHistory, elapsed) {
    const codeStr = codeScanned.length ? codeScanned.join(', ') : '(none)';
    console.log(`  🔍 Code Scanner  : ${codeStr}`);

    if (!aiResult) {
        // AI parse failed — fall back to code scanner only
        console.log(`  ⚠️  AI Output     : Failed to parse JSON — using code scanner only`);
        console.log(`  🏆 FINAL DOCS    : ${codeStr}  ← code scanner fallback`);
        return { finalUnion: codeScanned, submission: false };
    }

    // ── Quote Verifier (AI + code hybrid) ──
    const { verified, rejected } = verifyWithQuotes(aiResult, conversationHistory);
    const verifiedStr = verified.length ? verified.join(', ') : '(none)';
    console.log(`  ✅ Quote-Verified : ${verifiedStr}`);

    if (rejected.length) {
        console.log(`  ❌ Quote-Rejected :`);
        rejected.forEach(r => console.log(`       • ${r.doc} — ${r.reason}`));
    }

    // AI extra = quote-verified docs NOT in code scanner (e.g., "light bill" → Electricity Bill)
    const extra = verified.filter(d => !codeScanned.includes(d));
    if (extra.length) console.log(`  ℹ️   AI extra      : ${extra.join(', ')} ← quote verified, informal alias`);

    // FINAL DOCS STRATEGY:
    // - AI parsed successfully (even empty []) → trust AI context-awareness as filter
    //   → FINAL = code scanner docs that AI also verified + any AI-quota extras
    // - This ensures "applicant has not uploaded aadhar card" (observation) is excluded
    //   while "please submit aadhar card" (request) is included
    const aiVerifiedSet = new Set(verified);
    const codeConfirmedByAI = codeScanned.filter(d => aiVerifiedSet.has(d));

    // FINAL DOCS STRATEGY:
    // Use VERIFIED count (real quotes confirmed) — not raw AI claimed count.
    // If AI found something but ALL quotes were fabricated → treated as "no explicit requests".
    // Only add raw code scanner hits when AI quote-verified at least one real request.
    const finalUnion = verified.length > 0
        ? [...new Set([...codeConfirmedByAI, ...extra, ...codeScanned])]  // Active request: add code scanner
        : [...new Set([...extra])];                                         // No verified requests: empty

    const matchIcon = finalUnion.length === 0 && codeScanned.length === 0 ? '🎉' :
        finalUnion.length === codeScanned.length ? '✅' : '⚠️ ';
    console.log(`  🏆 FINAL DOCS    : ${finalUnion.join(', ') || '(none)'}  ← context-aware result`);

    const aiFound = (aiResult.found || []).map(f => f.document);
    if (aiFound.length !== finalUnion.length) {
        console.log(`  🤖 AI Raw Claimed: ${aiFound.join(', ') || '(none)'}`);
    }
    console.log(`  📤 Submission    : ${aiResult.submission_confirmed ? `Confirmed — "${aiResult.submission_text}"` : 'Not confirmed'}`);
    console.log(`  ⏱  Time          : ${elapsed}s`);
    return { finalUnion, submission: aiResult.submission_confirmed };
}


// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
    sep(`JDA DOCUMENT EXTRACTION — CSV TEST`);
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

        sep(`TICKET: ${id} | ${ticket.service}`);
        console.log(`\nConversation:\n${conversationHistory}\n`);

        const prompt = PROMPT_TEMPLATE
            .replace('{{ticketId}}', id)
            .replace('{{flowType}}', ticket.service)
            .replace('{{conversationHistory}}', conversationHistory);

        let rawResponse = '';
        const start = Date.now();
        try {
            rawResponse = await callOllama(OLLAMA_HOST, MODEL, prompt);
        } catch (e) {
            console.log(`  ❌ Ollama error: ${e.message}`);
            summary.push({ id, docs: 'ERROR', confidence: '-', clarity: '-', submission: '-' });
            continue;
        }
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);

        const parsed = extractJSON(rawResponse);
        const codeScanned = codeScanner(conversationHistory);
        const { verified } = verifyWithQuotes(parsed, conversationHistory);

        sep(`RESULT — Ticket ${id}`);
        console.log(`  📋 Ticket        : ${id}`);
        printResult(id, parsed, codeScanned, conversationHistory, elapsed);

        summary.push({
            id,
            codeDocs: codeScanned.join(', ') || '(none)',
            verified: verified.join(', ') || '(none)',
            submission: parsed?.submissionConfirmed ? 'Yes' : 'No',
            elapsed
        });
    }

    // Final summary table
    sep(`SUMMARY — All Processed Tickets`);
    console.log();
    const col = (s, n) => String(s).padEnd(n);
    console.log(`  ${col('Ticket ID', 18)} ${col('Code Scanner', 28)} ${col('Quote-Verified', 28)} Sub`);
    console.log(`  ${'─'.repeat(85)}`);
    for (const r of summary) {
        const match = r.codeDocs === r.verified ? '✅' : '⚠️ ';
        console.log(`  ${col(r.id, 18)} ${col(r.codeDocs, 28)} ${match} ${col(r.verified, 26)} ${r.submission}`);
    }
    console.log();
}

main().catch(e => { console.error(e); process.exit(1); });
