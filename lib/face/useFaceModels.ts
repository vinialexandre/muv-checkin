import { useEffect, useState } from 'react';
import { loadFaceModels, isFaceReady } from './loadModels';

export function useFaceModels() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isFaceReady()) {
      setReady(true);
      return;
    }

    let cancelled = false;
    
    const load = async () => {
      if (loading) return; // Evita múltiplas chamadas simultâneas
      
      setLoading(true);
      setError(undefined);
      
      try {
        console.log('🔄 Hook useFaceModels: Iniciando carregamento...');
        await loadFaceModels();
        
        if (!cancelled) {
          setReady(true);
          console.log('✅ Hook useFaceModels: Modelos carregados com sucesso');
        }
      } catch (e: any) {
        console.error('❌ Hook useFaceModels: Erro ao carregar modelos:', e);
        if (!cancelled) {
          setError('Modelos de face não encontrados. Coloque os arquivos em /public/models ou permita acesso à CDN.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return { ready, error, loading };
}
