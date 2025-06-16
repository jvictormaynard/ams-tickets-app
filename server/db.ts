// code/server/db.ts
import sqlite3 from 'sqlite3';
import path from 'path';

// Define the path to the SQLite database file
const DB_PATH = path.join(process.cwd(), 'data', 'ams_tickets.db');

// Ensure the data directory exists
import fs from 'fs';
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

import { Database, open } from 'sqlite';
import bcrypt from 'bcryptjs'; // Import bcryptjs

interface Ticket {
    id: string;
    status: string;
    statusClass: string;
    type: string;
    assunto: string;
    agent: string;
    dateCreated: string;
    lastActivityAt: number;
    contactName: string;
    empresa: string;
    modalDescription: string;
}

interface Conversation {
    ticketId: string;
    messages: string; // Storing as JSON string
}

let dbInstance: Database | null = null;

/**
 * Initializes the SQLite database and creates necessary tables.
 * @returns Promise that resolves with the database instance.
 */
export const initializeDatabase = async (): Promise<Database> => {
    if (dbInstance) {
        return dbInstance;
    }

    try {
        dbInstance = await open({
            filename: DB_PATH,
            driver: sqlite3.Database,
        });

        await dbInstance.exec(`
            CREATE TABLE IF NOT EXISTS tickets (
                id TEXT PRIMARY KEY,
                status TEXT,
                statusClass TEXT,
                type TEXT,
                assunto TEXT,
                agent TEXT,
                dateCreated TEXT,
                lastActivityAt INTEGER,
                contactName TEXT,
                empresa TEXT,
                modalDescription TEXT
            );

            CREATE TABLE IF NOT EXISTS conversations (
                ticketId TEXT PRIMARY KEY,
                messages TEXT, -- Storing as JSON string
                FOREIGN KEY (ticketId) REFERENCES tickets(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'ams'
            );
        `);
        console.log('SQLite database initialized and tables created.');

        // Ensure environment variables are available for initial admin user setup
        const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
        const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
        const JWT_SECRET = process.env.JWT_SECRET; // Also check JWT_SECRET

        if (!ADMIN_USERNAME || !ADMIN_PASSWORD_HASH || !JWT_SECRET) {
            console.warn('Missing ADMIN_USERNAME, ADMIN_PASSWORD_HASH, or JWT_SECRET environment variables. Default admin user might not be created or updated.');
        } else {
            // Always ensure the admin user exists and its password is up-to-date from .env.local
            await dbInstance.run(
                `INSERT OR REPLACE INTO users (username, password, role) VALUES (?, ?, ?)`,
                ADMIN_USERNAME, ADMIN_PASSWORD_HASH, 'admin'
            );
        }

        // Hash password for 'ams' user
        const amsPasswordHash = await bcrypt.hash('tickets123AMS', 10);
        // Always ensure the 'ams' user exists and its password is up-to-date
        await dbInstance.run(
            `INSERT OR REPLACE INTO users (username, password, role) VALUES (?, ?, ?)`,
            'ams', amsPasswordHash, 'ams'
        );

        return dbInstance;
    } catch (error) {
        console.error('Error initializing database:', error);
        throw error;
    }
};

/**
 * Inserts or updates a single ticket.
 * @param ticket The ticket object.
 */
export const putTicket = async (ticket: Ticket): Promise<void> => {
    try {
        const db = await initializeDatabase();
        await db.run(
            `INSERT OR REPLACE INTO tickets (id, status, statusClass, type, assunto, agent, dateCreated, lastActivityAt, contactName, empresa, modalDescription)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ticket.id, ticket.status, ticket.statusClass, ticket.type, ticket.assunto, ticket.agent, ticket.dateCreated, ticket.lastActivityAt, ticket.contactName, ticket.empresa, ticket.modalDescription
        );
    } catch (error) {
        console.error('Error putting ticket:', error);
        throw error;
    }
};

/**
 * Inserts or updates multiple tickets.
 * @param tickets An array of ticket objects.
 */
export const putTickets = async (tickets: Ticket[]): Promise<void> => {
    try {
        const db = await initializeDatabase();
        const stmt = await db.prepare(`
            INSERT OR REPLACE INTO tickets (id, status, statusClass, type, assunto, agent, dateCreated, lastActivityAt, contactName, empresa, modalDescription)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const ticket of tickets) {
            await stmt.run(
                ticket.id, ticket.status, ticket.statusClass, ticket.type, ticket.assunto, ticket.agent, ticket.dateCreated, ticket.lastActivityAt, ticket.contactName, ticket.empresa, ticket.modalDescription
            );
        }
        await stmt.finalize();
    } catch (error) {
        console.error('Error putting tickets:', error);
        throw error;
    }
};

/**
 * Retrieves tickets with pagination.
 * @param page The current page number (1-indexed).
 * @param perPage The number of tickets per page.
 * @returns Promise that resolves with an array of ticket objects for the current page.
 */
export const getAllTickets = async (page: number, perPage: number): Promise<Ticket[]> => {
    try {
        const db = await initializeDatabase();
        const offset = (page - 1) * perPage;
        return db.all('SELECT * FROM tickets ORDER BY lastActivityAt DESC LIMIT ? OFFSET ?', perPage, offset);
    } catch (error) {
        console.error('Error getting all tickets:', error);
        throw error;
    }
};

/**
 * Retrieves the total count of tickets.
 * @returns Promise that resolves with the total number of tickets.
 */
export const getTotalTicketCount = async (): Promise<number> => {
    try {
        const db = await initializeDatabase();
        const result = await db.get('SELECT COUNT(*) as count FROM tickets');
        return result.count;
    } catch (error) {
        console.error('Error getting total ticket count:', error);
        throw error;
    }
};

/**
 * Inserts or updates conversation messages for a ticket.
 * Messages are stored as a JSON string.
 * @param ticketId The ID of the ticket.
 * @param messages An array of message objects.
 */
export const putConversationMessages = async (ticketId: string, messages: any[]): Promise<void> => {
    try {
        const db = await initializeDatabase();
        await db.run(
            `INSERT OR REPLACE INTO conversations (ticketId, messages)
             VALUES (?, ?)`,
            ticketId, JSON.stringify(messages)
        );
    } catch (error) {
        console.error('Error putting conversation messages:', error);
        throw error;
    }
};

/**
 * Inserts or updates multiple conversations.
 * @param conversations An object mapping ticket IDs to arrays of messages.
 */
export const putConversations = async (conversations: { [ticketId: string]: any[] }): Promise<void> => {
    try {
        const db = await initializeDatabase();
        const stmt = await db.prepare(`
            INSERT OR REPLACE INTO conversations (ticketId, messages)
            VALUES (?, ?)
        `);
        for (const ticketId in conversations) {
            await stmt.run(ticketId, JSON.stringify(conversations[ticketId]));
        }
        await stmt.finalize();
    } catch (error) {
        console.error('Error putting conversations:', error);
        throw error;
    }
};

/**
 * Retrieves conversation messages for a specific ticket.
 * @param ticketId The ID of the ticket.
 * @returns Promise that resolves with an array of message objects, or null if not found.
 */
export const getConversationMessages = async (ticketId: string): Promise<any[] | null> => {
    try {
        const db = await initializeDatabase();
        const row = await db.get('SELECT messages FROM conversations WHERE ticketId = ?', ticketId);
        return row ? JSON.parse(row.messages) : null;
    } catch (error) {
        console.error('Error getting conversation messages:', error);
        throw error;
    }
};

/**
 * Retrieves conversation messages for a given set of ticket IDs.
 * @param ticketIds An array of ticket IDs for which to retrieve conversations.
 * @returns Promise that resolves with an object mapping ticket IDs to arrays of messages.
 */
export const getConversationsByIds = async (ticketIds: string[]): Promise<{ [ticketId: string]: any[] }> => {
    if (ticketIds.length === 0) {
        return {};
    }
    try {
        const db = await initializeDatabase();
        const placeholders = ticketIds.map(() => '?').join(',');
        const rows = await db.all(`SELECT ticketId, messages FROM conversations WHERE ticketId IN (${placeholders})`, ...ticketIds);
        const result: { [ticketId: string]: any[] } = {};
        rows.forEach((row: Conversation) => {
            result[row.ticketId] = JSON.parse(row.messages);
        });
        return result;
    } catch (error) {
        console.error('Error getting conversations by IDs:', error);
        throw error;
    }
};

/**
 * Clears all data from a specific table.
 * @param tableName The name of the table to clear.
 */
export const clearTable = async (tableName: string): Promise<void> => {
    try {
        const db = await initializeDatabase();
        await db.run(`DELETE FROM ${tableName}`);
    } catch (error) {
        console.error(`Error clearing table ${tableName}:`, error);
        throw error;
    }
};

/**
 * Closes the database connection.
 */
export const closeDB = async (): Promise<void> => {
    if (dbInstance) {
        await dbInstance.close();
        dbInstance = null;
        console.log('SQLite database closed.');
    }
};
