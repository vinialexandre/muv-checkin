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

export type Attendance = {
  id: string; // classId_studentId_yyyymmdd
  classId: string;
  studentId: string;
  source: 'face'|'manual';
  createdAt: Timestamp;
};

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
