export interface CreateDiscountRequest {
  value: number
}

export interface CreateDiscountResponse {
  ok: boolean
  discountId: string
  value: number
}

export interface RemoveDiscountRequest {
  discountId: string
}

export interface RemoveDiscountResponse {
  ok: boolean
  removed: boolean
}

export class DiscountAPI {
  private baseUrl: string

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl
  }

  async createDiscount(studentId: string, value: number): Promise<CreateDiscountResponse> {
    const response = await fetch(`${this.baseUrl}/api/students/${studentId}/subscription/discount`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    })
    if (!response.ok) throw new Error(`Erro ao criar desconto: ${response.statusText}`)
    return response.json()
  }

  async removeDiscount(studentId: string, discountId: string): Promise<RemoveDiscountResponse> {
    const response = await fetch(`${this.baseUrl}/api/students/${studentId}/subscription/discount`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discountId }),
    })
    if (!response.ok) throw new Error(`Erro ao remover desconto: ${response.statusText}`)
    return response.json()
  }
}

