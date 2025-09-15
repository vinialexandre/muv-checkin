import 'dotenv/config';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID!;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL!;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g,'\n');

async function main() {
  const app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  const db = getFirestore(app);
  // Planos mensais (sem créditos)
  const plans = [
    { name: 'Plano Full', price: 300 },
    { name: 'Plano Kids 1x', price: 125 },
    { name: 'Plano Kids 2x', price: 200 },
  ];
  for (const p of plans) await db.collection('plans').add(p);
  const now = new Date();
  await db.collection('classes').add({ modality: 'Treino', startsAt: now, endsAt: new Date(now.getTime()+60*60*1000), roster: [] });
  console.log('Seed ok');
}

main();
