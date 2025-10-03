"use client";
import { useEffect, useRef } from 'react';

export default function VideoCanvas({ onReady, onError, full, size = 500 }: { onReady?: (video: HTMLVideoElement) => void; onError?: (err: any) => void; full?: boolean; size?: number }) {
  const ref = useRef<HTMLVideoElement>(null);
  const onReadyRef = useRef<typeof onReady>(onReady);
  const onErrorRef = useRef<typeof onError>(onError);

  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  useEffect(() => {
    let active = true;

    async function tryGetStream() {
      const candidates: MediaStreamConstraints[] = [
        { video: { facingMode: 'user' } },
        { video: true },
      ];
      try {
        const devices = await navigator.mediaDevices.enumerateDevices().catch(()=>[] as MediaDeviceInfo[]);
        const cams = devices.filter(d => d.kind === 'videoinput');
        if (cams.length) {
          for (const d of cams) candidates.push({ video: { deviceId: { exact: d.deviceId } } });
        }
      } catch {}

      let lastErr: any = null;
      for (const c of candidates) {
        try {
          return await navigator.mediaDevices.getUserMedia(c);
        } catch (e: any) {
          lastErr = e;
          if (!(e?.name === 'NotReadableError' || e?.name === 'OverconstrainedError')) break;
        }
      }
      throw lastErr || new Error('Falha ao iniciar câmera');
    }

    async function run() {
      try {
        const stream = await tryGetStream();
        if (!ref.current) { stream.getTracks().forEach(t=>t.stop()); return; }
        if (ref.current.srcObject) (ref.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
        ref.current.srcObject = stream;
        try { await ref.current.play(); } catch (e: any) { if (!(e && (e.name === 'AbortError' || String(e).includes('AbortError')))) { console.warn('Video play() failed', e); } }
        if (active && onReadyRef.current && ref.current) onReadyRef.current(ref.current);
      } catch (e) {
        console.error('getUserMedia failed', e);
        if (onErrorRef.current) onErrorRef.current(e);
      }
    }

    const videoEl = ref.current;
    run();
    return () => { active = false; if (videoEl?.srcObject) (videoEl.srcObject as MediaStream).getTracks().forEach(t => t.stop()); };
  }, []);

  return <video ref={ref} width={full ? 1920 : size} height={full ? 1080 : size} autoPlay muted playsInline style={full ? { width: '100vw', height: '100vh', objectFit: 'cover', display: 'block', background: 'black' } : { width: `${size}px`, height: `${size}px`, objectFit: 'cover', display: 'block', background: 'black', border: '1px solid #e7e7e7' }} />;
}
