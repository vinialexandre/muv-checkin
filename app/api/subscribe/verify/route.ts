import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

export async function POST(req: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json({ error: 'admin_sdk_nao_configurado' }, { status: 500 })
    }

    const { token } = await req.json()
    if (!token) {
      return NextResponse.json({ error: 'token_obrigatorio' }, { status: 400 })
    }

    const snap = await adminDb.collection('subscription_invites').doc(String(token)).get()
    if (!snap.exists) {
      return NextResponse.json({ ok: false, valid: false, error: 'convite_invalido' }, { status: 404 })
    }
    const data = snap.data() as any
    if (data?.disabled) {
      return NextResponse.json({ ok: false, valid: false, error: 'convite_desabilitado' }, { status: 410 })
    }

    const allowed = Array.isArray((data as any)?.allowedPlanIds) && (data as any).allowedPlanIds.length
      ? (data as any).allowedPlanIds
      : [String((data as any).planId)]
    const allowPlanChange = Boolean((data as any)?.allowPlanChange)

    // Buscar dados do aluno
    const studentId = String(data.studentId)
    const studentSnap = await adminDb.collection('students').doc(studentId).get()
    if (!studentSnap.exists) {
      return NextResponse.json({ ok: false, valid: false, error: 'aluno_nao_encontrado' }, { status: 404 })
    }
    const studentData = studentSnap.data() as any

    // Buscar dados dos planos
    const planDocs = await Promise.all(allowed.map((id: string) => adminDb.collection('plans').doc(id).get()))
    const plans = planDocs
      .map((snap, idx) => (snap.exists ? { id: allowed[idx], ...(snap.data() as any) } : null))
      .filter(Boolean)
    const filteredPlans = plans.filter((p: any) => p?.active !== false && String(p.planSyncStatus || '') === 'synced')

    return NextResponse.json({
      ok: true,
      valid: true,
      studentId: data.studentId,
      planId: data.planId,
      allowedPlanIds: allowed,
      allowPlanChange,
      studentData,
      plans: filteredPlans
    })
  } catch (e: any) {
    const message = typeof e?.message === 'string' ? e.message : 'erro_generico'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const runtime = 'nodejs'
