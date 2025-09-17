"use client";
import { useEffect, useRef } from 'react';

export default function VideoCanvas({ onReady }: { onReady?: (video: HTMLVideoElement) => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    let active = true;
    async function run() {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (!ref.current) return;
      ref.current.srcObject = stream;
      try {
        await ref.current.play();
      } catch (e: any) {
        // Ignore transient AbortError due to hot reload or src changes
        if (!(e && (e.name === 'AbortError' || String(e).includes('AbortError')))) {
          console.warn('Video play() failed', e);
        }
      }
      if (active && onReady && ref.current) onReady(ref.current);
    }
    run();
    return () => { active = false; if (ref.current?.srcObject) (ref.current.srcObject as MediaStream).getTracks().forEach(t => t.stop()); };
  }, [onReady]);
  return <video ref={ref} width={640} height={480} autoPlay muted playsInline style={{ width: '100%', maxWidth: 720, border: '1px solid #e7e7e7' }} />;
}
