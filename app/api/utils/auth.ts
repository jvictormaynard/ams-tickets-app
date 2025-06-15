import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

export interface AuthToken {
    username: string;
    iat: number;
    exp: number;
}

export const verifyAuth = async () => {
    const cookieStore = cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
        throw new Error('Não autenticado');
    }

    try {
        const JWT_SECRET = process.env.JWT_SECRET;
        if (!JWT_SECRET) {
            throw new Error('❌ Missing JWT_SECRET environment variable in auth utility');
        }
        const secret = new TextEncoder().encode(JWT_SECRET);
        const { payload } = await jwtVerify(token, secret);
        return payload as unknown as AuthToken;
    } catch (error) {
        throw new Error('Token inválido');
    }
};
