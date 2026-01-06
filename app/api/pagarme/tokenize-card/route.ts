import { NextRequest, NextResponse } from 'next/server'
import { tokenizeCard } from '@/lib/payments/pagarme'

const onlyDigits = (value?: string) => String(value || '').replace(/\D/g, '')

const maskCardNumber = (value?: string) => {
  const digits = onlyDigits(value)
  if (!digits) return ''
  const last4 = digits.slice(-4)
  const prefix = ''.padStart(Math.max(digits.length - 4, 0), '*')
  return prefix + last4
}

const maskCvv = (value?: string) => {
  const length = String(value || '').length
  if (!length) return ''
  return ''.padStart(length, '*')
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => undefined)) as {
      number?: string
      holder?: string
      exp?: string
      cvv?: string
    } | undefined

    if (!body) {
      console.error('[api/pagarme/tokenize-card] payload ausente ou invalido')
      return NextResponse.json({ error: 'payload_invalido' }, { status: 400 })
    }

    const { number, holder, exp, cvv } = body

    console.log('[api/pagarme/tokenize-card] payload recebido', {
      hasNumber: !!number,
      hasHolder: !!holder,
      hasExp: !!exp,
      hasCvv: !!cvv,
    })

    if (!number || !holder || !exp || !cvv) {
      console.error('[api/pagarme/tokenize-card] dados do cartao incompletos', {
        hasNumber: !!number,
        hasHolder: !!holder,
        hasExp: !!exp,
        hasCvv: !!cvv,
      })
      return NextResponse.json({ error: 'dados_cartao_incompletos' }, { status: 400 })
    }

    const num = onlyDigits(number)
    const cleanCvv = onlyDigits(cvv)
    const [mmRaw, yyRaw] = String(exp || '').split('/')
    const expMonth = onlyDigits(mmRaw || '').padStart(2, '0').slice(0, 2)
    const yy = onlyDigits(yyRaw || '').slice(-2)
    const yearPrefix = Number(yy) <= 79 ? '20' : '19'
    const expYear = yearPrefix + yy

    console.log('[api/pagarme/tokenize-card] expiracao interpretada', {
      rawExp: exp,
      mmRaw,
      yyRaw,
      expMonth,
      expYear,
    })

    const maskedNumber = maskCardNumber(number)
    const maskedCvv = maskCvv(cvv)

    console.log('[api/pagarme/tokenize-card] chamando tokenizeCard', {
      holder,
      numberMasked: maskedNumber,
      cvvMasked: maskedCvv,
      expMonth,
      expYear,
    })

    const result = await tokenizeCard({
      number: num,
      holder,
      expMonth,
      expYear,
      cvv: cleanCvv,
    })

    console.log('[api/pagarme/tokenize-card] token gerado com sucesso', {
      tokenId: result.id,
    })

    return NextResponse.json({ ok: true, token: result.id })
  } catch (e: any) {
    const message = typeof e?.message === 'string' ? e.message : 'erro_generico'
    console.error('[api/pagarme/tokenize-card] erro ao tokenizar cartao', {
      errorMessage: message,
      errorStack: e?.stack,
    })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const runtime = 'nodejs'

