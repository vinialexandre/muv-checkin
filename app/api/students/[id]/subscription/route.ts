import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { findCustomerByExternalId, listSubscriptionsByCustomer, type PagarmeSubscription } from '@/lib/payments/pagarme'

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
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
    if (!customerId) return NextResponse.json({ ok: true, customerId: null, subscription: null })
    const subs = await listSubscriptionsByCustomer({ customerId, page: 1, size: 20 })
    const active = Array.isArray(subs) ? subs.find((s: PagarmeSubscription) => {
      const status = String(s.status || '').toLowerCase()
      return status !== 'canceled' && status !== 'failed'
    }) : undefined
    return NextResponse.json({ ok: true, customerId, subscription: active || null })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}

export const runtime = 'nodejs'

