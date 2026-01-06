import { NextRequest, NextResponse } from 'next/server'
import { tokenizeCard } from '@/lib/payments/pagarme'

const onlyDigits = (value?: string) => String(value || '').replace(/\D/g, '')

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => undefined)) as {
      number?: string
      holder?: string
      exp?: string
      cvv?: string
    } | undefined

    if (!body) {
      return NextResponse.json({ error: 'payload_invalido' }, { status: 400 })
    }

    const { number, holder, exp, cvv } = body

    if (!number || !holder || !exp || !cvv) {
      return NextResponse.json({ error: 'dados_cartao_incompletos' }, { status: 400 })
    }

    const num = onlyDigits(number)
    const cleanCvv = onlyDigits(cvv)
    const [mmRaw, yyRaw] = String(exp || '').split('/')
    const expMonth = onlyDigits(mmRaw || '').padStart(2, '0').slice(0, 2)
    const yy = onlyDigits(yyRaw || '').slice(-2)
    const yearPrefix = Number(yy) <= 79 ? '20' : '19'
    const expYear = yearPrefix + yy

    const result = await tokenizeCard({
      number: num,
      holder,
      expMonth,
      expYear,
      cvv: cleanCvv,
    })

    return NextResponse.json({ ok: true, token: result.id })
  } catch (e: any) {
    const message = typeof e?.message === 'string' ? e.message : 'erro_generico'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const runtime = 'nodejs'

