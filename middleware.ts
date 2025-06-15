import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

export async function middleware(request: NextRequest) {
    const token = request.cookies.get('auth_token')?.value;

    // Se não houver token, redireciona para o login
    if (!token) {
        if (request.nextUrl.pathname === '/login') {
            return NextResponse.next();
        }
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        return NextResponse.redirect(url);
    }

    try {
        // Verifica o token usando jose
        const JWT_SECRET = process.env.JWT_SECRET;
        if (!JWT_SECRET) {
            throw new Error('❌ Missing JWT_SECRET environment variable in middleware');
        }
        const secret = new TextEncoder().encode(JWT_SECRET);
        await jwtVerify(token, secret);
        if (request.nextUrl.pathname === '/login') {
            const url = request.nextUrl.clone();
            url.pathname = '/';
            return NextResponse.redirect(url);
        }
        return NextResponse.next();
    } catch (error) {
        // Token inválido ou expirado
        if (request.nextUrl.pathname === '/login') {
            return NextResponse.next();
        }
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        return NextResponse.redirect(url);
    }
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api/auth (the auth api route)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - anything with a file extension (e.g. .svg, .png, .jpg, .css, etc.)
         */
        '/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)',
    ],
};
