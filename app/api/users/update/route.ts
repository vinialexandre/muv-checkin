export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    if (!adminAuth) return NextResponse.json({ error: 'Admin SDK not configured' }, { status: 500 });
    const { uid, displayName, role } = await req.json();
    if (!uid) return NextResponse.json({ error: 'uid required' }, { status: 400 });
    if (displayName !== undefined) await adminAuth.updateUser(uid, { displayName });
    if (role !== undefined) await adminAuth.setCustomUserClaims(uid, { role });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

