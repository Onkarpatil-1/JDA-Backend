# Ollama SLA Backend

A Node.js backend wrapper for Ollama LLM with specialized capabilities for SLA monitoring, anomaly detection, and predictive analytics.

## 🚀 Features

- **Anomaly Detection**: Statistical analysis with LLM-powered explanations
- **Predictive Analytics**: Time-series forecasting for SLA metrics
- **Alert Generation**: Intelligent, actionable alert messages
- **General Query Interface**: Ask questions about your SLA data
- **RESTful API**: Easy integration with any frontend
- **TypeScript**: Full type safety and IntelliSense support

## 📋 Prerequisites

- Node.js 18+ 
- Ollama installed and running
- Llama 3.2 3B model (or any other Ollama model)

## 🛠️ Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Configure environment:**
```bash
cp .env.example .env
```

Edit `.env` with your settings:
```env
PORT=3001
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
CORS_ORIGIN=http://localhost:5173
```

3. **Ensure Ollama is running:**
```bash
# Start Ollama (if not already running)
ollama serve

# Verify model is installed
ollama list
```

## 🏃 Running the Server

**Development mode (with hot reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm run build
npm start
```

The server will start on `http://localhost:3001`

## 📡 API Endpoints

### Health Check
```bash
GET /api/v1/health
```

### Anomaly Detection
```bash
POST /api/v1/anomaly/detect
Content-Type: application/json

{
  "current": {
    "timestamp": "2026-02-06T18:00:00Z",
    "value": 2.5,
    "metricName": "Response Time (seconds)"
  },
  "historical": {
    "metricName": "Response Time (seconds)",
    "values": [1.1, 1.3, 1.2, 1.4, 1.1, 1.3, 1.2],
    "timestamps": ["2026-01-30", "2026-01-31", "2026-02-01", "2026-02-02", "2026-02-03", "2026-02-04", "2026-02-05"],
    "unit": "seconds"
  }
}
```

**Response:**
```json
{
  "isAnomaly": true,
  "severity": "CRITICAL",
  "score": 95,
  "explanation": "Response time is 4.33 standard deviations above normal",
  "confidence": 0.95,
  "detectedAt": "2026-02-06T18:00:00Z",
  "metadata": {
    "zScore": 4.33,
    "threshold": 2,
    "historicalMean": 1.23,
    "historicalStdDev": 0.30
  }
}
```

### Prediction
```bash
POST /api/v1/predict
Content-Type: application/json

{
  "historical": {
    "metricName": "Ticket Volume",
    "values": [200, 210, 195, 220, 215, 230, 225, 240, 235, 250, 245, 260, 255, 270],
    "timestamps": ["2026-01-24", "2026-01-25", "...", "2026-02-06"],
    "unit": "tickets"
  },
  "horizonDays": 3
}
```

**Response:**
```json
{
  "predictions": [
    {
      "timestamp": "2026-02-07",
      "predictedValue": 275,
      "confidence": 0.85
    },
    {
      "timestamp": "2026-02-08",
      "predictedValue": 280,
      "confidence": 0.75
    },
    {
      "timestamp": "2026-02-09",
      "predictedValue": 285,
      "confidence": 0.65
    }
  ],
  "trend": "INCREASING",
  "explanation": "Consistent upward trend observed over the past 14 days",
  "modelUsed": "Statistical trend analysis with LLM reasoning"
}
```

### Alert Generation
```bash
POST /api/v1/alert/generate
Content-Type: application/json

{
  "metricName": "API Success Rate",
  "currentValue": 87,
  "threshold": 98,
  "severity": "CRITICAL",
  "context": "Payment processing endpoint"
}
```

**Response:**
```json
{
  "message": "API Success Rate dropped to 87% (11% below threshold)",
  "recommendation": "Check payment processing endpoint logs, verify database connections, and consider rolling back recent deployments",
  "urgency": "HIGH"
}
```

### General Query
```bash
POST /api/v1/query
Content-Type: application/json

{
  "question": "What does a z-score of 3.5 mean for response time metrics?",
  "context": {
    "metricType": "response_time",
    "unit": "seconds"
  }
}
```

**Response:**
```json
{
  "answer": "A z-score of 3.5 indicates the response time is 3.5 standard deviations above the mean, which is highly unusual (99.95th percentile). This suggests a critical performance issue requiring immediate investigation."
}
```

### Model Info
```bash
GET /api/v1/model/info
```

## 🧪 Testing with cURL

```bash
# Health check
curl http://localhost:3001/api/v1/health

# Anomaly detection
curl -X POST http://localhost:3001/api/v1/anomaly/detect \
  -H "Content-Type: application/json" \
  -d '{
    "current": {"timestamp": "2026-02-06T18:00:00Z", "value": 2.5, "metricName": "Response Time"},
    "historical": {"metricName": "Response Time", "values": [1.1, 1.3, 1.2, 1.4, 1.1], "timestamps": ["2026-02-01", "2026-02-02", "2026-02-03", "2026-02-04", "2026-02-05"]}
  }'
```

## 🏗️ Project Structure

```
ollama-sla-backend/
├── src/
│   ├── api/
│   │   └── routes.ts           # Express API routes
│   ├── services/
│   │   ├── OllamaService.ts    # Ollama LLM wrapper
│   │   └── SLAIntelligenceService.ts  # Main SLA logic
│   ├── prompts/
│   │   ├── anomalyDetection.ts # Anomaly detection prompts
│   │   ├── prediction.ts       # Prediction prompts
│   │   └── alerts.ts           # Alert generation prompts
│   ├── types/
│   │   └── index.ts            # TypeScript type definitions
│   └── index.ts                # Server entry point
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## 🔧 Configuration

All configuration is done via environment variables in `.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | Server port |
| `OLLAMA_HOST` | http://localhost:11434 | Ollama server URL |
| `OLLAMA_MODEL` | llama3.2:3b | Model to use |
| `CORS_ORIGIN` | http://localhost:5173 | Allowed CORS origin |
| `API_PREFIX` | /api/v1 | API route prefix |

## 🎯 Use Cases

1. **Real-time SLA Monitoring**: Detect anomalies in response times, error rates, uptime
2. **Predictive Maintenance**: Forecast when SLAs might be breached
3. **Intelligent Alerting**: Generate context-aware alerts with actionable recommendations
4. **Data Analysis**: Ask natural language questions about your metrics

## 🚦 Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error description",
  "details": "Additional error details"
}
```

HTTP status codes:
- `200`: Success
- `400`: Bad request (missing/invalid parameters)
- `500`: Server error (Ollama unavailable, parsing error, etc.)

## 📝 Notes

- The LLM uses low temperature (0.2-0.4) for consistent, deterministic outputs
- All responses are in JSON format for easy parsing
- Statistical calculations (z-score, trend) are done before LLM processing for accuracy
- The system is designed to be conservative with severity classifications

## 🤝 Integration Example

```typescript
// Frontend integration example
async function detectAnomaly(current, historical) {
  const response = await fetch('http://localhost:3001/api/v1/anomaly/detect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ current, historical })
  });
  
  return await response.json();
}
```

## 📄 License

MIT
