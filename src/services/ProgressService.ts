import { Response } from 'express';

// Progress event payload
export interface ProgressEvent {
    stage: string;       // Current stage (e.g., "Analyzing Anomalies")
    progress: number;    // Percentage (0-100)
    details?: string;    // Optional details (e.g., "Batch 1/5")
}

/**
 * Service to manage Server-Sent Events (SSE) for progress updates
 */
export class ProgressService {
    private static instance: ProgressService;
    private clients: Set<Response> = new Set();
    private currentProgress: ProgressEvent = { stage: 'Idle', progress: 0 };

    private constructor() { }

    public static getInstance(): ProgressService {
        if (!ProgressService.instance) {
            ProgressService.instance = new ProgressService();
        }
        return ProgressService.instance;
    }

    /**
     * Add a new SSE client
     */
    addClient(res: Response) {
        this.clients.add(res);

        // Send immediate current state
        this.sendToClient(res, this.currentProgress);

        // Remove client on connection close
        res.on('close', () => {
            this.clients.delete(res);
        });
    }

    /**
     * Broadcast progress update to all connected clients
     */
    updateProgress(stage: string, progress: number, details?: string) {
        this.currentProgress = { stage, progress, details };
        this.broadcast(this.currentProgress);

        // Reset if complete
        if (progress >= 100) {
            setTimeout(() => {
                this.updateProgress('Idle', 0);
            }, 5000);
        }
    }

    private broadcast(data: ProgressEvent) {
        this.clients.forEach(client => this.sendToClient(client, data));
    }

    private sendToClient(res: Response, data: ProgressEvent) {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
}
