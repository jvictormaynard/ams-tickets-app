import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// Rotas que não precisam de autenticação
const publicRoutes = ['/login', '/api/auth'];

export async function middleware(request: NextRequest) {
    const path = request.nextUrl.pathname;

    // Ignora rotas públicas
    if (publicRoutes.some(route => path.startsWith(route))) {
        return NextResponse.next();
    }

    const token = request.cookies.get('auth_token')?.value;

    // Se não houver token, redireciona para o login
    if (!token) {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        return NextResponse.redirect(url);
    }

    try {
        // Verifica o token usando jose
        const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key');
        await jwtVerify(token, secret);
        return NextResponse.next();
    } catch (error) {
        // Token inválido ou expirado
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        return NextResponse.redirect(url);
    }
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - anything with a file extension (e.g. .svg, .png, .jpg, .css, etc.)
         */
        '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
    ],
};
