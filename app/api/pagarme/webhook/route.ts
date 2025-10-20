import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { getInvoice } from '@/lib/payments/pagarme'

export async function POST(req: NextRequest) {
  try {
    if (!adminDb) {
      return NextResponse.json({ error: 'admin_sdk_nao_configurado' }, { status: 500 })
    }

    const body = await req.json().catch(() => undefined as any)
    if (!body) {
      return NextResponse.json({ error: 'payload_invalido' }, { status: 400 })
    }

    const eventType: string = String(body.type || body.event || '')

    let subscriptionId: string | undefined

    if (eventType.startsWith('invoice.')) {
      const invoiceId: string | undefined = body?.data?.id || body?.invoice?.id || body?.data?.object?.id
      if (invoiceId) {
        const invoice = await getInvoice({ invoiceId }).catch(() => undefined as any)
        const fromInvoice = (invoice as any)?.subscription?.id || (invoice as any)?.subscription_id
        const fromBody = body?.data?.subscription_id || body?.subscription?.id
        subscriptionId = String(fromInvoice || fromBody || '') || undefined
      }
    } else if (eventType.startsWith('subscription.')) {
      subscriptionId = String(body?.data?.id || body?.subscription?.id || body?.data?.object?.id || '') || undefined
    } else if (eventType === 'charge.failed') {
      const invoiceId: string | undefined = body?.data?.invoice?.id || body?.data?.invoice_id
      if (invoiceId) {
        const invoice = await getInvoice({ invoiceId }).catch(() => undefined as any)
        subscriptionId = (invoice as any)?.subscription?.id || (invoice as any)?.subscription_id
      }
    }

    if (!subscriptionId) {
      return NextResponse.json({ ok: true, ignored: true })
    }

    const studentsRef = adminDb.collection('students')
    const snap = await studentsRef.where('pagarmeSubscriptionId', '==', String(subscriptionId)).limit(1).get()
    if (snap.empty) {
      return NextResponse.json({ ok: true, notFound: true })
    }

    const doc = snap.docs[0]

    let newStatus: 'paid' | 'overdue' | 'canceled' | undefined
    if (eventType === 'invoice.paid') newStatus = 'paid'
    else if (eventType.includes('invoice.') && eventType.includes('overdue')) newStatus = 'overdue'
    else if (eventType === 'charge.failed') newStatus = 'overdue'
    else if (eventType === 'subscription.canceled') newStatus = 'canceled'

    if (!newStatus) {
      return NextResponse.json({ ok: true, ignored: true })
    }

    await doc.ref.update({ paymentStatus: newStatus, updatedAt: new Date().toISOString() })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: typeof e?.message === 'string' ? e.message : 'erro_generico' }, { status: 500 })
  }
}

export const runtime = 'nodejs'
