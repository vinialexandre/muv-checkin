import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase-admin'

export async function POST(req: NextRequest) {
  try {
    if (!adminAuth || !adminDb) {
      return NextResponse.json({ error: 'Admin SDK não configurado' }, { status: 500 })
    }

    const body = await req.json().catch(() => ({} as any))
    const email = String(body?.email || '').trim().toLowerCase()
    const password = String(body?.password || '').trim()
    const name = String(body?.name || '').trim()
    const studentId = String(body?.studentId || '').trim()

    if (!email || !password) {
      return NextResponse.json({ error: 'email e password são obrigatórios' }, { status: 400 })
    }

    let user
    try {
      const existing = await adminAuth.getUserByEmail(email)
      user = await adminAuth.updateUser(existing.uid, {
        password,
        displayName: name || existing.displayName || undefined,
      })
    } catch {
      user = await adminAuth.createUser({
        email,
        password,
        displayName: name || undefined,
        emailVerified: false,
      })
    }

    try {
      await adminAuth.setCustomUserClaims(user.uid, { student: true })
    } catch {}

    try {
      if (studentId) {
        const dataToSet: any = { authUid: user.uid, uid: user.uid, email }
        if (password) dataToSet.password = password
        await adminDb.collection('students').doc(studentId).set(dataToSet, { merge: true })
      }
    } catch {}

    return NextResponse.json({ ok: true, uid: user.uid })
  } catch (error: any) {
    return NextResponse.json({ error: String(error?.message || error) }, { status: 500 })
  }
}


