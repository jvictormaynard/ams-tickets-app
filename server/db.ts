// code/server/db.ts
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

// Define the path to the SQLite database file
const DB_PATH = path.join(process.cwd(), 'data', 'ams_tickets.db');

// Ensure the data directory exists
import fs from 'fs';
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

let dbInstance: any = null;

/**
 * Initializes the SQLite database and creates necessary tables.
 * @returns Promise that resolves with the database instance.
 */
export const initializeDatabase = async () => {
    if (dbInstance) {
        return dbInstance;
    }

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
    `);
    console.log('SQLite database initialized and tables created.');
    return dbInstance;
};

/**
 * Inserts or updates a single ticket.
 * @param ticket The ticket object.
 */
export const putTicket = async (ticket: any) => {
    const db = await initializeDatabase();
    await db.run(
        `INSERT OR REPLACE INTO tickets (id, status, statusClass, type, assunto, agent, dateCreated, lastActivityAt, contactName, empresa, modalDescription)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ticket.id, ticket.status, ticket.statusClass, ticket.type, ticket.assunto, ticket.agent, ticket.dateCreated, ticket.lastActivityAt, ticket.contactName, ticket.empresa, ticket.modalDescription
    );
};

/**
 * Inserts or updates multiple tickets.
 * @param tickets An array of ticket objects.
 */
export const putTickets = async (tickets: any[]) => {
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
};

/**
 * Retrieves tickets with pagination.
 * @param page The current page number (1-indexed).
 * @param perPage The number of tickets per page.
 * @returns Promise that resolves with an array of ticket objects for the current page.
 */
export const getAllTickets = async (page: number, perPage: number): Promise<any[]> => {
    const db = await initializeDatabase();
    const offset = (page - 1) * perPage;
    return db.all('SELECT * FROM tickets ORDER BY lastActivityAt DESC LIMIT ? OFFSET ?', perPage, offset);
};

/**
 * Retrieves the total count of tickets.
 * @returns Promise that resolves with the total number of tickets.
 */
export const getTotalTicketCount = async (): Promise<number> => {
    const db = await initializeDatabase();
    const result = await db.get('SELECT COUNT(*) as count FROM tickets');
    return result.count;
};

/**
 * Inserts or updates conversation messages for a ticket.
 * Messages are stored as a JSON string.
 * @param ticketId The ID of the ticket.
 * @param messages An array of message objects.
 */
export const putConversationMessages = async (ticketId: string, messages: any[]) => {
    const db = await initializeDatabase();
    await db.run(
        `INSERT OR REPLACE INTO conversations (ticketId, messages)
         VALUES (?, ?)`,
        ticketId, JSON.stringify(messages)
    );
};

/**
 * Inserts or updates multiple conversations.
 * @param conversations An object mapping ticket IDs to arrays of messages.
 */
export const putConversations = async (conversations: { [ticketId: string]: any[] }) => {
    const db = await initializeDatabase();
    const stmt = await db.prepare(`
        INSERT OR REPLACE INTO conversations (ticketId, messages)
        VALUES (?, ?)
    `);
    for (const ticketId in conversations) {
        await stmt.run(ticketId, JSON.stringify(conversations[ticketId]));
    }
    await stmt.finalize();
};

/**
 * Retrieves conversation messages for a specific ticket.
 * @param ticketId The ID of the ticket.
 * @returns Promise that resolves with an array of message objects, or null if not found.
 */
export const getConversationMessages = async (ticketId: string): Promise<any[] | null> => {
    const db = await initializeDatabase();
    const row = await db.get('SELECT messages FROM conversations WHERE ticketId = ?', ticketId);
    return row ? JSON.parse(row.messages) : null;
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
    const db = await initializeDatabase();
    const placeholders = ticketIds.map(() => '?').join(',');
    const rows = await db.all(`SELECT ticketId, messages FROM conversations WHERE ticketId IN (${placeholders})`, ...ticketIds);
    const result: { [ticketId: string]: any[] } = {};
    rows.forEach((row: any) => {
        result[row.ticketId] = JSON.parse(row.messages);
    });
    return result;
};

/**
 * Clears all data from a specific table.
 * @param tableName The name of the table to clear.
 */
export const clearTable = async (tableName: string): Promise<void> => {
    const db = await initializeDatabase();
    await db.run(`DELETE FROM ${tableName}`);
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
