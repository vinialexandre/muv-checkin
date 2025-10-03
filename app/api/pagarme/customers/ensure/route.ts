import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    return NextResponse.json({ ok: false, error: 'not_implemented' }, { status: 501 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
export const runtime = 'nodejs'

