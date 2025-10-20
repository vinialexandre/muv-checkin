"use client"

import { useState } from "react"

export default function PixActions({ code }: { code?: string }) {
  const [copied, setCopied] = useState(false)
  if (!code) return null

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code!)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  function handleRefresh() {
    try { window.location.reload() } catch {}
  }

  return (
    <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
      <button
        onClick={handleCopy}
        style={{
          padding: '10px 14px',
          cursor: 'pointer',
          border: 'none',
          borderRadius: 8,
          backgroundColor: copied ? '#16a34a' : '#2563eb',
          color: '#fff',
          fontWeight: 600,
        }}
        aria-label="Copiar código Pix"
      >
        {copied ? 'Copiado!' : 'Copiar código Pix'}
      </button>
      <button
        onClick={handleRefresh}
        style={{
          padding: '10px 14px',
          cursor: 'pointer',
          border: '1px solid #cbd5e1',
          borderRadius: 8,
          backgroundColor: '#f8fafc',
          color: '#0f172a',
          fontWeight: 600,
        }}
        aria-label="Atualizar status"
      >
        Atualizar status
      </button>
    </div>
  )
}

