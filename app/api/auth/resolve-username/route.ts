import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    if (!adminDb) return NextResponse.json({ error: 'Admin SDK not configured' }, { status: 500 });
    const { searchParams } = new URL(req.url);
    const username = String(searchParams.get('username') || '').trim().toLowerCase();
    if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 });
    const snap = await adminDb.collection('usernames').doc(username).get();
    if (!snap.exists) return NextResponse.json({ error: 'not found' }, { status: 404 });
    const data = snap.data() as any;
    return NextResponse.json({ email: data?.email, uid: data?.uid, username });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

