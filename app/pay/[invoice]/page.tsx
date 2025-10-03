import { getInvoice, listChargesByInvoice, PagarmeCharge } from '@/lib/payments/pagarme'

function brl(amount: number) {
  try { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((amount||0)/100) } catch { return `${(amount||0)/100}` }
}

export default async function InvoicePage({ params }: { params: Promise<{ invoice: string }> }) {
  const { invoice: invoiceId } = await params
  const invoice = await getInvoice({ invoiceId })
  const charges = await listChargesByInvoice({ invoiceId })
  const charge = Array.isArray(charges) && charges.length ? charges[0] as PagarmeCharge : undefined
  const pix = charge?.payment_method === 'pix' ? charge?.last_transaction : undefined
  const boleto = charge?.payment_method === 'boleto' ? (charge?.last_transaction?.boleto ? charge?.last_transaction : undefined) : undefined

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <h1>Pagamento da Fatura</h1>
      <div>
        <div><strong>Fatura:</strong> {invoice.id}</div>
        <div><strong>Status:</strong> {invoice.status}</div>
        <div><strong>Valor:</strong> {brl(invoice.amount)}</div>
        {invoice.due_at ? <div><strong>Vencimento:</strong> {new Date(invoice.due_at).toLocaleString('pt-BR')}</div> : null}
      </div>

      {charge ? (
        <div style={{ marginTop: 24 }}>
          <h2>Método: {charge.payment_method}</h2>
          <div><strong>Status da cobrança:</strong> {charge.status}</div>
          {charge.paid_at ? <div><strong>Pago em:</strong> {new Date(charge.paid_at).toLocaleString('pt-BR')}</div> : null}

          {pix ? (
            <div style={{ marginTop: 16 }}>
              <h3>Pix</h3>
              {pix.qr_code_url ? (
                <div style={{ marginBottom: 8 }}>
                  <img src={pix.qr_code_url} alt="QR Pix" style={{ width: 240, height: 240 }} />
                </div>
              ) : null}
              {pix.qr_code ? (
                <div style={{ wordBreak: 'break-all' }}>
                  <strong>Pix copia e cola:</strong> {pix.qr_code}
                </div>
              ) : null}
              {pix.expires_at ? (
                <div>
                  <strong>Expira em:</strong> {new Date(pix.expires_at).toLocaleString('pt-BR')}
                </div>
              ) : null}
            </div>
          ) : null}

          {boleto ? (
            <div style={{ marginTop: 16 }}>
              <h3>Boleto</h3>
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
  )
}

