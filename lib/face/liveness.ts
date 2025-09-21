import '@/lib/polyfills/text-encoder';
import { getFaceApi } from './loadModels';

export type LivenessState = {
  ok: boolean;
  blinked: boolean;
  turned: boolean;
  box?: { x: number; y: number; width: number; height: number };
};

// Versão simplificada: considera "ok" se um rosto for detectado.
// Mantemos blink/turn apenas como informação auxiliar.
export async function simpleLiveness(video: HTMLVideoElement): Promise<LivenessState> {
  const fa = await getFaceApi();
  const lm = await fa
    .detectSingleFace(video, new fa.TinyFaceDetectorOptions({ inputSize: 192, scoreThreshold: 0.3 }))
    .withFaceLandmarks();
  if (!lm) return { ok: false, blinked: false, turned: false };
  const pts: any[] = lm.landmarks.getLeftEye().concat(lm.landmarks.getRightEye());
  const eyeOpenScore = eyeAspectRatio(pts as any);
  const nose: any[] = lm.landmarks.getNose();
  const dx = nose[0].x - nose[nose.length - 1].x;
  const turned = Math.abs(dx) > 10;
  const blinked = eyeOpenScore < 0.2;
  const { x, y, width, height } = lm.detection.box as any;
  return { ok: true, blinked, turned, box: { x, y, width, height } };
}

function eyeAspectRatio(pts: any[]) {
  if (!pts || pts.length < 12) return 1;
  const p = pts as any[];
  const v = (a: any, b: any) => Math.hypot(a.x-b.x, a.y-b.y);
  const ear = (v(p[1],p[5])+v(p[2],p[4]))/(2*v(p[0],p[3]));
  return ear;
}
