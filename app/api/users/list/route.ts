import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';

export async function GET(_req: NextRequest) {
  try {
    if (!adminAuth) return NextResponse.json({ error: 'Admin SDK not configured' }, { status: 500 });
    const { searchParams } = new URL(_req.url);
    const pageToken = searchParams.get('pageToken') || undefined;
    const pageSize = Number(searchParams.get('pageSize') || 20);
    const res = await adminAuth.listUsers(pageSize, pageToken);
    const users = res.users.map(u => {
      const claims = (u.customClaims as any) || {};
      const role = typeof claims.role === 'string' && claims.role.length > 0
        ? claims.role
        : (claims.admin ? 'admin' : undefined);
      return {
        uid: u.uid,
        email: u.email || undefined,
        displayName: u.displayName || undefined,
        role,
      };
    });
    return NextResponse.json({ users, nextPageToken: res.pageToken || null });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
export const runtime = 'nodejs';
