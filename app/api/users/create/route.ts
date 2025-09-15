import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    if (!adminAuth) return NextResponse.json({ error: 'Admin SDK not configured' }, { status: 500 });
    const { email, password, displayName, role } = await req.json();
    const user = await adminAuth.createUser({ email, password, displayName, emailVerified: true });
    if (role) await adminAuth.setCustomUserClaims(user.uid, { role });
    return NextResponse.json({ ok: true, uid: user.uid });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
export const runtime = 'nodejs';
