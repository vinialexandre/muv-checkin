import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    if (!adminDb) return NextResponse.json({ error: 'Admin SDK não configurado' }, { status: 500 })
    const body = await req.json()
    const studentId = String(body?.studentId || '')
    const planId = String(body?.planId || '')
    const allowPlanChange = Boolean(body?.allowPlanChange)
    const inputAllowed: unknown = body?.allowedPlanIds
    const allowedPlanIds = Array.isArray(inputAllowed)
      ? Array.from(new Set(inputAllowed.map((x: any) => String(x)).filter(Boolean)))
      : []

    if (!studentId || !planId) {
      return NextResponse.json({ error: 'studentId e planId são obrigatórios' }, { status: 400 })
    }

    const finalAllowed = allowedPlanIds.length ? allowedPlanIds : [planId]

    const token = crypto.randomUUID().replace(/-/g, '')
    const docRef = adminDb.collection('subscription_invites').doc(token)
    await docRef.set({
      token,
      studentId,
      planId,
      allowedPlanIds: finalAllowed,
      allowPlanChange,
      createdAt: new Date().toISOString(),
      disabled: false,
    })

    const urlPath = `/subscribe/${token}`
    return NextResponse.json({ ok: true, token, urlPath })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
export const runtime = 'nodejs'

