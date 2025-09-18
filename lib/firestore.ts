import { db } from '@/lib/firebase';
import { Timestamp, collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';

export type Student = {
  id: string;
  name: string;
  phone?: string;
  active?: boolean;
  photos?: string[];
  descriptors?: number[][]; // 128 each
  centroid?: number[]; // 128
  activePlanId?: string;
  // Pagamento mensal: usamos lastPaidAt para calcular o vencimento (1 mês após)
  lastPaidAt?: Timestamp;
};

// Planos mensais: apenas nome e preço (R$)
export type Plan = { id: string; name: string; price: number };
export type ClassDoc = { id: string; modality: string; startsAt: Timestamp; endsAt: Timestamp; roster?: string[] };

// Nova estrutura simplificada para check-ins
export type CheckIn = {
  id: string; // studentId_yyyymmdd_hhmmss
  studentId: string;
  source: 'face'|'manual';
  createdAt: Timestamp;
};

// Estrutura antiga mantida para compatibilidade (se necessário)
export type Attendance = {
  id: string; // classId_studentId_yyyymmdd
  classId: string;
  studentId: string;
  source: 'face'|'manual';
  createdAt: Timestamp;
};

// Nova função simplificada para check-in sem dependência de aulas
export async function createCheckIn(args: { studentId: string; when: Date; source: 'face'|'manual' }) {
  const d = args.when;
  const yyyymmdd = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  const hhmmss = `${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}${String(d.getSeconds()).padStart(2,'0')}`;
  const id = `${args.studentId}_${yyyymmdd}_${hhmmss}`;
  const ref = doc(db, 'checkins', id);

  // Verifica se já existe um check-in muito recente (últimos 30 segundos) para evitar duplicatas
  const recentThreshold = new Date(args.when.getTime() - 30000); // 30 segundos atrás
  const recentQuery = query(
    collection(db, 'checkins'),
    where('studentId', '==', args.studentId),
    where('createdAt', '>=', Timestamp.fromDate(recentThreshold))
  );
  const recentSnaps = await getDocs(recentQuery);
  if (!recentSnaps.empty) {
    return { id: recentSnaps.docs[0].id, created: false, reason: 'recent_checkin' };
  }

  await setDoc(ref, {
    id,
    studentId: args.studentId,
    source: args.source,
    createdAt: Timestamp.fromDate(args.when)
  } satisfies CheckIn);
  return { id, created: true };
}

// Função antiga mantida para compatibilidade
export async function createAttendanceOnce(args: { classId: string; studentId: string; when: Date; source: 'face'|'manual' }) {
  const d = args.when;
  const yyyymmdd = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  const id = `${args.classId}_${args.studentId}_${yyyymmdd}`;
  const ref = doc(db, 'attendances', id);
  const snap = await getDoc(ref);
  if (snap.exists()) return { id, created: false };
  await setDoc(ref, { id, classId: args.classId, studentId: args.studentId, source: args.source, createdAt: Timestamp.fromDate(new Date()) } satisfies Attendance);
  return { id, created: true };
}

export async function canCheckInWindow(classId: string, at: Date) {
  const ref = doc(db, 'classes', classId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return false;
  const data = snap.data() as any;
  const start = (data.startsAt as Timestamp).toDate();
  const end = (data.endsAt as Timestamp).toDate();
  const windowStart = new Date(start.getTime() - 10*60*1000);
  const windowEnd = new Date(start.getTime() + 15*60*1000);
  return at >= windowStart && at <= windowEnd && at <= end;
}

// Nova função para exportar check-ins
export async function exportCheckInsCsvForMonth(year: number, month0: number) {
  const first = new Date(year, month0, 1);
  const last = new Date(year, month0 + 1, 0);
  const q = query(
    collection(db, 'checkins'),
    where('createdAt', '>=', Timestamp.fromDate(first)),
    where('createdAt', '<=', Timestamp.fromDate(new Date(last.getFullYear(), last.getMonth(), last.getDate(), 23, 59, 59)))
  );
  const snaps = await getDocs(q);
  const rows = [['id','studentId','source','createdAt']];
  snaps.forEach(s => {
    const c = s.data() as CheckIn;
    rows.push([c.id, c.studentId, c.source, (c.createdAt as Timestamp).toDate().toISOString()]);
  });
  return rows.map(r => r.join(',')).join('\n');
}

// Função para buscar check-ins recentes
export async function getRecentCheckIns() {
  const q = query(
    collection(db, 'checkins'),
    where('createdAt', '>=', Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000))), // últimas 24h
  );
  const snaps = await getDocs(q);
  return snaps.docs.map(doc => ({ id: doc.id, ...doc.data() } as CheckIn & { id: string }));
}

// Função antiga mantida para compatibilidade
export async function exportAttendancesCsvForMonth(year: number, month0: number) {
  const first = new Date(year, month0, 1);
  const last = new Date(year, month0 + 1, 0);
  const q = query(collection(db, 'attendances'), where('createdAt', '>=', Timestamp.fromDate(first)), where('createdAt', '<=', Timestamp.fromDate(new Date(last.getFullYear(), last.getMonth(), last.getDate(), 23, 59, 59))));
  const snaps = await getDocs(q);
  const rows = [['id','classId','studentId','source','createdAt']];
  snaps.forEach(s => {
    const a = s.data() as Attendance;
    rows.push([a.id, a.classId, a.studentId, a.source, (a.createdAt as Timestamp).toDate().toISOString()]);
  });
  return rows.map(r => r.join(',')).join('\n');
}

export async function deleteById(path: string, id: string) {
  await deleteDoc(doc(db, path, id));
}
