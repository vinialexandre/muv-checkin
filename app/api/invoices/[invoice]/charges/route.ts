import { NextResponse } from 'next/server'
import { listChargesByInvoice } from '@/lib/payments/pagarme'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, context: { params: Promise<{ invoice: string }> }) {
  try {
    const { invoice } = await context.params
    if (!invoice) return NextResponse.json({ error: 'missing_invoice' }, { status: 400 })
    const charges = await listChargesByInvoice({ invoiceId: String(invoice) })
    return NextResponse.json({ ok: true, charges }, { status: 200 })
  } catch (e: any) {
    const msg = e?.message || 'failed'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

