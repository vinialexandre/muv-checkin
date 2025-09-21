import '@/lib/polyfills/text-encoder';

let faceapiRef: any | null = null;
let loadPromise: Promise<boolean> | null = null;

export async function getFaceApi() {
  if (typeof window === 'undefined') throw new Error('face-api só deve ser carregado no cliente');
  if (!faceapiRef) {
    faceapiRef = await import('@vladmandic/face-api/dist/face-api.esm.js');
  }
  return faceapiRef as any;
}

async function tryLoad(basePath: string) {
  const fa = await getFaceApi();
  await Promise.all([
    fa.nets.tinyFaceDetector.loadFromUri(basePath),
    fa.nets.faceLandmark68Net.loadFromUri(basePath),
    fa.nets.faceRecognitionNet.loadFromUri(basePath),
  ]);
}

export async function loadFaceModels(basePath = process.env.NEXT_PUBLIC_FACE_MODELS_PATH || '/models') {
  if (isFaceReady()) return true;
  if (loadPromise) return loadPromise;

  console.log('🔄 Iniciando carregamento dos modelos de face-api...');
  loadPromise = (async () => {
    try {
      const fa = await getFaceApi();
      const tf = (fa as any).tf;
      if (tf) {
        const desired = process.env.NEXT_PUBLIC_TF_BACKEND as ('webgl'|'cpu'|undefined);
        if (desired) { try { await tf.setBackend(desired); await tf.ready(); } catch {} }
        if (!tf.getBackend()) { try { await tf.setBackend('webgl'); await tf.ready(); } catch {} }
        if (!tf.getBackend()) { try { await tf.setBackend('cpu'); await tf.ready(); } catch {} }
      }
    } catch {}

    const cdnHint = process.env.NEXT_PUBLIC_FACE_MODELS_PATH && process.env.NEXT_PUBLIC_FACE_MODELS_PATH.startsWith('http')
      ? process.env.NEXT_PUBLIC_FACE_MODELS_PATH
      : null;
    const disableCdn = (process.env.NEXT_PUBLIC_DISABLE_FACE_CDN || '').toLowerCase() === '1' || (process.env.NEXT_PUBLIC_DISABLE_FACE_CDN || '').toLowerCase() === 'true';

    const candidates: string[] = [];
    if (cdnHint && !disableCdn) candidates.push(cdnHint);

    async function localExists(path: string) {
      try {
        const r = await fetch(`${path}/tiny_face_detector_model-weights_manifest.json`, { method: 'HEAD' });
        return r.ok;
      } catch { return false; }
    }

    if (await localExists(basePath)) candidates.push(basePath);

    if (!disableCdn) {
      candidates.push(
        'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights',
        'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights',
      );
    }

    for (const p of candidates) {
      try {
        console.log(`🔄 Tentando carregar modelos de: ${p}`);
        await tryLoad(p);
        console.log(`✅ Modelos carregados com sucesso de: ${p}`);
        if (p !== basePath) console.info('Loaded face models from', p);
        return true;
      } catch (e) {
        console.log(`❌ Falha ao carregar de ${p}:`, e);
      }
    }
    console.error('❌ Não foi possível carregar os modelos de nenhuma fonte');
    throw new Error('Unable to load face models from configured sources');
  })();
  return loadPromise;
}

export function isFaceReady() {
  const fa = faceapiRef as any;
  return !!fa && !!fa.nets?.tinyFaceDetector?.params && !!fa.nets?.faceRecognitionNet?.params;
}

export async function createTinyOptions(inputSize = 256, scoreThreshold = 0.5) {
  const fa = await getFaceApi();
  return new fa.TinyFaceDetectorOptions({ inputSize, scoreThreshold });
}
