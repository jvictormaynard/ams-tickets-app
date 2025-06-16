import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '../utils/auth';

export async function GET(request: NextRequest) {
    try {
        const auth = await verifyAuth();
        return NextResponse.json({ username: auth.username, role: auth.role });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Não autenticado' }, { status: 401 });
    }
}
