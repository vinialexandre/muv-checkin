import * as faceapi from 'face-api.js';

export async function loadFaceModels(basePath = process.env.NEXT_PUBLIC_FACE_MODELS_PATH || '/models') {
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(basePath),
    faceapi.nets.faceLandmark68Net.loadFromUri(basePath),
    faceapi.nets.faceRecognitionNet.loadFromUri(basePath),
  ]);
}

export function isFaceReady() {
  return !!faceapi.nets.tinyFaceDetector.params && !!faceapi.nets.faceRecognitionNet.params;
}

export const tinyOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 256, scoreThreshold: 0.5 });
