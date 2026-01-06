import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { createDiscount, removeDiscount } from '@/lib/payments/pagarme'

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    if (!adminDb) return NextResponse.json({ error: 'admin_sdk_nao_configurado' }, { status: 500 })

    const { id: studentId } = await context.params as any
    const body = await req.json().catch(() => ({}))
    const { value } = body

    if (!value || typeof value !== 'number' || value <= 0 || value > 100) {
      return NextResponse.json({ error: 'valor_desconto_invalido' }, { status: 400 })
    }

    const snap = await adminDb.collection('students').doc(studentId).get()
    if (!snap.exists) return NextResponse.json({ error: 'aluno_nao_encontrado' }, { status: 404 })

    const student = snap.data() as any
    const subscriptionId = student?.pagarmeSubscriptionId

    if (!subscriptionId) {
      return NextResponse.json({ error: 'aluno_sem_assinatura' }, { status: 400 })
    }

    const created = await createDiscount({
      subscriptionId,
      value,
      type: 'percentage',
    })

    return NextResponse.json({ ok: true, discountId: created.discountId, value: created.value })
  } catch (e: any) {
    console.error('[subscription/discount POST] Erro:', e?.message || e)
    const message = typeof e?.message === 'string' ? e.message : 'erro_generico'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    if (!adminDb) return NextResponse.json({ error: 'admin_sdk_nao_configurado' }, { status: 500 })

    const { id: studentId } = await context.params as any
    const body = await req.json().catch(() => ({}))
    const { discountId } = body

    if (!discountId) {
      return NextResponse.json({ error: 'discount_id_obrigatorio' }, { status: 400 })
    }

    const snap = await adminDb.collection('students').doc(studentId).get()
    if (!snap.exists) return NextResponse.json({ error: 'aluno_nao_encontrado' }, { status: 404 })

    const student = snap.data() as any
    const subscriptionId = student?.pagarmeSubscriptionId

    if (!subscriptionId) {
      return NextResponse.json({ error: 'aluno_sem_assinatura' }, { status: 400 })
    }

    await removeDiscount({ subscriptionId, discountId })
    return NextResponse.json({ ok: true, removed: true })
  } catch (e: any) {
    console.error('[subscription/discount DELETE] Erro:', e?.message || e)
    const message = typeof e?.message === 'string' ? e.message : 'erro_generico'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

