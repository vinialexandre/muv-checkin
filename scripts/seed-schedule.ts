import 'dotenv/config';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID!;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL!;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, '\n');

function minutes(hour: number, minute: number) {
  return hour * 60 + minute;
}

async function main() {
  const app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  const db = getFirestore(app);

  const scheduleRef = db.collection('schedules').doc('default');
  const scheduleSnap = await scheduleRef.get();

  if (!scheduleSnap.exists) {
    await scheduleRef.set({
      id: 'default',
      title: 'Agenda MUV',
      description: 'Horários oficiais das aulas na MUV.',
      slug: 'Horários-muv',
      published: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } else {
    await scheduleRef.set({
      title: 'Agenda MUV',
      description: 'Horários oficiais das aulas na MUV.',
      updatedAt: new Date(),
    }, { merge: true });
  }

  const entriesCol = scheduleRef.collection('entries');

  const desiredEntries = [
    { weekday: 3, start: minutes(6, 0), title: 'Boxe' },
    { weekday: 2, start: minutes(9, 0), title: 'Jiu Kids 2+' },
    { weekday: 1, start: minutes(10, 0), title: 'Jiu Kids 6+' },
    { weekday: 3, start: minutes(10, 0), title: 'Jiu Kids 10+' },
    { weekday: 4, start: minutes(10, 0), title: 'Jiu Kids 6+' },
    { weekday: 5, start: minutes(10, 0), title: 'Jiu Kids 10+' },
    { weekday: 6, start: minutes(10, 0), title: 'Jiu Jitsu' },
    { weekday: 2, start: minutes(14, 0), title: 'Jiu Jitsu Juvenil' },
    { weekday: 4, start: minutes(14, 0), title: 'Jiu Jitsu Juvenil' },
    { weekday: 2, start: minutes(17, 30), title: 'Drills' },
    { weekday: 4, start: minutes(17, 30), title: 'Drills' },
    { weekday: 1, start: minutes(18, 30), title: 'Jiu Jitsu' },
    { weekday: 2, start: minutes(18, 30), title: 'Jiu Jitsu' },
    { weekday: 3, start: minutes(18, 30), title: 'Jiu Kids' },
    { weekday: 4, start: minutes(18, 30), title: 'Jiu Jitsu' },
    { weekday: 5, start: minutes(18, 30), title: 'Jiu Jitsu' },
    { weekday: 1, start: minutes(19, 30), title: 'MMA' },
    { weekday: 2, start: minutes(19, 30), title: 'Muay Thai Feminino' },
    { weekday: 3, start: minutes(19, 30), title: 'MMA' },
    { weekday: 4, start: minutes(19, 30), title: 'Muay Thai Feminino' },
    { weekday: 1, start: minutes(20, 30), title: 'Jiu Jitsu' },
    { weekday: 3, start: minutes(20, 30), title: 'Jiu Jitsu' },
  ].map((item) => ({
    ...item,
    end: item.start + 60,
  }));

  const desiredIds = new Set<string>();
  const batch = db.batch();

  for (const entry of desiredEntries) {
    const id = `${entry.weekday}_${entry.start}`;
    desiredIds.add(id);
    const ref = entriesCol.doc(id);
    batch.set(ref, {
      id,
      scheduleId: 'default',
      weekday: entry.weekday,
      startMinutes: entry.start,
      endMinutes: entry.end,
      title: entry.title,
      updatedAt: new Date(),
    }, { merge: true });
  }

  const existing = await entriesCol.get();
  existing.forEach((doc) => {
    if (!desiredIds.has(doc.id)) {
      batch.delete(entriesCol.doc(doc.id));
    }
  });

  await batch.commit();
  console.log('Agenda seeds criada/atualizada com sucesso.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
