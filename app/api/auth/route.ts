// app/api/auth/route.ts

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error('❌ Missing JWT_SECRET environment variable')
}

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

if (!ADMIN_USERNAME || !ADMIN_PASSWORD_HASH) {
  throw new Error('❌ Missing ADMIN_USERNAME or ADMIN_PASSWORD_HASH environment variable');
}

const COOKIE_NAME = 'auth_token'

// Exporta explicitamente o handler POST
export async function POST(request: NextRequest) {
  const { username, password } = await request.json()

  if (!username || !password) {
    return NextResponse.json(
      { error: 'Username and password are required' },
      { status: 400 }
    )
  }

  // Authenticate against environment variables
  if (username !== ADMIN_USERNAME) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }
  
  // ADMIN_PASSWORD_HASH is guaranteed to be a string due to the check above
  const valid = await bcrypt.compare(password, ADMIN_PASSWORD_HASH as string)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const secret = new TextEncoder().encode(JWT_SECRET)
  const token = await new SignJWT({ username: ADMIN_USERNAME })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret)

  const res = NextResponse.json({ success: true, message: 'Authenticated' })
  res.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60,
  })

  return res
}

// marca esse arquivo como CommonJS/Esm (não é obrigatório, mas às vezes ajuda)
export const runtime = 'nodejs'
