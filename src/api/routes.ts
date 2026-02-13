import { Router, Request, Response } from 'express';
import multer from 'multer';
import { SLAIntelligenceService } from '../services/SLAIntelligenceService.js';
import { OllamaService } from '../services/OllamaService.js';
import { ProjectService } from '../services/ProjectService.js';
import type { AIProvider } from '../services/AIFactory.js';

// Configure multer for file uploads (memory storage)
const upload = multer({ storage: multer.memoryStorage() });

export function createRouter(
    slaService: SLAIntelligenceService,
    ollamaService: OllamaService,
    projectService: ProjectService
) {
    const router = Router();

    /**
     * Health check endpoint
     */
    router.get('/health', async (req: Request, res: Response) => {
        try {
            const health = await ollamaService.healthCheck();
            res.json({
                status: health.status,
                message: health.message,
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            res.status(500).json({
                status: 'unhealthy',
                error: String(error),
            });
        }
    });

    /**
     * Anomaly detection endpoint
     * POST /api/v1/anomaly/detect
     */
    router.post('/anomaly/detect', async (req: Request, res: Response) => {
        try {
            const { current, historical } = req.body;

            if (!current || !historical) {
                return res.status(400).json({
                    error: 'Missing required fields: current and historical',
                });
            }

            const result = await slaService.detectAnomaly(current, historical);
            res.json(result);
        } catch (error) {
            console.error('Anomaly detection error:', error);
            res.status(500).json({
                error: 'Failed to detect anomaly',
                details: String(error),
            });
        }
    });

    /**
     * Prediction endpoint
     * POST /api/v1/predict
     */
    router.post('/predict', async (req: Request, res: Response) => {
        try {
            const { historical, horizonDays = 3 } = req.body;

            if (!historical) {
                return res.status(400).json({
                    error: 'Missing required field: historical',
                });
            }

            const result = await slaService.predictMetrics(historical, horizonDays);
            res.json(result);
        } catch (error) {
            console.error('Prediction error:', error);
            res.status(500).json({
                error: 'Failed to generate prediction',
                details: String(error),
            });
        }
    });

    /**
     * Alert generation endpoint
     * POST /api/v1/alert/generate
     */
    router.post('/alert/generate', async (req: Request, res: Response) => {
        try {
            const alertRequest = req.body;

            if (!alertRequest.metricName || !alertRequest.currentValue || !alertRequest.threshold) {
                return res.status(400).json({
                    error: 'Missing required fields: metricName, currentValue, threshold',
                });
            }

            const result = await slaService.generateAlert(alertRequest);
            res.json(result);
        } catch (error) {
            console.error('Alert generation error:', error);
            res.status(500).json({
                error: 'Failed to generate alert',
                details: String(error),
            });
        }
    });

    /**
     * General query endpoint (with conversation support)
     * POST /api/v1/query
     */
    router.post('/query', async (req: Request, res: Response) => {
        try {
            const { question, context, conversationHistory } = req.body;

            if (!question) {
                return res.status(400).json({
                    error: 'Missing required field: question',
                });
            }

            // Use chatQuery if conversation history is provided, otherwise use simple query
            const result = conversationHistory && conversationHistory.length > 0
                ? await slaService.chatQuery(question, conversationHistory, context)
                : await slaService.query(question, context);

            res.json({ answer: result });
        } catch (error) {
            console.error('Query error:', error);
            res.status(500).json({
                error: 'Failed to process query',
                details: String(error),
            });
        }
    });

    /**
     * Model info endpoint
     */
    router.get('/model/info', async (req: Request, res: Response) => {
        try {
            const info = await ollamaService.getModelInfo();
            res.json(info);
        } catch (error) {
            res.status(500).json({
                error: 'Failed to get model info',
                details: String(error),
            });
        }
    });

    /**
     * Upload CSV and create project
     * POST /api/v1/project/upload
     */
    router.post('/project/upload', upload.single('file'), async (req: Request, res: Response) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            const projectName = req.body.name || `Project ${new Date().toLocaleDateString()}`;
            const aiProvider = (req.body.aiProvider as AIProvider) || 'ollama';
            const apiKey = req.body.apiKey; // Optional API key
            const csvContent = req.file.buffer.toString('utf-8');

            const projectData = await projectService.createProject(csvContent, projectName, aiProvider, apiKey);

            res.json({
                success: true,
                project: projectData.metadata,
                message: `Project "${projectName}" created successfully`
            });
        } catch (error) {
            console.error('Project upload error:', error);
            res.status(500).json({
                error: 'Failed to create project',
                details: String(error),
            });
        }
    });

    /**
     * List all projects
     * GET /api/v1/project/list
     */
    router.get('/project/list', (req: Request, res: Response) => {
        try {
            const projects = projectService.getAllProjects();
            res.json({
                projects,
                count: projects.length
            });
        } catch (error) {
            res.status(500).json({
                error: 'Failed to list projects',
                details: String(error),
            });
        }
    });

    /**
     * Get project data by ID
     * GET /api/v1/project/:id
     */
    router.get('/project/:id', (req: Request, res: Response) => {
        try {
            const projectId = req.params.id;
            const project = projectService.getProject(projectId);

            if (!project) {
                return res.status(404).json({ error: 'Project not found' });
            }

            res.json(project);
        } catch (error) {
            res.status(500).json({
                error: 'Failed to get project',
                details: String(error),
            });
        }
    });

    /**
     * Get AI analysis for a project
     * GET /api/v1/project/:id/analyze
     */
    router.get('/project/:id/analyze', async (req: Request, res: Response) => {
        try {
            const projectId = req.params.id;
            const project = projectService.getProject(projectId);

            if (!project) {
                return res.status(404).json({ error: 'Project not found' });
            }

            // Generate AI insights using the LLM
            const insights = await slaService.query(
                `Analyze this SLA data and provide 3 key insights:\n` +
                `- Total tickets: ${project.statistics.totalTickets}\n` +
                `- Avg processing time: ${project.statistics.avgDaysRested} days\n` +
                `- Completion rate: ${project.statistics.completionRate}%\n` +
                `- Anomalies detected: ${project.statistics.anomalyCount}\n` +
                `- Critical bottleneck: ${project.statistics.criticalBottleneck?.role || 'None'} ` +
                `(${project.statistics.criticalBottleneck?.cases || 0} cases, ` +
                `${project.statistics.criticalBottleneck?.avgDelay || 0} days avg)`,
                { projectId, statistics: project.statistics }
            );

            res.json({
                projectId,
                insights,
                statistics: project.statistics
            });
        } catch (error) {
            console.error('Project analysis error:', error);
            res.status(500).json({
                error: 'Failed to analyze project',
                details: String(error),
            });
        }
    });

    /**
     * Delete project
     * DELETE /api/v1/project/:id
     */
    router.delete('/project/:id', (req: Request, res: Response) => {
        try {
            const projectId = req.params.id;
            const deleted = projectService.deleteProject(projectId);

            if (!deleted) {
                return res.status(404).json({ error: 'Project not found' });
            }

            res.json({ success: true, message: 'Project deleted successfully' });
        } catch (error) {
            res.status(500).json({
                error: 'Failed to delete project',
                details: String(error),
            });
        }
    });

    return router;
}

