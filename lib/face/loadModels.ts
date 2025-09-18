import * as faceapi from '@vladmandic/face-api';
// Register TFJS backends (webgl/cpu)
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-cpu';

let loadPromise: Promise<boolean> | null = null;

async function tryLoad(basePath: string) {
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(basePath),
    faceapi.nets.faceLandmark68Net.loadFromUri(basePath),
    faceapi.nets.faceRecognitionNet.loadFromUri(basePath),
  ]);
}

export async function loadFaceModels(basePath = process.env.NEXT_PUBLIC_FACE_MODELS_PATH || '/models') {
  if (isFaceReady()) return true;
  if (loadPromise) return loadPromise;

  // Log para debug
  console.log('🔄 Iniciando carregamento dos modelos de face-api...');
  loadPromise = (async () => {
    // Ensure TF backend of the same instance used by face-api
    try {
      const tf = (faceapi as any).tf;
      if (tf) {
        const desired = process.env.NEXT_PUBLIC_TF_BACKEND as ('webgl'|'cpu'|undefined);
        if (desired) { try { await tf.setBackend(desired); await tf.ready(); } catch {} }
        if (!tf.getBackend()) { try { await tf.setBackend('webgl'); await tf.ready(); } catch {} }
        if (!tf.getBackend()) { try { await tf.setBackend('cpu'); await tf.ready(); } catch {} }
      }
    } catch {}

    // If env var points to CDN, try it first to avoid local 404 noise
    const cdnHint = process.env.NEXT_PUBLIC_FACE_MODELS_PATH && process.env.NEXT_PUBLIC_FACE_MODELS_PATH.startsWith('http')
      ? process.env.NEXT_PUBLIC_FACE_MODELS_PATH
      : null;
    const disableCdn = (process.env.NEXT_PUBLIC_DISABLE_FACE_CDN || '').toLowerCase() === '1' || (process.env.NEXT_PUBLIC_DISABLE_FACE_CDN || '').toLowerCase() === 'true';

    const candidates: string[] = [];
    if (cdnHint && !disableCdn) candidates.push(cdnHint);

    // Check if local files exist with a single HEAD request; only try if present
    async function localExists(path: string) {
      try {
        const r = await fetch(`${path}/tiny_face_detector_model-weights_manifest.json`, { method: 'HEAD' });
        return r.ok;
      } catch { return false; }
    }

    if (await localExists(basePath)) candidates.push(basePath);

    // Fallback CDNs
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
  return !!faceapi.nets.tinyFaceDetector.params && !!faceapi.nets.faceRecognitionNet.params;
}

export const tinyOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 256, scoreThreshold: 0.5 });
