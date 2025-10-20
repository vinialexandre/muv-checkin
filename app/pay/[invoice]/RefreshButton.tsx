"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"

export default function RefreshButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  return (
    <button
      onClick={() => startTransition(() => router.refresh())}
      disabled={isPending}
      style={{
        padding: '10px 14px',
        cursor: 'pointer',
        border: '1px solid #cbd5e1',
        borderRadius: 8,
        backgroundColor: '#f8fafc',
        color: '#0f172a',
        fontWeight: 600,
        marginTop: 12,
        opacity: isPending ? 0.7 : 1,
      }}
      aria-label="Atualizar status"
    >
      {isPending ? 'Atualizando...' : 'Atualizar status'}
    </button>
  )
}

