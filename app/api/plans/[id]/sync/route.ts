import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'

import { adminDb } from '@/lib/firebase-admin'
import { upsertPlan } from '@/lib/payments/pagarme'

const VALID_INTERVALS = new Set(['day', 'week', 'month', 'year'])
const VALID_METHODS = new Set(['credit_card', 'pix', 'boleto'])


export async function POST(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!adminDb) {
    return NextResponse.json({ error: 'admin_sdk_nao_configurado' }, { status: 500 })
  }

  const { id: planId } = await context.params as any
  if (!planId) {
    return NextResponse.json({ error: 'plan_id_obrigatorio' }, { status: 400 })
  }

  const ref = adminDb.collection('plans').doc(planId)
  const snap = await ref.get()
  if (!snap.exists) {
    return NextResponse.json({ error: 'plano_nao_encontrado' }, { status: 404 })
  }

  const plan = snap.data() as any

  const paymentMethods = Array.isArray(plan?.paymentMethods)
    ? (plan.paymentMethods.filter((m: unknown) => typeof m === 'string' && VALID_METHODS.has(m)) as Array<'credit_card'|'pix'|'boleto'>)
    : []
  if (!paymentMethods.length) {
    return NextResponse.json({ error: 'plano_sem_metodos_pagamento' }, { status: 400 })
  }

  const priceNumber = Number(plan?.price)
  if (!Number.isFinite(priceNumber) || priceNumber <= 0) {
    return NextResponse.json({ error: 'plano_sem_preco_valido' }, { status: 400 })
  }
  const amountCents = Math.round(priceNumber * 100)

  const interval = typeof plan?.billingInterval === 'string' ? plan.billingInterval : 'month'
  if (!VALID_INTERVALS.has(interval)) {
    return NextResponse.json({ error: 'plano_intervalo_invalido' }, { status: 400 })
  }

  const intervalCount = Number(plan?.billingIntervalCount ?? 1)
  if (!Number.isInteger(intervalCount) || intervalCount <= 0) {
    return NextResponse.json({ error: 'plano_intervalo_count_invalido' }, { status: 400 })
  }

  const billingCycles = typeof plan?.billingCycles === 'number' && Number.isInteger(plan.billingCycles) && plan.billingCycles > 0
    ? plan.billingCycles
    : null

  try {
    await ref.update({
      planSyncStatus: 'pending',
      planSyncError: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    })
  } catch (e) {
    console.warn('plan_sync_pending_update_failed', e)
  }

  try {
    const result = await upsertPlan({
      pagarmePlanId: typeof plan?.pagarmePlanId === 'string' && plan.pagarmePlanId ? plan.pagarmePlanId : undefined,
      name: typeof plan?.name === 'string' && plan.name.trim() ? plan.name : `Plano ${planId}`,
      amount: amountCents,
      interval: interval as 'day'|'week'|'month'|'year',
      intervalCount,
      paymentMethods,
      billingCycles,
      metadata: { firebase_plan_id: planId },
      status: plan?.active === false ? 'inactive' : 'active',
    })

    await ref.update({
      pagarmePlanId: result.planId,
      planSyncStatus: 'synced',
      planSyncError: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    })

    return NextResponse.json({ ok: true, pagarmePlanId: result.planId })
  } catch (error: any) {
    const message = typeof error?.message === 'string' ? error.message : 'erro_sincronizar_plano'
    try {
      await ref.update({
        planSyncStatus: 'error',
        planSyncError: message,
        updatedAt: FieldValue.serverTimestamp(),
      })
    } catch (updateError) {
      console.error('plan_sync_error_update_failed', updateError)
    }
    console.error('plan_sync_failed', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
export const runtime = 'nodejs'
