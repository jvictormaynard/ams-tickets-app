// app/api/auth/route.ts

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error('❌ Missing JWT_SECRET environment variable')
}

const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
if (!ADMIN_PASSWORD_HASH) {
  throw new Error('❌ Missing ADMIN_PASSWORD_HASH environment variable');
}

const COOKIE_NAME = 'auth_token'

interface User {
  username: string
  hashedPassword: string
}

// aqui, seus usuários “hard-coded” (substitua por DB no futuro)
const users: User[] = [
  {
    username: process.env.ADMIN_USERNAME ?? 'admin',
    hashedPassword:
      process.env.ADMIN_PASSWORD_HASH ??
      '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
  },
]

// Exporta explicitamente o handler POST
export async function POST(request: NextRequest) {
  const { username, password } = await request.json()

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
