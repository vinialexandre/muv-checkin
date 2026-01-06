import { useEffect, useRef, useState } from 'react';
import { fetchCepAddress, CepAddress } from '@/lib/utils/cep';

export type UseCepLookupOptions = {
  cep: string;
  onAddress?: (addr: CepAddress) => void;
};

export function useCepLookup({ cep, onAddress }: UseCepLookupOptions) {
  const [loading, setLoading] = useState(false);
  const onAddressRef = useRef<((addr: CepAddress) => void) | undefined>(onAddress);

  useEffect(() => {
    onAddressRef.current = onAddress;
  }, [onAddress]);

  useEffect(() => {
    const raw = String(cep || '');
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    if (digits.length !== 8) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const res = await fetchCepAddress(digits);
        if (cancelled) return;
        if (!res.ok || !res.address) return;
        if (onAddressRef.current) onAddressRef.current(res.address);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cep]);

  return { loading };
}

