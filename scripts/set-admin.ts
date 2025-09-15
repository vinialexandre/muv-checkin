import 'dotenv/config';
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID!;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL!;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g,'\n');

async function main() {
  const [uid, adminFlag] = process.argv.slice(2);
  if (!uid) throw new Error('Usage: tsx scripts/set-admin.ts <uid> [true|false]');
  const admin = adminFlag !== 'false';
  const app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  const auth = getAuth(app);
  await auth.setCustomUserClaims(uid, { admin });
  console.log(`Set admin=${admin} for uid=${uid}`);
}

main().catch((e)=>{ console.error(e); process.exit(1); });
