import { useEffect, useRef, useState } from 'react';
import { useToast } from '@chakra-ui/react';
import { useFaceModels } from '@/lib/face/useFaceModels';
import { simpleLiveness } from '@/lib/face/liveness';
import { getEmbeddingFor } from '@/lib/face/match1vN';

export function useStudentBiometry() {
  const toast = useToast();
  const { ready: faceReady, error: faceErr } = useFaceModels();
  
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [livenessOk, setLivenessOk] = useState(false);
  const [samples, setSamples] = useState<number[][]>([]);
  const [photoBlobs, setPhotoBlobs] = useState<Blob[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [capturing, setCapturing] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    videoRef.current = video;
  }, [video]);

  useEffect(() => {
    return () => {
      try {
        const currentVideo = videoRef.current;
        if (currentVideo?.srcObject) {
          (currentVideo.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
        }
      } catch {}
    };
  }, []);

  useEffect(() => {
    if (!video || !faceReady) return;
    let active = true;
    let running = false;
    const id = window.setInterval(async () => {
      if (!active || running) return;
      running = true;
      try {
        const lv = await simpleLiveness(video);
        if (active) setLivenessOk(!!(lv.blinked && lv.turned));
      } catch {}
      finally {
        running = false;
      }
    }, 250);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [video, faceReady]);

  const captureCurrentFrameBlob = async (v: HTMLVideoElement): Promise<{ blob: Blob; dataUrl: string }> => {
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth || 640;
    canvas.height = v.videoHeight || 480;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b as Blob), 'image/jpeg', 0.9));
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    return { blob, dataUrl };
  };

  const captureSample = async () => {
    if (!video || !faceReady) return;
    if (samples.length >= 5) {
      toast({ title: 'Limite atingido', description: 'Use no maximo 5 amostras', status: 'info' });
      return;
    }
    setCapturing(true);
    toast({ title: 'Captura iniciada', status: 'info', duration: 1200 });
    try {
      const emb = await getEmbeddingFor(video);
      if (!emb) {
        toast({ title: 'Rosto nao detectado', status: 'warning' });
        return;
      }
      const { blob, dataUrl } = await captureCurrentFrameBlob(video);
      setPhotoBlobs((prev) => [...prev, blob]);
      setPhotoPreviews((prev) => [...prev, dataUrl]);
      setSamples((prev) => [...prev, Array.from(emb) as number[]]);
    } finally {
      setCapturing(false);
    }
  };

  const removePreviewAt = (idx: number) => {
    setPhotoBlobs((prev) => prev.filter((_, i) => i !== idx));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== idx));
    setSamples((prev) => prev.filter((_, i) => i !== idx));
  };

  const clearAll = () => {
    setPhotoBlobs([]);
    setPhotoPreviews([]);
    setSamples([]);
  };

  const stopVideo = () => {
    try {
      if (video?.srcObject) {
        (video.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
      }
    } catch {}
    setVideo(null);
  };

  return {
    video,
    setVideo,
    faceReady,
    faceErr,
    livenessOk,
    samples,
    photoBlobs,
    photoPreviews,
    capturing,
    captureSample,
    removePreviewAt,
    clearAll,
    stopVideo
  };
}
