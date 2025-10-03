import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { findCustomerByExternalId, listSubscriptionsByCustomer, changeSubscriptionPlan } from '@/lib/payments/pagarme'

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    if (!adminDb) return NextResponse.json({ error: 'admin_sdk_nao_configurado' }, { status: 500 })
    const { id: studentId } = await context.params as any
    const body = await req.json().catch(() => ({} as any))
    const planDocId = String(body?.newPlanId || '')
    if (!planDocId) return NextResponse.json({ error: 'novo_plano_obrigatorio' }, { status: 400 })

    const planSnap = await adminDb.collection('plans').doc(planDocId).get()
    if (!planSnap.exists) return NextResponse.json({ error: 'plano_nao_encontrado' }, { status: 404 })
    const plan = planSnap.data() as any
    const pagarmePlanId = String(plan?.pagarmePlanId || '')
    if (!pagarmePlanId) return NextResponse.json({ error: 'plano_sem_pagarme_plan_id' }, { status: 400 })

    const studentSnap = await adminDb.collection('students').doc(studentId).get()
    if (!studentSnap.exists) return NextResponse.json({ error: 'aluno_nao_encontrado' }, { status: 404 })
    const student = studentSnap.data() as any

    let customerId: string | undefined = student?.pagarmeCustomerId ? String(student.pagarmeCustomerId) : undefined
    if (!customerId) {
      const found = await findCustomerByExternalId({ externalId: studentId }).catch(() => undefined)
      customerId = found?.id
    }
    if (!customerId) return NextResponse.json({ error: 'cliente_nao_encontrado' }, { status: 404 })

    const subs = await listSubscriptionsByCustomer({ customerId, page: 1, size: 20 })
    const active = Array.isArray(subs) ? subs.find((s) => String((s as any).status || '').toLowerCase() !== 'canceled') : undefined
    const subscriptionId = active?.id
    if (!subscriptionId) return NextResponse.json({ error: 'assinatura_nao_encontrada' }, { status: 404 })

    const out = await changeSubscriptionPlan({ subscriptionId, planId: pagarmePlanId })
    return NextResponse.json({ ok: out.changed })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}

export const runtime = 'nodejs'

