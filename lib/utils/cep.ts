export type CepAddress = {
  cep: string;
  street: string;
  district: string;
  city: string;
  state: string;
  country: string;
};

export type CepLookupResult = {
  ok: boolean;
  address?: CepAddress;
};

export async function fetchCepAddress(raw: string): Promise<CepLookupResult> {
  const digits = String(raw || '').replace(/\D/g, '').slice(0, 8);
  if (digits.length !== 8) return { ok: false };

  const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
  if (!res.ok) return { ok: false };

  const data: any = await res.json();
  if (data?.erro) return { ok: false };

  return {
    ok: true,
    address: {
      cep: data.cep || digits,
      street: data.logradouro || '',
      district: data.bairro || '',
      city: data.localidade || '',
      state: data.uf || '',
      country: 'BR',
    },
  };
}

