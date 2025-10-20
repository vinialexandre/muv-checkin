import { NextResponse } from 'next/server'
import { getTransaction } from '@/lib/payments/pagarme'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, context: { params: Promise<{ transaction: string }> }) {
  try {
    const { transaction } = await context.params
    if (!transaction) return NextResponse.json({ error: 'missing_transaction' }, { status: 400 })
    const data = await getTransaction({ transactionId: String(transaction) })
    return NextResponse.json({ ok: true, transaction: data }, { status: 200 })
  } catch (e: any) {
    const msg = e?.message || 'failed'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

