"use client";
import { useEffect, useRef, useState } from 'react';
import { Box, Text, useToast, Alert } from '@chakra-ui/react';
import VideoCanvas from '@/components/VideoCanvas';
import { useFaceModels } from '@/lib/face/useFaceModels';
import { getEmbeddingFor, match1vN } from '@/lib/face/match1vN';
import { createCheckIn } from '@/lib/firestore';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { simpleLiveness } from '@/lib/face/liveness';
import '@/lib/dev/muteWarnings';
import '@/lib/polyfills/text-encoder';

const log = (...args: any[]) => console.log(`[KIOSK ${new Date().toISOString()}]`, ...args);

export default function KioskPage() {
  const { ready, error: faceError, loading: faceLoading } = useFaceModels();
  const [students, setStudents] = useState<any[]>([]);
  const [authed, setAuthed] = useState(false);
  const [cameraError, setCameraError] = useState<string|undefined>();
  const [hud, setHud] = useState<{ text: string; tone: 'ok'|'dup'|'fail'|'error' }|undefined>();
  const [cameraReady, setCameraReady] = useState(false);
  const [readyToCapture, setReadyToCapture] = useState(false);

  const cooldownRef = useRef<Map<string, number>>(new Map());
  const checkedInHojeRef = useRef<Map<string, string>>(new Map());
  const dayRef = useRef<string>(`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-${String(new Date().getDate()).padStart(2,'0')}`);
  const videoRef = useRef<HTMLVideoElement|null>(null);
  const overlayRef = useRef<HTMLCanvasElement|null>(null);
  const workerCanvasRef = useRef<HTMLCanvasElement|null>(null);
  const runningRef = useRef(false);
  const intervalRef = useRef<number|undefined>(undefined);
  const lastLivenessRef = useRef<number>(0);
  const livenessOkCountRef = useRef<number>(0);
  const prevLivenessOkRef = useRef<boolean>(false);
  const lastEmbeddingTsRef = useRef<number>(0);
  const pausedUntilRef = useRef<number>(0);
  const readyRef = useRef<boolean>(false);
  const readyToCaptureRef = useRef<boolean>(false);
  const studentsRef = useRef<any[]>([]);
  const toast = useToast();
  useEffect(() => {
    const { onAuthStateChanged } = require('firebase/auth');
    const { auth } = require('@/lib/firebase');
    const unsub = onAuthStateChanged(auth, async (user: any) => {
      if (!user) { log('auth','signed-out'); setAuthed(false); return; }
      try { await user.getIdToken(true); } catch {}
      log('auth','signed-in', { uid: user.uid });
      setAuthed(true);
    });
    return () => unsub();
  }, []);
  useEffect(() => {
    if (!authed) return;
    const unsub = onSnapshot(
      collection(db,'students'),
      (s) => {
        const arr = s.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        setStudents(arr);
        log('students','loaded',{ count: arr.length });
        const candidates = arr.filter((s:any)=> (s.active ?? true) && (s.centroid || (s.descriptors && s.descriptors.length))).length;
        log('face-index','candidates',{ count: candidates });
      },
      (e:any) => {
        log('students','error', String(e?.message||e));
        setStudents([]);
        toast({ status:'error', title:'Erro ao carregar alunos', description:'Permissão insuficiente ou falha de rede.' });
      }
    );
    return () => unsub();
  }, [authed, toast]);

  useEffect(() => {
    if (faceLoading) log('face-models','loading');
    if (faceError) log('face-models','error', faceError);
    if (ready) log('face-models','ready');
  }, [ready, faceError, faceLoading]);
  useEffect(() => { readyRef.current = ready; }, [ready]);
  useEffect(() => { readyToCaptureRef.current = readyToCapture; }, [readyToCapture]);
  useEffect(() => { studentsRef.current = students; }, [students]);

  function beepOk() {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = 880;
      o.connect(g); g.connect(ctx.destination); g.gain.value = 0.06;
      o.start(); setTimeout(()=>{ o.stop(); ctx.close(); }, 150);
    } catch {}
  }

  useEffect(() => {
    const candidates = (students||[]).filter((s:any)=> (s.active ?? true) && (s.centroid || (s.descriptors && s.descriptors.length))).length;
    const nowReady = !!ready && !!authed && !!cameraReady && candidates > 0;
    if (nowReady && !readyToCapture) {
      setReadyToCapture(true);
      setHud({ text:'Pronto para coletar biometria', tone:'ok' });
      window.setTimeout(()=>{ setHud(undefined); }, 2000);
      log('ready-to-capture','yes',{ candidates });
    }
  }, [ready, authed, cameraReady, students, readyToCapture]);

  useEffect(() => {
    return () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = undefined; } };
  }, []);

  async function processTick(video: HTMLVideoElement) {
    if (!readyToCaptureRef.current) return;
    if (!readyRef.current) return;
    if (Date.now() < (pausedUntilRef.current || 0)) return;

    // Liveness e overlay
    let isLive = false;
    try {
      const nowLite = Date.now();
      if (nowLite - lastLivenessRef.current > 140) {
        lastLivenessRef.current = nowLite;
        const lv = await simpleLiveness(video);
        isLive = !!lv.ok;
        const prev = prevLivenessOkRef.current;
        if (prev !== isLive) {
          log('liveness', isLive ? 'ok' : 'not-detected', lv?.box ? { box: lv.box } : undefined);
          prevLivenessOkRef.current = isLive;
        }
        const canvas = overlayRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const cw = video.clientWidth || video.videoWidth;
            const ch = video.clientHeight || video.videoHeight;
            if (canvas.width !== cw) canvas.width = cw;
            if (canvas.height !== ch) canvas.height = ch;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (lv.box) {
              const vw = video.videoWidth || canvas.width;
              const vh = video.videoHeight || canvas.height;
              const cw = canvas.width;
              const ch = canvas.height;
              const scale = Math.max(cw / vw, ch / vh);
              const drawW = vw * scale;
              const drawH = vh * scale;
              const dx = (cw - drawW) / 2;
              const dy = (ch - drawH) / 2;
              const x = dx + lv.box.x * scale;
              const y = dy + lv.box.y * scale;
              const w = lv.box.width * scale;
              const h = lv.box.height * scale;
              ctx.strokeStyle = isLive ? 'rgba(80,200,120,0.95)' : 'rgba(255,244,0,0.95)';
              ctx.lineWidth = 3;
              ctx.strokeRect(x, y, w, h);
            }
          }
        }
      }
    } catch (e: any) { log('liveness','error', { name: e?.name, message: e?.message }); }

    let today = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-${String(new Date().getDate()).padStart(2,'0')}`;
    if (dayRef.current !== today) { dayRef.current = today; checkedInHojeRef.current.clear(); }

    if (isLive) livenessOkCountRef.current = Math.min(livenessOkCountRef.current + 1, 10);
    else livenessOkCountRef.current = 0;
    if (livenessOkCountRef.current === 3) log('liveness','stabilized');
    let allowEmbedding = livenessOkCountRef.current >= 3;
    const nowTs = Date.now();
    if (!allowEmbedding) {
      if (nowTs - (lastEmbeddingTsRef.current || 0) >= 4000) {
        allowEmbedding = true;
        log('liveness','forcing-embedding');
      } else {
        return;
      }
    }
    if (nowTs - (lastEmbeddingTsRef.current || 0) < 900) return;
    lastEmbeddingTsRef.current = nowTs;

    // Downscale para processamento
    let worker = workerCanvasRef.current;
    if (!worker) { worker = document.createElement('canvas'); workerCanvasRef.current = worker; }
    const targetW = 320;
    const scale = video.videoWidth ? targetW / video.videoWidth : 1;
    const w = video.videoWidth ? targetW : (video.clientWidth || 320);
    const h = video.videoHeight ? Math.max(1, Math.round(video.videoHeight * scale)) : (video.clientHeight || 240);
    if (worker.width !== w) worker.width = w;
    if (worker.height !== h) worker.height = h;
    const wctx = worker.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | null;
    if (!wctx) return;
    wctx.drawImage(video, 0, 0, w, h);

    const emb = await getEmbeddingFor(worker);
    if (!emb) { log('embedding', 'none'); setHud({ text:'Não reconhecido', tone:'fail' }); return; }
    log('embedding', 'ok');

    // Índice de faces
    const sds = studentsRef.current || [];
    const faceIndex = sds
      .filter((s:any)=> (s.active ?? true) && (s.centroid || (s.descriptors && s.descriptors.length)))
      .map((s:any)=> ({ id: s.id, name: s.name, centroid: s.centroid, descriptors: (s.descriptors||[]).map((d:any)=> Array.isArray(d) ? d : d?.v).filter(Boolean) }));
    if (!faceIndex.length) { log('face-index', 'empty'); if (readyToCaptureRef.current) setHud({ text:'Nenhum aluno com biometria cadastrada', tone:'error' }); return; }

    const match = match1vN(emb, faceIndex as any);
    if (!('matched' in match) || !match.matched) {
      log('match', 'no-match', { bestDistance: (match as any).bestDistance, bestId: (match as any).bestId, bestName: (match as any).bestName });
      setHud({ text:'Não reconhecido', tone:'fail' });
      return;
    }
    log('match', 'success', { studentId: match.studentId, name: match.name, distance: (match as any).distance });

    // Evita chamada redundante no mesmo dia (cache local)
    if (checkedInHojeRef.current.get(match.studentId) === today) {
      setHud({ text:`Já registrado hoje: ${match.name}`, tone:'dup' });
      return;
    }

    // Check-in (idempotente no servidor)
    try {
      log('checkin','attempt',{ studentId: match.studentId, name: match.name });
      const result = await createCheckIn({ studentId: match.studentId, when: new Date(), source: 'face' });
      if (result.created) {
        checkedInHojeRef.current.set(match.studentId, today);
        setHud({ text:`Check-in OK: ${match.name}`, tone:'ok' });
        beepOk();
        pausedUntilRef.current = Date.now() + 5000;
        window.setTimeout(()=>{ setHud(undefined); }, 5000);
      } else {
        checkedInHojeRef.current.set(match.studentId, today);
        setHud({ text:`Já registrado hoje: ${match.name}`, tone:'dup' });
      }
      cooldownRef.current.set(match.studentId, Date.now());
    } catch (e: any) {
      setHud({ text:'Erro ao registrar check-in', tone:'error' });
      log('checkin','error', { name: e?.name, message: e?.message });
    }
  }


  const candidatesCount = (students||[]).filter((s:any)=> (s.active ?? true) && (s.centroid || (s.descriptors && s.descriptors.length))).length;
  const initMessage = !authed ? 'Autenticando...' : (!ready ? 'Carregando modelos de face...' : (!cameraReady ? 'Preparando câmera...' : (!students.length ? 'Carregando alunos...' : (candidatesCount===0 ? 'Aguardando alunos com biometria...' : ''))));

  return (
    <Box position="fixed" inset={0} bg="black">
      {faceError && (
        <Box position="absolute" top={4} left={4} color="red.400" zIndex={2}>
          <Text>{faceError}</Text>
        </Box>
      )}
      {faceLoading && (
        <Box position="absolute" top={4} left={4} color="whiteAlpha.800" zIndex={2}>
          <Text>Carregando modelos...</Text>
        </Box>
      )}
      {cameraError && (
        <Box position="absolute" bottom={4} left={4} right={4} color="red.300" zIndex={2}>
          <Text>{cameraError}</Text>
        </Box>
      )}
      {hud && (
        <Box position="absolute" top={4} right={4} zIndex={2} maxW="80vw">
          <Alert
            status={(hud.tone==='ok' || hud.tone==='dup') ? 'success' : 'error'}
            variant="solid"
            borderRadius="md"
            boxShadow="lg"
            py={2}
            px={3}
          >
            <Text color="white" fontWeight={700}>{hud.text}</Text>

          </Alert>
        </Box>
      )}


      {!readyToCapture && (
        <Box position="absolute" top="50%" left="50%" transform="translate(-50%, -50%)" color="whiteAlpha.900" zIndex={2} textAlign="center" pointerEvents="none">
          <Text fontWeight={700}>Inicializando o Kiosk...</Text>
          <Text fontSize="sm" opacity={0.9}>{initMessage}</Text>
        </Box>
      )}

      <Box position="absolute" inset={0} opacity={readyToCapture ? 1 : 0} pointerEvents={readyToCapture ? 'auto' : 'none'}>
        <VideoCanvas full onReady={(v)=>{
          setCameraError(undefined);
          setCameraReady(true);
          log('camera','ready');
          videoRef.current = v;
          if (!workerCanvasRef.current) workerCanvasRef.current = document.createElement('canvas');

          if (intervalRef.current) clearInterval(intervalRef.current);
          log('loop','start');
          intervalRef.current = window.setInterval(async () => {
            if (runningRef.current) return;
            const vid = videoRef.current;
            if (!vid) return;
            runningRef.current = true;
            try { await processTick(vid); } finally { runningRef.current = false; }
          }, 150);
        }} onError={(e)=>{
          const msg = e?.name === 'NotReadableError' ? 'Não foi possível acessar a câmera (em uso por outro app). Feche outros aplicativos de câmera e tente novamente.' : 'Falha ao iniciar a câmera. Verifique permissões do navegador.';
          setCameraError(msg);
          log('camera','error', { name: e?.name, message: e?.message });
          toast({ status:'error', title:'Erro de câmera', description: msg, duration: 4000, isClosable: true });
        }} />
        <canvas ref={overlayRef} style={{ position: 'absolute', inset: 0 }} />
      </Box>
    </Box>
  );
}
