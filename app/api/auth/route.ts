// app/api/auth/route.ts

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error('❌ Missing JWT_SECRET environment variable')
}

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
if (!ADMIN_USERNAME) {
  throw new Error('❌ Missing ADMIN_USERNAME environment variable');
}

const COOKIE_NAME = 'auth_token'

interface User {
  username: string
  hashedPassword: string
}

// Temporary hardcoded user for debugging environment variable loading issues.
// In a production environment, these values should always come from secure environment variables.
const users: User[] = [
  {
    username: 'admin', // Hardcoded for debugging, should ideally come from process.env.ADMIN_USERNAME
    hashedPassword: '$2a$10$PklCIJJWwHSxxFEUox.NUePKJ.soBNVVI4qW4pWyefd6JHr9AUqpq', // Hardcoded for debugging, should ideally come from process.env.ADMIN_PASSWORD_HASH
  },
]

// Exporta explicitamente o handler POST
export async function POST(request: NextRequest) {
  const { username, password } = await request.json()

  // Debug logs removed for cleaner output, re-add if further debugging is needed.

  if (!username || !password) {
    return NextResponse.json(
      { error: 'Usuário e senha são obrigatórios' },
      { status: 400 }
    )
  }

  const user = users.find((u) => u.username === username)
  if (!user) {
    return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })
  }
  
  const valid = await bcrypt.compare(password, user.hashedPassword)
  if (!valid) {
    return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })
  }

  const secret = new TextEncoder().encode(JWT_SECRET)
  const token = await new SignJWT({ username: user.username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret)

  const res = NextResponse.json({ success: true, message: 'Autenticado' })
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
