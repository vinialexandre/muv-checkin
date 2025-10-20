import { NextResponse } from 'next/server'
import { reissuePix } from '@/lib/payments/pagarme'

export const dynamic = 'force-dynamic'

export async function POST(_req: Request, context: { params: Promise<{ invoice: string }> }) {
  try {
    const { invoice } = await context.params
    if (!invoice) return NextResponse.json({ error: 'missing_invoice' }, { status: 400 })
    const res = await reissuePix({ invoiceId: String(invoice) })
    return NextResponse.json({ ok: true, result: res }, { status: 200 })
  } catch (e: any) {
    const msg = e?.message || 'failed'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

