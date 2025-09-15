import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    if (!adminAuth) return NextResponse.json({ error: 'Admin SDK not configured' }, { status: 500 });
    const { uid } = await req.json();
    await adminAuth.deleteUser(uid);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
export const runtime = 'nodejs';
