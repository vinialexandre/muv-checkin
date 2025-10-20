import { getInvoice, listChargesByInvoice, PagarmeCharge } from '@/lib/payments/pagarme'
import PixActions from './PixActions'
import RefreshButton from './RefreshButton'
import PixLive from './PixLive'

function brl(amount: number) {
  try { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((amount||0)/100) } catch { return `${(amount||0)/100}` }
}

export default async function InvoicePage({ params }: { params: Promise<{ invoice: string }> }) {
  const { invoice: invoiceId } = await params
  const invoice = await getInvoice({ invoiceId })
  const charges = await listChargesByInvoice({ invoiceId })
  const charge = Array.isArray(charges) && charges.length ? charges[0] as PagarmeCharge : undefined
  const isPix = charge?.payment_method === 'pix' || charge?.payment_method === 'cash'
  const rawTx: any = isPix ? (charge as any)?.last_transaction : undefined
  const rawNorm = rawTx ? {
    qr_code_url: rawTx?.qr_code_url || rawTx?.pix?.qr_code_url || rawTx?.qr_code_base64 || rawTx?.qr_code_image,
    qr_code: rawTx?.qr_code || rawTx?.pix?.qr_code || rawTx?.copy_paste || rawTx?.emv || rawTx?.emvqrcps,
    expires_at: rawTx?.expires_at || rawTx?.pix?.expires_at
  } : undefined
  const pix = rawNorm && (rawNorm.qr_code_url || rawNorm.qr_code) ? rawNorm : undefined
  const boleto = charge?.payment_method === 'boleto' ? (charge?.last_transaction?.boleto ? charge?.last_transaction : undefined) : undefined

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 720, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, boxShadow: '0 1px 2px rgba(16,24,40,.05)', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h1 style={{ margin: 0, fontSize: 22 }}>Pagamento da Fatura</h1>
          <RefreshButton />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div><strong>Fatura:</strong> {invoice.id}</div>
          <div><strong>Status:</strong> {invoice.status}</div>
          <div><strong>Valor:</strong> {brl(invoice.amount)}</div>
          {invoice.due_at ? <div><strong>Vencimento:</strong> {new Date(invoice.due_at).toLocaleString('pt-BR')}</div> : <div />}
        </div>

        {charge ? (
          <div style={{ marginTop: 24 }}>
            <div style={{ marginBottom: 8 }}>
              <strong>Método:</strong> {isPix ? 'PIX' : (charge.payment_method || '-')}
            </div>
            <div><strong>Status da cobrança:</strong> {charge.status}</div>
            {charge.paid_at ? <div><strong>Pago em:</strong> {new Date(charge.paid_at).toLocaleString('pt-BR')}</div> : null}

            {isPix ? (
              <div style={{ marginTop: 16, padding: 16, border: '1px dashed #cbd5e1', borderRadius: 10, background: '#f8fafc' }}>
                <h3 style={{ marginTop: 0 }}>Pix</h3>
                {pix ? (
                  <>
                    {pix.qr_code_url ? (
                      <div style={{ marginBottom: 8 }}>
                        <img src={pix.qr_code_url} alt="QR Pix" style={{ width: 240, height: 240 }} />
                      </div>
                    ) : null}
                    {pix.qr_code ? (
                      <div style={{ wordBreak: 'break-all' }}>
                        <strong>Pix copia e cola:</strong> {pix.qr_code}
                        <PixActions code={pix.qr_code} />
                      </div>
                    ) : null}
                    {pix.expires_at ? (
                      <div>
                        <strong>Expira em:</strong> {new Date(pix.expires_at).toLocaleString('pt-BR')}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <PixLive invoiceId={invoiceId} />
                )}
              </div>
            ) : null}

            {boleto ? (
              <div style={{ marginTop: 16, padding: 16, border: '1px dashed #cbd5e1', borderRadius: 10, background: '#f8fafc' }}>
                <h3 style={{ marginTop: 0 }}>Boleto</h3>
                {boleto.boleto?.pdf ? <div><a href={boleto.boleto.pdf} target="_blank">Abrir PDF</a></div> : null}
                {boleto.boleto?.line ? <div style={{ wordBreak: 'break-all' }}><strong>Linha digitável:</strong> {boleto.boleto.line}</div> : null}
                {boleto.boleto?.barcode ? <div style={{ wordBreak: 'break-all' }}><strong>Código de barras:</strong> {boleto.boleto.barcode}</div> : null}
                {boleto.boleto?.expires_at ? <div><strong>Vencimento:</strong> {new Date(boleto.boleto.expires_at).toLocaleString('pt-BR')}</div> : null}
              </div>
            ) : null}
          </div>
        ) : (
          <div style={{ marginTop: 24 }}>
            <em>Nenhuma cobrança encontrada para esta fatura.</em>
          </div>
        )}
      </div>
    </div>
  )
}

