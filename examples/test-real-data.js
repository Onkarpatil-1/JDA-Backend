#!/usr/bin/env node
/**
 * Test Ollama SLA Backend with Real Data
 * Uses actual government ticket data for testing
 */

const API_BASE = 'http://localhost:3001/api/v1';

// Real data from analysis
const realData = {
    // Anomaly: User_170 had 302 days delay
    anomalyCase: {
        current: {
            timestamp: '2026-01-22T00:00:00Z',
            value: 302,
            metricName: 'Days Rested (Ticket Processing Time)',
        },
        historical: {
            metricName: 'Days Rested (Ticket Processing Time)',
            values: [0, 1, 4, 6, 0, 3, 5, 0, 1, 2, 3, 0, 4, 1],
            timestamps: [
                '2026-01-08', '2026-01-09', '2026-01-10', '2026-01-11',
                '2026-01-12', '2026-01-13', '2026-01-14', '2026-01-15',
                '2026-01-16', '2026-01-17', '2026-01-18', '2026-01-19',
                '2026-01-20', '2026-01-21'
            ],
            unit: 'days',
        },
    },

    // Prediction: RAKU employee workload trend
    predictionCase: {
        historical: {
            metricName: 'RAKU Employee Task Count',
            values: [5, 6, 7, 8, 6, 9, 10, 8, 11, 12, 10, 13, 14, 15],
            timestamps: [
                '2026-01-08', '2026-01-09', '2026-01-10', '2026-01-11',
                '2026-01-12', '2026-01-13', '2026-01-14', '2026-01-15',
                '2026-01-16', '2026-01-17', '2026-01-18', '2026-01-19',
                '2026-01-20', '2026-01-21'
            ],
            unit: 'tasks',
        },
        horizonDays: 3,
    },

    // Alert: Bottleneck at APPLICANT role
    alertCase: {
        metricName: 'APPLICANT Role Processing Time',
        currentValue: 37.8,
        threshold: 5.0,
        severity: 'CRITICAL',
        context: 'Major bottleneck detected: APPLICANT role has 44 cases with average 37.8 days delay',
    },

    // Query: Understanding completion rate
    queryCase: {
        question: 'We have a 90% completion rate with 9 out of 10 tickets completed. Is this good for government SLA services?',
        context: {
            total_tickets: 10,
            completed_tickets: 9,
            avg_processing_time: 3.16,
            max_delay: 302,
        },
    },
};

async function testAnomalyDetection() {
    console.log('\n🔍 Test 1: Anomaly Detection (Real Data - 302 Days Delay)\n');

    try {
        const response = await fetch(`${API_BASE}/anomaly/detect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(realData.anomalyCase),
        });

        const result = await response.json();
        console.log('✅ Result:');
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

async function testPrediction() {
    console.log('\n📈 Test 2: Workload Prediction (RAKU Employee)\n');

    try {
        const response = await fetch(`${API_BASE}/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(realData.predictionCase),
        });

        const result = await response.json();
        console.log('✅ Result:');
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

async function testAlertGeneration() {
    console.log('\n🚨 Test 3: Alert Generation (APPLICANT Bottleneck)\n');

    try {
        const response = await fetch(`${API_BASE}/alert/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(realData.alertCase),
        });

        const result = await response.json();
        console.log('✅ Result:');
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

async function testQuery() {
    console.log('\n💬 Test 4: General Query (Completion Rate Analysis)\n');

    try {
        const response = await fetch(`${API_BASE}/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(realData.queryCase),
        });

        const result = await response.json();
        console.log('✅ Result:');
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

async function runAllTests() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  Testing Ollama SLA Backend with Real Government Data');
    console.log('═══════════════════════════════════════════════════════');

    try {
        // Check health
        const health = await fetch(`${API_BASE}/health`);
        const healthData = await health.json();

        if (healthData.status !== 'healthy') {
            console.error('\n❌ Backend is not healthy:', healthData.message);
            console.error('Make sure the Ollama backend is running: npm run dev');
            return;
        }

        console.log('\n✅ Backend is healthy\n');

        // Run all tests
        await testAnomalyDetection();
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait between tests

        await testPrediction();
        await new Promise(resolve => setTimeout(resolve, 2000));

        await testAlertGeneration();
        await new Promise(resolve => setTimeout(resolve, 2000));

        await testQuery();

        console.log('\n═══════════════════════════════════════════════════════');
        console.log('  ✅ All tests completed successfully!');
        console.log('═══════════════════════════════════════════════════════\n');
    } catch (error) {
        console.error('\n❌ Test suite failed:', error.message);
        console.error('Make sure the Ollama backend is running on port 3001');
    }
}

// Run tests
runAllTests();
