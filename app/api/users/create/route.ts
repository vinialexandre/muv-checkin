import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

function normUsername(v: string) {
  return String(v || '').trim().toLowerCase();
}

export async function POST(req: NextRequest) {
  try {
    if (!adminAuth || !adminDb) return NextResponse.json({ error: 'Admin SDK not configured' }, { status: 500 });
    const { email, password, displayName, role, active, username } = await req.json();

    const uname = normUsername(username);
    if (!uname) return NextResponse.json({ error: 'username obrigatório' }, { status: 400 });

    const unameRef = adminDb.collection('usernames').doc(uname);
    const existing = await unameRef.get();
    if (existing.exists) return NextResponse.json({ error: 'Nome de usuário já está em uso' }, { status: 400 });

    const user = await adminAuth.createUser({ email, password, displayName, emailVerified: true });
    await adminAuth.setCustomUserClaims(user.uid, { role, active: active === undefined ? true : !!active, username: uname });

    await unameRef.set({ uid: user.uid, email, username: uname });

    return NextResponse.json({ ok: true, uid: user.uid });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
export const runtime = 'nodejs';
