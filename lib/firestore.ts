import { db } from '@/lib/firebase';
import { generateSlug } from '@/lib/utils';
import { Timestamp, collection, deleteDoc, deleteField, doc, getDoc, getDocs, limit, orderBy, query, runTransaction, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';

export type StudentBillingContact = {
  name: string;
  email: string;
  document: string; // somente dígitos
  phone: string; // DDD + número somente dígitos
  countryCode?: string; // default '55'
};

export type StudentBillingAddress = {
  street: string;
  number?: string;
  complement?: string;
  district: string;
  city: string;
  state: string; // UF
  zipCode: string;
  country: string; // ISO-3166 alpha-2
};

export type StudentPaymentPreference = 'credit_card'|'pix'|'boleto';
export type StudentPaymentStatus = 'unknown'|'in_good_standing'|'pending'|'past_due'|'canceled';

export type Student = {
  id: string;
  name: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  birthDate?: string;
  password?: string;

  guardianName?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  active?: boolean;
  photos?: string[];
  descriptors?: number[][]; // 128 each
  centroid?: number[]; // 128
  activePlanId?: string;
  weightKg?: number;
  heightCm?: number;
  techNotes?: string;
  activities?: {
    funcional?: boolean;
    boxe?: boolean;
    mma?: boolean;
    jiuJitsu?: boolean;
  };
  jiuJitsuBelt?: string;
  jiuJitsuDegree?: number;
  billingContact?: StudentBillingContact;
  billingAddress?: StudentBillingAddress;
  billingConsentAcceptedAt?: Timestamp;
  billingConsentVersion?: string;
  paymentPreference?: StudentPaymentPreference;
	pagarmeSubscriptionId?: string;
  pagarmeCustomerId?: string;
  pagarmeCardId?: string;
  paymentStatus?: StudentPaymentStatus;
  // Pagamento mensal: usamos lastPaidAt para calcular o vencimento (1 mês após)
  lastPaidAt?: Timestamp;
};

export type PlanBillingInterval = 'day'|'week'|'month'|'year';
export type PlanPaymentMethod = 'credit_card'|'pix'|'boleto';
export type PlanSyncStatus = 'pending'|'synced'|'error';

export type Plan = {
  id: string;
  name: string;
  price: number;
  period?: 'monthly'|'quarterly'|'semiannual'|'annual';
  active?: boolean;
  billingInterval?: PlanBillingInterval;
  billingIntervalCount?: number;
  paymentMethods?: PlanPaymentMethod[];
  pagarmePlanId?: string;
  planSyncStatus?: PlanSyncStatus;
  planSyncError?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type SubscriptionStatus = 'pending'|'active'|'past_due'|'canceled'|'paused';

export type Subscription = {
  id: string;
  studentId: string;
  planId: string;
  planSnapshotName?: string;
  price?: number;
  paymentMethod?: PlanPaymentMethod;
  payerName?: string;
  pagarmePlanId?: string;
  pagarmeCustomerId?: string;
  pagarmeSubscriptionId?: string;
  status: SubscriptionStatus;
  nextBillingAt?: Timestamp;
  lastChargeAt?: Timestamp;
  consentAcceptedAt?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type SubscriptionInvoiceStatus = 'pending'|'paid'|'canceled'|'failed'|'expired'|'past_due';

export type SubscriptionInvoice = {
  id: string;
  pagarmeInvoiceId: string;
  subscriptionId: string;
  studentId: string;
  planId: string;
  amount: number;
  paymentMethod: PlanPaymentMethod;
  status: SubscriptionInvoiceStatus;
  dueAt?: Timestamp;
  pix?: {
    qrCode?: string;
    qrCodeUrl?: string;
    expiresAt?: Timestamp;
  };
  boleto?: {
    pdf?: string;
    line?: string;
    barcode?: string;
    expiresAt?: Timestamp;
  };
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type ClassDoc = { id: string; modality: string; startsAt: Timestamp; endsAt: Timestamp; roster?: string[] };

// Nova estrutura simplificada para check-ins
export type CheckIn = {
  id: string; // studentId_yyyymmdd
  studentId: string;
  source: 'face'|'manual';
  createdAt: Timestamp;
};

// Estrutura antiga mantida para compatibilidade (se necessÃ¡rio)
export type Attendance = {
  id: string; // classId_studentId_yyyymmdd
  classId: string;
  studentId: string;
  source: 'face'|'manual';
  createdAt: Timestamp;
};

export type ScheduleDoc = {
  id: string;
  title?: string;
  description?: string;
  slug: string;
  published: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type ScheduleEntry = {
  id: string;
  scheduleId: string;
  weekday: number; // 0 (domingo) ... 6 (SÃ¡bado)
  startMinutes: number; // minutos desde 00:00
  endMinutes: number;
  title: string;
  notes?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type ScheduleWithEntries = {
  schedule: ScheduleDoc;
  entries: ScheduleEntry[];
};

export const DEFAULT_SCHEDULE_ID = 'default';

function scheduleDocRef(id: string = DEFAULT_SCHEDULE_ID) {
  return doc(db, 'schedules', id);
}

function scheduleEntriesCollection(id: string = DEFAULT_SCHEDULE_ID) {
  return collection(db, 'schedules', id, 'entries');
}

async function slugInUse(slug: string, ignoreId?: string) {
  const result = await getDocs(
    query(collection(db, 'schedules'), where('slug', '==', slug), limit(1)),
  );
  if (result.empty) return false;
  const found = result.docs[0];
  return found.id !== ignoreId;
}

export async function ensureSchedule(id: string = DEFAULT_SCHEDULE_ID) {
  const ref = scheduleDocRef(id);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return { id: snap.id, ...(snap.data() as any) } as ScheduleDoc;
  }
  const now = Timestamp.fromDate(new Date());
  const data: ScheduleDoc = {
    id,
    title: 'Agenda MUV',
    description: '',
    slug: generateSlug(),
    published: false,
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(ref, data);
  return data;
}

export async function updateScheduleMeta(params: { id?: string; title?: string; description?: string; published?: boolean; slug?: string; }) {
  const { id = DEFAULT_SCHEDULE_ID, ...rest } = params;
  await ensureSchedule(id);
  const ref = scheduleDocRef(id);
  const payload: Record<string, any> = { updatedAt: serverTimestamp() };
  if ('title' in rest) payload.title = rest.title ?? '';
  if ('description' in rest) payload.description = rest.description ?? '';
  if ('published' in rest) payload.published = !!rest.published;
  if ('slug' in rest && rest.slug) payload.slug = rest.slug;
  await updateDoc(ref, payload);
}

export async function regenerateScheduleSlug(id: string = DEFAULT_SCHEDULE_ID) {
  await ensureSchedule(id);
  let slug = generateSlug();
  let attempts = 0;
  while (attempts < 5) {
    const conflict = await slugInUse(slug, id);
    if (!conflict) break;
    slug = generateSlug();
    attempts++;
  }
  await updateScheduleMeta({ id, slug });
  return slug;
}

export async function listScheduleEntries(id: string = DEFAULT_SCHEDULE_ID) {
  await ensureSchedule(id);
  const entriesSnap = await getDocs(
    query(
      scheduleEntriesCollection(id),
      orderBy('weekday'),
      orderBy('startMinutes'),
    ),
  );
  return entriesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as ScheduleEntry));
}

export async function upsertScheduleEntry(params: { scheduleId?: string; id?: string; weekday: number; startMinutes: number; endMinutes: number; title: string; notes?: string | null; }) {
  const { scheduleId = DEFAULT_SCHEDULE_ID, id, weekday, startMinutes, endMinutes, title, notes } = params;
  if (endMinutes <= startMinutes) throw new Error('endMinutes must be greater than startMinutes');
  if (weekday < 0 || weekday > 6) throw new Error('weekday must be between 0 and 6');
  await ensureSchedule(scheduleId);
  const col = scheduleEntriesCollection(scheduleId);
  const normalizedNotes = typeof notes === 'string' ? notes.trim() : notes;
  const payload: Record<string, any> = {
    scheduleId,
    weekday,
    startMinutes,
    endMinutes,
    title,
    updatedAt: serverTimestamp(),
  };
  if (id) {
    if (typeof normalizedNotes === 'string') {
      if (normalizedNotes.length) payload.notes = normalizedNotes;
      else payload.notes = deleteField();
    } else if (normalizedNotes === null) {
      payload.notes = deleteField();
    }
    await updateDoc(doc(col, id), payload);
    return { id, scheduleId, weekday, startMinutes, endMinutes, title, notes: typeof normalizedNotes === 'string' && normalizedNotes.length ? normalizedNotes : undefined } as ScheduleEntry;
  }
  const ref = doc(col);
  const data: Record<string, unknown> = { ...payload, id: ref.id, createdAt: serverTimestamp() };
  if (typeof normalizedNotes === 'string' && normalizedNotes.length) {
    data.notes = normalizedNotes;
  }
  await setDoc(ref, data);
  return { id: ref.id, scheduleId, weekday, startMinutes, endMinutes, title, notes: typeof normalizedNotes === 'string' && normalizedNotes.length ? normalizedNotes : undefined } as ScheduleEntry;
}

export async function deleteScheduleEntry(scheduleId: string, entryId: string) {
  await deleteDoc(doc(scheduleEntriesCollection(scheduleId), entryId));
}

export async function getPublishedScheduleBySlug(slug: string): Promise<ScheduleWithEntries | undefined> {
  const scheduleSnap = await getDocs(
    query(
      collection(db, 'schedules'),
      where('slug', '==', slug),
      where('published', '==', true),
      limit(1),
    ),
  );
  if (scheduleSnap.empty) return undefined;
  const docSnap = scheduleSnap.docs[0];
  const schedule = { id: docSnap.id, ...(docSnap.data() as any) } as ScheduleDoc;
  const entriesSnap = await getDocs(
    query(
      scheduleEntriesCollection(docSnap.id),
      orderBy('weekday'),
      orderBy('startMinutes'),
    ),
  );
  const entries = entriesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as ScheduleEntry));
  return { schedule, entries };
}



// Nova função simplificada para check-in sem dependência de aulas
// Mantém ID dinâmico no documento de check-in e usa um "lock" diário determinístico para evitar duplicatas sem precisar de índice composto.
export async function createCheckIn(args: { studentId: string; when: Date; source: 'face'|'manual' }) {
  const d = args.when;
  const yyyymmdd = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  const id = `${args.studentId}_${yyyymmdd}`;
  const checkinRef = doc(db, 'checkins', id);

  let created = false;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(checkinRef);
    if (snap.exists()) return;
    tx.set(checkinRef, {
      id,
      studentId: args.studentId,
      source: args.source,
      createdAt: Timestamp.fromDate(args.when),
    } as CheckIn);
    created = true;
  });

  return { id, created };
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
    where('createdAt', '>=', Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000))), // Ãºltimas 24h
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

