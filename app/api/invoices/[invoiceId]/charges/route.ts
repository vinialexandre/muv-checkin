import { NextRequest, NextResponse } from 'next/server'
import { listChargesByInvoice } from '@/lib/payments/pagarme'

export async function GET(_req: NextRequest, context: { params: Promise<{ invoiceId: string }> }) {
  try {
    const { invoiceId } = await context.params as any
    const charges = await listChargesByInvoice({ invoiceId, page: 1, size: 50 })
    return NextResponse.json({ ok: true, charges })
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}

export const runtime = 'nodejs'

