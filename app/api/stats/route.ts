import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase } from '../../../server/db'; // Import initializeDatabase
import { verifyAuth } from '../utils/auth'; // Assuming authentication is needed for stats

// Helper function to get start of day/week/month in Unix timestamp
function getStartOfDay(date: Date): number {
    date.setHours(0, 0, 0, 0);
    return Math.floor(date.getTime() / 1000);
}

function getStartOfWeek(date: Date): number {
    const day = date.getDay(); // Sunday - Saturday : 0 - 6
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    const monday = new Date(date.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return Math.floor(monday.getTime() / 1000);
}

function getStartOfMonth(date: Date): number {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    firstDay.setHours(0, 0, 0, 0);
    return Math.floor(firstDay.getTime() / 1000);
}

export async function GET(request: NextRequest) {
    try {
        await verifyAuth(); // Ensure user is authenticated
        const db = await initializeDatabase(); // Get DB instance

        const { searchParams } = new URL(request.url);
        const period = searchParams.get('period') || 'all'; // 'today', 'lastWeek', 'lastMonth', 'all'

        let whereClause = '';
        const now = new Date();
        let startDateUnix: number | null = null;

        if (period === 'today') {
            startDateUnix = getStartOfDay(now);
        } else if (period === 'lastWeek') {
            const lastWeek = new Date(now);
            lastWeek.setDate(now.getDate() - 7); // Go back 7 days
            startDateUnix = getStartOfWeek(lastWeek);
        } else if (period === 'lastMonth') {
            const lastMonth = new Date(now);
            lastMonth.setMonth(now.getMonth() - 1); // Go back 1 month
            startDateUnix = getStartOfMonth(lastMonth);
        }

        if (startDateUnix !== null) {
            whereClause = `WHERE lastActivityAt >= ${startDateUnix}`;
        }

        // Fetch Total Tickets
        const totalTicketsResult = await db.get(`SELECT COUNT(*) as count FROM tickets ${whereClause}`);
        const totalTickets = totalTicketsResult.count;

        // Fetch Tickets by Status
        const ticketsByStatusResult = await db.all(`SELECT status, COUNT(*) as count FROM tickets ${whereClause} GROUP BY status`);
        const ticketsByStatus = ticketsByStatusResult.reduce((acc: any, row: any) => {
            acc[row.status] = row.count;
            return acc;
        }, {});

        // Fetch Tickets by Agent
        const ticketsByAgentResult = await db.all(`SELECT agent, COUNT(*) as count FROM tickets ${whereClause} GROUP BY agent`);
        const ticketsByAgent = ticketsByAgentResult.reduce((acc: any, row: any) => {
            acc[row.agent] = row.count;
            return acc;
        }, {});

        // Fetch Tickets by Type
        const ticketsByTypeResult = await db.all(`SELECT type, COUNT(*) as count FROM tickets ${whereClause} GROUP BY type`);
        const ticketsByType = ticketsByTypeResult.reduce((acc: any, row: any) => {
            acc[row.type] = row.count;
            return acc;
        }, {});

        // Calculate Average Resolution Time
        // Convert 'DD/MM/YYYY' dateCreated to Unix timestamp for calculation
        const avgResolutionTimeResult = await db.get(`
            SELECT AVG(lastActivityAt - CAST(strftime('%s', SUBSTR(dateCreated, 7, 4) || '-' || SUBSTR(dateCreated, 4, 2) || '-' || SUBSTR(dateCreated, 1, 2) || ' 00:00:00') AS INTEGER)) as avg_time_seconds
            FROM tickets
            ${whereClause ? `${whereClause} AND status = 'Resolvido'` : `WHERE status = 'Resolvido'`}
        `);
        let avgResolutionTime = 'N/A';
        if (avgResolutionTimeResult && avgResolutionTimeResult.avg_time_seconds) {
            const totalSeconds = avgResolutionTimeResult.avg_time_seconds;
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            avgResolutionTime = `${hours}h ${minutes}m`;
        }

        return NextResponse.json({
            totalTickets,
            ticketsByStatus,
            ticketsByAgent,
            ticketsByType,
            avgResolutionTime,
        });

    } catch (error: any) {
        console.error("API: Erro na rota /api/stats:", error.message, error.stack);
        return NextResponse.json({
            error: error.message || "Erro interno do servidor ao buscar estatísticas."
        }, { status: 500 });
    }
}
