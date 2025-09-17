import * as faceapi from '@vladmandic/face-api';

export function centroid(descriptors: number[][]): number[] {
  const n = descriptors.length;
  const sum = new Array(128).fill(0);
  for (const d of descriptors) for (let i=0;i<128;i++) sum[i]+=d[i];
  return sum.map(v => v / Math.max(n, 1));
}

export function euclidean(a: number[], b: number[]) {
  let s = 0;
  for (let i=0;i<Math.min(a.length,b.length);i++) { const d=a[i]-b[i]; s += d*d; }
  return Math.sqrt(s);
}

export type StudentFaceIndex = { id: string; name: string; centroid?: number[]; descriptors?: number[][] }[];

export function match1vN(embedding: Float32Array|number[], students: StudentFaceIndex) {
  // Coarse: centroid distance
  const coarse = students.map(s => ({ s, d: s.centroid ? euclidean(Array.from(embedding), s.centroid) : Infinity })).sort((a,b)=>a.d-b.d);
  const top = coarse[0];
  if (!top || !isFinite(top.d)) return { matched: false } as const;
  // Fine verification
  const cand = top.s;
  const dists = (cand.descriptors||[]).map(d => euclidean(Array.from(embedding), d));
  const min = dists.length ? Math.min(...dists) : top.d;
  const threshold = 0.6; // conservative
  return min < threshold ? { matched: true, studentId: cand.id, name: cand.name, distance: min } as const : { matched: false } as const;
}

export async function getEmbeddingFor(image: HTMLVideoElement|HTMLImageElement|HTMLCanvasElement) {
  const det = await faceapi.detectSingleFace(image, new faceapi.TinyFaceDetectorOptions({ inputSize: 256, scoreThreshold: 0.5 })).withFaceLandmarks().withFaceDescriptor();
  if (!det) return undefined;
  return det.descriptor;
}
