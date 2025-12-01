import { NextRequest, NextResponse } from 'next/server'

export async function POST(_req: NextRequest, _context: { params: Promise<{ id: string }> }) {
	  return NextResponse.json({ error: 'troca_de_plano_desativada' }, { status: 400 })
}

export const runtime = 'nodejs'

