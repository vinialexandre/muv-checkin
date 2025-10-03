import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { findCustomerByExternalId, listSubscriptionsByCustomer, reactivateSubscription } from '@/lib/payments/pagarme'

export async function POST(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    if (!adminDb) return NextResponse.json({ error: 'admin_sdk_nao_configurado' }, { status: 500 })
    const { id: studentId } = await context.params as any

    const snap = await adminDb.collection('students').doc(studentId).get()
    if (!snap.exists) return NextResponse.json({ error: 'aluno_nao_encontrado' }, { status: 404 })
    const data = snap.data() as any

    let customerId: string | undefined = data?.pagarmeCustomerId ? String(data.pagarmeCustomerId) : undefined
    if (!customerId) {
      const found = await findCustomerByExternalId({ externalId: studentId }).catch(() => undefined)
      customerId = found?.id
    }
    if (!customerId) return NextResponse.json({ error: 'cliente_nao_encontrado' }, { status: 404 })

    const subs = await listSubscriptionsByCustomer({ customerId, page: 1, size: 20 })
    const canceled = Array.isArray(subs) ? subs.find((s) => String((s as any).status || '').toLowerCase() === 'canceled') : undefined
    if (!canceled?.id) return NextResponse.json({ error: 'assinatura_cancelada_nao_encontrada' }, { status: 404 })

    const out = await reactivateSubscription({ subscriptionId: canceled.id })
    return NextResponse.json({ ok: out.reactivated })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}

export const runtime = 'nodejs'

