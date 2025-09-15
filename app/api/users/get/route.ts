export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  try {
    if (!adminAuth) return NextResponse.json({ error: 'Admin SDK not configured' }, { status: 500 });
    const { searchParams } = new URL(req.url);
    const uid = searchParams.get('uid');
    if (!uid) return NextResponse.json({ error: 'uid required' }, { status: 400 });
    const u = await adminAuth.getUser(uid);
    const claims = (u.customClaims as any) || {};
    const role = typeof claims.role === 'string' && claims.role.length > 0 ? claims.role : (claims.admin ? 'admin' : undefined);
    return NextResponse.json({ user: { uid: u.uid, email: u.email, displayName: u.displayName, role } });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

