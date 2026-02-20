import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type { ProjectData, ProjectMetadata } from '../types/index.js';

/**
 * Service to manage SQLite database for project persistence
 */
export class DatabaseService {
    private db: Database.Database;

    constructor() {
        const dbPath = process.env.DB_PATH || './data/sla_intelligence.db';
        const dbDir = path.dirname(dbPath);

        // Ensure directory exists
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        console.log(`🗄️ Initializing database at ${dbPath}`);
        this.db = new Database(dbPath);

        // Performance optimizations
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('synchronous = NORMAL');

        this.initializeSchema();
    }

    private initializeSchema() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                metadata TEXT NOT NULL,
                workflowSteps TEXT NOT NULL,
                statistics TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Database schema initialized');
    }

    /**
     * Save/Update a project
     */
    saveProject(project: ProjectData): void {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO projects (id, name, metadata, workflowSteps, statistics)
            VALUES (?, ?, ?, ?, ?)
        `);

        stmt.run(
            project.metadata.id,
            project.metadata.name,
            JSON.stringify(project.metadata),
            JSON.stringify(project.workflowSteps),
            JSON.stringify(project.statistics)
        );
    }

    /**
     * Get all projects metadata
     */
    getAllProjectsMetadata(): ProjectMetadata[] {
        const stmt = this.db.prepare('SELECT metadata FROM projects ORDER BY created_at DESC');
        const rows = stmt.all() as { metadata: string }[];
        return rows.map(row => JSON.parse(row.metadata));
    }

    /**
     * Get full project data by ID
     */
    getProject(id: string): ProjectData | undefined {
        const stmt = this.db.prepare('SELECT metadata, workflowSteps, statistics FROM projects WHERE id = ?');
        const row = stmt.get(id) as { metadata: string; workflowSteps: string; statistics: string } | undefined;

        if (!row) return undefined;

        return {
            metadata: JSON.parse(row.metadata),
            workflowSteps: JSON.parse(row.workflowSteps),
            statistics: JSON.parse(row.statistics)
        };
    }

    /**
     * Delete a project
     */
    deleteProject(id: string): boolean {
        const stmt = this.db.prepare('DELETE FROM projects WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }

    /**
     * Get project count
     */
    getProjectCount(): number {
        const stmt = this.db.prepare('SELECT COUNT(*) as count FROM projects');
        const row = stmt.get() as { count: number };
        return row.count;
    }
}
