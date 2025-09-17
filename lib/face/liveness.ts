import * as faceapi from '@vladmandic/face-api';

export type LivenessState = {
  ok: boolean; // simplificado: rosto presente
  blinked: boolean;
  turned: boolean;
};

// Versão simplificada: considera "ok" se um rosto for detectado.
// Mantemos blink/turn apenas como informação auxiliar.
export async function simpleLiveness(video: HTMLVideoElement): Promise<LivenessState> {
  const lm = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 256, scoreThreshold: 0.3 }))
    .withFaceLandmarks();
  if (!lm) return { ok: false, blinked: false, turned: false };
  const pts = lm.landmarks.getLeftEye().concat(lm.landmarks.getRightEye());
  const eyeOpenScore = eyeAspectRatio(pts);
  const nose = lm.landmarks.getNose();
  const dx = nose[0].x - nose[nose.length - 1].x;
  const turned = Math.abs(dx) > 10; // proxy grosseiro de yaw
  const blinked = eyeOpenScore < 0.2; // proxy grosseiro de piscar
  return { ok: true, blinked, turned };
}

function eyeAspectRatio(pts: faceapi.Point[]) {
  if (pts.length < 12) return 1;
  const p = pts;
  const v = (a: faceapi.Point, b: faceapi.Point) => Math.hypot(a.x-b.x, a.y-b.y);
  const ear = (v(p[1],p[5])+v(p[2],p[4]))/(2*v(p[0],p[3]));
  return ear;
}
