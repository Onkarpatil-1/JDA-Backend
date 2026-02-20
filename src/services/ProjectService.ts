import Papa from 'papaparse';
import type { ProjectData, ProjectMetadata, WorkflowStep } from '../types/index.js';
import type { AIProvider } from './AIFactory.js';
import { parseWorkflowStep, analyzeWorkflowData } from '../utils/csvAnalyzer.js';
import { AIAnalysisService } from './AIAnalysisService.js';
import { DatabaseService } from './DatabaseService.js';

/**
 * In-memory project storage service
 */
export class ProjectService {
    private dbService: DatabaseService;
    private aiAnalysisService?: AIAnalysisService;

    constructor(dbService: DatabaseService, aiAnalysisService?: AIAnalysisService) {
        this.dbService = dbService;
        this.aiAnalysisService = aiAnalysisService;
    }

    /**
     * Create a new project from CSV data
     */
    async createProject(csvContent: string, projectName: string, provider: AIProvider = 'ollama', apiKey?: string): Promise<ProjectData> {
        // Validate file size (warn if > 50MB worth of data)
        const sizeInMB = new Blob([csvContent]).size / (1024 * 1024);
        if (sizeInMB > 100) {
            throw new Error(`File too large (${sizeInMB.toFixed(1)}MB). Maximum supported size is 100MB.`);
        }

        console.log(`Processing CSV: ${sizeInMB.toFixed(2)}MB`);

        return new Promise((resolve, reject) => {
            Papa.parse(csvContent, {
                header: true,
                skipEmptyLines: true,
                dynamicTyping: false, // Keep as strings for memory efficiency
                worker: false, // Server-side, no web workers needed
                chunkSize: 1024 * 1024, // Process 1MB chunks
                complete: async (results) => {
                    try {
                        // Parse workflow steps
                        const workflowSteps: WorkflowStep[] = results.data.map(parseWorkflowStep);

                        // Generate statistics
                        const statistics = analyzeWorkflowData(workflowSteps);

                        // Generate AI insights (if service available)
                        if (this.aiAnalysisService) {
                            try {
                                console.log('🤖 Running AI analysis...');
                                console.log(`   Provider: ${provider}`);
                                console.log(`   Total tickets: ${statistics.totalTickets}`);
                                console.log(`   Workflow steps: ${workflowSteps.length}`);

                                const aiInsights = await this.aiAnalysisService.analyzeProjectData(
                                    statistics,
                                    projectName,
                                    provider,
                                    apiKey,
                                    workflowSteps // Pass full history for forensic analysis
                                );

                                console.log('✅ AI analysis complete');
                                console.log(`   Has remarkAnalysis: ${!!aiInsights?.remarkAnalysis}`);
                                console.log(`   Has forensicReports: ${!!aiInsights?.forensicReports}`);
                                console.log(`   Forensic reports keys: ${aiInsights?.forensicReports ? Object.keys(aiInsights.forensicReports).join(', ') : 'none'}`);

                                statistics.aiInsights = aiInsights;
                            } catch (aiError) {
                                console.error('❌ AI analysis failed with error:');
                                console.error(aiError);
                                console.error('Stack trace:', (aiError as Error).stack);
                                // Continue without AI insights rather than failing the entire upload
                            }
                        } else {
                            console.warn('⚠️  No AI analysis service available');
                        }

                        // Create project metadata
                        const projectId = this.generateProjectId();
                        const metadata: ProjectMetadata = {
                            id: projectId,
                            name: projectName,
                            uploadedAt: new Date().toISOString(),
                            totalRecords: workflowSteps.length,
                            totalTickets: statistics.totalTickets,
                            avgProcessingTime: statistics.avgDaysRested,
                            completionRate: statistics.completionRate
                        };

                        // Create project data
                        const projectData: ProjectData = {
                            metadata,
                            workflowSteps,
                            statistics
                        };

                        // Store in database
                        this.dbService.saveProject(projectData);

                        resolve(projectData);
                    } catch (error) {
                        reject(new Error(`Failed to parse CSV: ${error}`));
                    }
                },
                error: (error: any) => {
                    reject(new Error(`CSV parsing error: ${error.message}`));
                }
            });
        });
    }

    /**
     * Get all projects
     */
    getAllProjects(): ProjectMetadata[] {
        return this.dbService.getAllProjectsMetadata();
    }

    /**
     * Get project by ID
     */
    getProject(projectId: string): ProjectData | undefined {
        return this.dbService.getProject(projectId);
    }

    /**
     * Delete project by ID
     */
    deleteProject(projectId: string): boolean {
        return this.dbService.deleteProject(projectId);
    }

    /**
     * Generate unique project ID
     */
    private generateProjectId(): string {
        return `project_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    /**
     * Get project count
     */
    getProjectCount(): number {
        return this.dbService.getProjectCount();
    }
}
