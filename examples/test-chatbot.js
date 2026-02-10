#!/usr/bin/env node
/**
 * Quick test for chatbot integration
 */

const API_BASE = 'http://localhost:3001/api/v1';

async function testChatbotQuery() {
    console.log('🤖 Testing Chatbot Query Integration\n');

    const testQueries = [
        "What is the average processing time for government tickets?",
        "Which department has the highest workload?",
        "How can I identify bottlenecks in ticket processing?"
    ];

    for (const question of testQueries) {
        console.log(`\n📝 Question: "${question}"`);

        try {
            const response = await fetch(`${API_BASE}/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    question,
                    context: {
                        system: 'Government SLA Intelligence System',
                        data_source: 'Real ticket workflow data',
                        capabilities: [
                            'Anomaly detection in processing times',
                            'Workload prediction',
                            'Bottleneck identification',
                            'SLA compliance analysis'
                        ]
                    }
                })
            });

            const data = await response.json();
            console.log(`\n✅ Answer:\n${data.answer.substring(0, 200)}...\n`);

            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
            console.error('❌ Error:', error.message);
        }
    }
}

testChatbotQuery();
