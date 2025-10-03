import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { findCustomerByExternalId, listSubscriptionsByCustomer, listInvoicesBySubscription } from '@/lib/payments/pagarme'

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    if (!adminDb) return NextResponse.json({ error: 'admin_sdk_nao_configurado' }, { status: 500 })
    const { id: studentId } = await context.params as any
    const url = new URL(req.url)
    const subIdParam = url.searchParams.get('subscriptionId')
    let subscriptionId = subIdParam ? String(subIdParam) : undefined

    if (!subscriptionId) {
      const snap = await adminDb.collection('students').doc(studentId).get()
      if (!snap.exists) return NextResponse.json({ error: 'aluno_nao_encontrado' }, { status: 404 })
      const data = snap.data() as any
      let customerId: string | undefined = data?.pagarmeCustomerId ? String(data.pagarmeCustomerId) : undefined
      if (!customerId) {
        const found = await findCustomerByExternalId({ externalId: studentId }).catch(() => undefined)
        customerId = found?.id
      }
      if (!customerId) return NextResponse.json({ ok: true, invoices: [] })
      const subs = await listSubscriptionsByCustomer({ customerId, page: 1, size: 20 })
      const active = Array.isArray(subs) ? subs.find((s) => String((s as any).status || '').toLowerCase() !== 'canceled') : undefined
      subscriptionId = active?.id
    }

    if (!subscriptionId) return NextResponse.json({ ok: true, invoices: [] })

    const page = Number(url.searchParams.get('page') || '1') || 1
    const size = Number(url.searchParams.get('size') || '20') || 20
    const invoices = await listInvoicesBySubscription({ subscriptionId, page, size })
    return NextResponse.json({ ok: true, invoices })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}

export const runtime = 'nodejs'

