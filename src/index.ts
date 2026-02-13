import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { OllamaService } from './services/OllamaService.js';
import { SLAIntelligenceService } from './services/SLAIntelligenceService.js';
import { ProjectService } from './services/ProjectService.js';
import { AIAnalysisService } from './services/AIAnalysisService.js';
import { createRouter } from './api/routes.js';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3001;
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
const API_PREFIX = process.env.API_PREFIX || '/api/v1';

async function startServer() {
    const app = express();

    // Middleware
    app.use(cors({ origin: CORS_ORIGIN }));
    app.use(express.json());

    // Initialize services
    const ollamaService = new OllamaService({
        host: OLLAMA_HOST,
        model: OLLAMA_MODEL,
    });

    const aiAnalysisService = new AIAnalysisService();
    const projectService = new ProjectService(aiAnalysisService);
    const slaService = new SLAIntelligenceService(ollamaService, projectService);

    // Health check for Ollama
    console.log('🔍 Checking Ollama connection...');
    const health = await ollamaService.healthCheck();
    console.log(`📊 Ollama Status: ${health.status}`);
    console.log(`📝 ${health.message}`);

    if (health.status === 'unhealthy') {
        console.error('❌ Ollama is not available. Please ensure:');
        console.error('   1. Ollama is running (ollama serve)');
        console.error(`   2. Model ${OLLAMA_MODEL} is installed (ollama pull ${OLLAMA_MODEL})`);
        console.error('   3. Ollama is accessible at', OLLAMA_HOST);
        process.exit(1);
    }

    // API Routes
    app.use(API_PREFIX, createRouter(slaService, ollamaService, projectService));

    // Root endpoint
    app.get('/', (req, res) => {
        res.json({
            name: 'Ollama SLA Backend',
            version: '1.0.0',
            status: 'running',
            endpoints: {
                health: `${API_PREFIX}/health`,
                anomalyDetection: `${API_PREFIX}/anomaly/detect`,
                prediction: `${API_PREFIX}/predict`,
                alertGeneration: `${API_PREFIX}/alert/generate`,
                query: `${API_PREFIX}/query`,
                modelInfo: `${API_PREFIX}/model/info`,
                projectUpload: `${API_PREFIX}/project/upload`,
                projectList: `${API_PREFIX}/project/list`,
            },
            documentation: 'See README.md for API usage examples',
        });
    });

    // Error handling middleware
    app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
        console.error('Unhandled error:', err);
        res.status(500).json({
            error: 'Internal server error',
            message: err.message,
        });
    });

    // Start server
    app.listen(PORT, () => {
        console.log('');
        console.log('🚀 Ollama SLA Backend is running!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`📡 Server:        http://localhost:${PORT}`);
        console.log(`🤖 Model:         ${OLLAMA_MODEL}`);
        console.log(`🔗 Ollama Host:   ${OLLAMA_HOST}`);
        console.log(`🌐 CORS Origin:   ${CORS_ORIGIN}`);
        console.log(`📍 API Prefix:    ${API_PREFIX}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');
        console.log('📚 Available endpoints:');
        console.log(`   GET    ${API_PREFIX}/health`);
        console.log(`   POST   ${API_PREFIX}/anomaly/detect`);
        console.log(`   POST   ${API_PREFIX}/predict`);
        console.log(`   POST   ${API_PREFIX}/alert/generate`);
        console.log(`   POST   ${API_PREFIX}/query`);
        console.log(`   GET    ${API_PREFIX}/model/info`);
        console.log(`   POST   ${API_PREFIX}/project/upload`);
        console.log(`   GET    ${API_PREFIX}/project/list`);
        console.log(`   GET    ${API_PREFIX}/project/:id`);
        console.log(`   DELETE ${API_PREFIX}/project/:id`);
        console.log('');
    });
}

// Start the server
startServer().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
