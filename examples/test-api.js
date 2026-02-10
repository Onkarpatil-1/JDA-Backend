// Example: Testing the Ollama SLA Backend API

const API_BASE = 'http://localhost:3001/api/v1';

// Example 1: Anomaly Detection
async function testAnomalyDetection() {
    console.log('\n🔍 Testing Anomaly Detection...\n');

    const response = await fetch(`${API_BASE}/anomaly/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            current: {
                timestamp: '2026-02-06T18:00:00Z',
                value: 2.5,
                metricName: 'Response Time (seconds)',
            },
            historical: {
                metricName: 'Response Time (seconds)',
                values: [1.1, 1.3, 1.2, 1.4, 1.1, 1.3, 1.2, 1.1, 1.2, 1.3],
                timestamps: [
                    '2026-01-28', '2026-01-29', '2026-01-30', '2026-01-31',
                    '2026-02-01', '2026-02-02', '2026-02-03', '2026-02-04',
                    '2026-02-05', '2026-02-06'
                ],
                unit: 'seconds',
            },
        }),
    });

    const result = await response.json();
    console.log('Anomaly Detection Result:');
    console.log(JSON.stringify(result, null, 2));
}

// Example 2: Prediction
async function testPrediction() {
    console.log('\n📈 Testing Prediction...\n');

    const response = await fetch(`${API_BASE}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            historical: {
                metricName: 'Ticket Volume',
                values: [200, 210, 195, 220, 215, 230, 225, 240, 235, 250, 245, 260, 255, 270],
                timestamps: [
                    '2026-01-24', '2026-01-25', '2026-01-26', '2026-01-27',
                    '2026-01-28', '2026-01-29', '2026-01-30', '2026-01-31',
                    '2026-02-01', '2026-02-02', '2026-02-03', '2026-02-04',
                    '2026-02-05', '2026-02-06'
                ],
                unit: 'tickets',
            },
            horizonDays: 3,
        }),
    });

    const result = await response.json();
    console.log('Prediction Result:');
    console.log(JSON.stringify(result, null, 2));
}

// Example 3: Alert Generation
async function testAlertGeneration() {
    console.log('\n🚨 Testing Alert Generation...\n');

    const response = await fetch(`${API_BASE}/alert/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            metricName: 'API Success Rate',
            currentValue: 87,
            threshold: 98,
            severity: 'CRITICAL',
            context: 'Payment processing endpoint experiencing high failure rate',
        }),
    });

    const result = await response.json();
    console.log('Alert Generation Result:');
    console.log(JSON.stringify(result, null, 2));
}

// Example 4: General Query
async function testQuery() {
    console.log('\n💬 Testing General Query...\n');

    const response = await fetch(`${API_BASE}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            question: 'What does a z-score of 3.5 mean for response time metrics?',
            context: {
                metricType: 'response_time',
                unit: 'seconds',
            },
        }),
    });

    const result = await response.json();
    console.log('Query Result:');
    console.log(JSON.stringify(result, null, 2));
}

// Run all tests
async function runAllTests() {
    try {
        // Check health first
        console.log('🏥 Checking API health...\n');
        const health = await fetch(`${API_BASE}/health`);
        const healthData = await health.json();
        console.log('Health Check:', healthData);

        if (healthData.status !== 'healthy') {
            console.error('❌ API is not healthy. Aborting tests.');
            return;
        }

        // Run tests
        await testAnomalyDetection();
        await testPrediction();
        await testAlertGeneration();
        await testQuery();

        console.log('\n✅ All tests completed!\n');
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Make sure the server is running: npm run dev');
    }
}

// Run tests
runAllTests();
