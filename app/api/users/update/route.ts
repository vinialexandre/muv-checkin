export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

function normUsername(v: string) { return String(v||'').trim().toLowerCase(); }

export async function POST(req: NextRequest) {
  try {
    if (!adminAuth || !adminDb) return NextResponse.json({ error: 'Admin SDK not configured' }, { status: 500 });
    const { uid, displayName, role, active, username, password, email } = await req.json();
    if (!uid) return NextResponse.json({ error: 'uid required' }, { status: 400 });

    if (displayName !== undefined) await adminAuth.updateUser(uid, { displayName });
    if (password) await adminAuth.updateUser(uid, { password });
    if (email !== undefined && String(email).trim()) await adminAuth.updateUser(uid, { email: String(email).trim() });


    const u = await adminAuth.getUser(uid);
    const prev = (u.customClaims as any) || {};
    const newClaims: any = { ...prev };
    if (role !== undefined) newClaims.role = role;
    if (active !== undefined) newClaims.active = !!active;

    // username update
    if (username !== undefined) {
      const prevUsername = typeof prev.username === 'string' ? prev.username : undefined;
      const uname = normUsername(username);
      if (!uname) return NextResponse.json({ error: 'username obrigat0rio' }, { status: 400 });
      if (uname !== prevUsername) {
        const unameRef = adminDb.collection('usernames').doc(uname);
        const exists = await unameRef.get();
        if (exists.exists) return NextResponse.json({ error: 'Nome de usu0rio j0 est1 em uso' }, { status: 400 });
        await unameRef.set({ uid, email: (email ?? u.email), username: uname });
        if (prevUsername) {
          await adminDb.collection('usernames').doc(prevUsername).delete().catch(()=>{});
        }
        newClaims.username = uname;

      }
    }

    if (email !== undefined && String(email).trim()) {
      const prevUsername2 = typeof prev.username === 'string' ? prev.username : undefined;
      if (prevUsername2) {
        await adminDb.collection('usernames').doc(prevUsername2).set({ uid, email: String(email).trim(), username: prevUsername2 }, { merge: true });
      }
    }

    // only write claims if changed
    if (
      newClaims.role !== prev.role ||
      newClaims.active !== prev.active ||
      newClaims.username !== prev.username

    ) {
      await adminAuth.setCustomUserClaims(uid, newClaims);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
