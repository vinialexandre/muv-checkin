import { NextResponse } from 'next/server'
import { getCharge } from '@/lib/payments/pagarme'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, context: { params: Promise<{ charge: string }> }) {
  try {
    const { charge } = await context.params
    if (!charge) return NextResponse.json({ error: 'missing_charge' }, { status: 400 })
    const data = await getCharge({ chargeId: String(charge) })
    return NextResponse.json({ ok: true, charge: data }, { status: 200 })
  } catch (e: any) {
    const msg = e?.message || 'failed'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}

