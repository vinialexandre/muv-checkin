"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import PixActions from './PixActions'
import RefreshButton from './RefreshButton'
import { useRouter } from 'next/navigation'

type Charge = {
  id?: string
  payment_method?: string
  last_transaction?: { qr_code?: string; qr_code_url?: string; expires_at?: string }
  status?: string
}

export default function PixLive({ invoiceId, initialQr, initialCode, initialExpiresAt }: { invoiceId: string; initialQr?: string; initialCode?: string; initialExpiresAt?: string }) {
  const router = useRouter()
  const [isIssuing, startTransition] = useTransition()
  const [qrUrl, setQrUrl] = useState<string | undefined>(initialQr)
  const [code, setCode] = useState<string | undefined>(initialCode)
  const [expiresAt, setExpiresAt] = useState<string | undefined>(initialExpiresAt)

  function normalizeTx(tx: any) {
    if (!tx) return { url: undefined, code: undefined, exp: undefined }
    let url: string | undefined = tx?.qr_code_url || tx?.pix?.qr_code_url || tx?.qr_code_image || tx?.qr_code_base64
    const code = tx?.qr_code || tx?.pix?.qr_code || tx?.copy_paste || tx?.emv || tx?.emvqrcps
    const exp = tx?.expires_at || tx?.pix?.expires_at
    if (url && !/^https?:\/\//i.test(url) && !/^data:/i.test(url) && url.length > 100) {
      url = `data:image/png;base64,${url}`
    }
    return { url, code, exp }
  }

  const hasPix = useMemo(() => Boolean(qrUrl || code), [qrUrl, code])

  useEffect(() => {
    let timer: any
    let cancelled = false

    async function fetchOnce() {
      try {
        const res = await fetch(`/api/invoices/${invoiceId}/charges`, { cache: 'no-store' })
        const json = await res.json().catch(() => ({}))
        const list: Charge[] = Array.isArray(json?.charges) ? json.charges : []
        const cashList = list.filter((c) => c?.payment_method === 'pix' || c?.payment_method === 'cash')
        const charge = cashList.find((c) => c?.status === 'pending') || cashList[0]
        const tx = charge?.last_transaction
        let norm = normalizeTx(tx)
        if ((!norm.url && !norm.code) && charge?.id) {
          try {
            const detailRes = await fetch(`/api/charges/${charge.id}`, { cache: 'no-store' })
            const detailJson = await detailRes.json().catch(() => ({}))
            const dtx = detailJson?.charge?.last_transaction
            norm = normalizeTx(dtx)
            if ((!norm.url && !norm.code) && dtx?.id) {
              try {
                const txRes = await fetch(`/api/transactions/${dtx.id}`, { cache: 'no-store' })
                const txJson = await txRes.json().catch(() => ({}))
                norm = normalizeTx(txJson?.transaction)
              } catch {}
            }
          } catch {}
        }
        if (norm.url || norm.code) {
          if (!cancelled) {
            setQrUrl(norm.url)
            setCode(norm.code)
            setExpiresAt(norm.exp)
          }
        }
      } catch {}
    }

    // se não temos dados ainda, poll até aparecer (por até ~60s)
    if (!hasPix) {
      fetchOnce()
      timer = setInterval(fetchOnce, 3000)
    }

    // parar após 60s para evitar polling infinito
    const stop = setTimeout(() => { if (timer) clearInterval(timer) }, 60000)

    return () => { cancelled = true; if (timer) clearInterval(timer); clearTimeout(stop) }
  }, [invoiceId, hasPix])

  return (
    <div style={{ marginTop: 16 }}>
      {!qrUrl && !code ? (
        <div>
          <div style={{ marginBottom: 8 }}>Gerando QR do Pix... aguarde alguns segundos.</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <RefreshButton />
            <button
              onClick={() => startTransition(async () => { await fetch(`/api/invoices/${invoiceId}/reissue-pix`, { method: 'POST', cache: 'no-store' }); router.refresh() })}
              disabled={isIssuing}
              style={{ padding: '10px 14px', cursor: 'pointer', border: '1px solid #cbd5e1', borderRadius: 8, backgroundColor: '#f1f5f9', color: '#0f172a', fontWeight: 600, marginTop: 12, opacity: isIssuing ? 0.7 : 1 }}
              aria-label="Gerar QR do Pix"
            >
              {isIssuing ? 'Gerando...' : 'Gerar QR do Pix'}
            </button>
          </div>
        </div>
      ) : null}

      {qrUrl ? (
        <div style={{ marginBottom: 8 }}>
          <img src={qrUrl} alt="QR Pix" style={{ width: 240, height: 240 }} />
        </div>
      ) : null}
      {code ? (
        <div style={{ wordBreak: 'break-all' }}>
          <strong>Pix copia e cola:</strong> {code}
          <PixActions code={code} />
        </div>
      ) : null}
      {expiresAt ? (
        <div>
          <strong>Expira em:</strong> {new Date(expiresAt).toLocaleString('pt-BR')}
        </div>
      ) : null}
    </div>
  )
}

