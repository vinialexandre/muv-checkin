'use client'

import { useState } from 'react'

export default function SubscribePage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()

  async function handleStart() {
    setLoading(true)
    setError(undefined)
    setLoading(false)
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Assinar</h1>
      <p>Fluxo de assinatura</p>
      <button onClick={handleStart} disabled={loading}>Continuar</button>
      {error ? <p>{error}</p> : null}
    </div>
  )
}

