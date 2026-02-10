import Papa from 'papaparse';
import type { ProjectData, ProjectMetadata, WorkflowStep } from '../types/index.js';
import { analyzeWorkflowData, parseWorkflowStep } from '../utils/csvAnalyzer.js';
import { AIAnalysisService } from './AIAnalysisService.js';

/**
 * In-memory project storage service
 */
export class ProjectService {
    private projects: Map<string, ProjectData> = new Map();
    private aiAnalysisService?: AIAnalysisService;

    constructor(aiAnalysisService?: AIAnalysisService) {
        this.aiAnalysisService = aiAnalysisService;
    }

    /**
     * Create a new project from CSV data
     */
    async createProject(csvContent: string, projectName: string): Promise<ProjectData> {
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
                                const aiInsights = await this.aiAnalysisService.analyzeProjectData(
                                    statistics,
                                    projectName
                                );
                                statistics.aiInsights = aiInsights;
                                console.log('✅ AI analysis complete');
                            } catch (aiError) {
                                console.warn('⚠️  AI analysis failed, continuing without AI insights:', aiError);
                                // Continue without AI insights rather than failing the entire upload
                            }
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

                        // Store in memory
                        this.projects.set(projectId, projectData);

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
        return Array.from(this.projects.values()).map(project => project.metadata);
    }

    /**
     * Get project by ID
     */
    getProject(projectId: string): ProjectData | undefined {
        return this.projects.get(projectId);
    }

    /**
     * Delete project by ID
     */
    deleteProject(projectId: string): boolean {
        return this.projects.delete(projectId);
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
        return this.projects.size;
    }
}
