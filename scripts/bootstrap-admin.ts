import 'dotenv/config';
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID!;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL!;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g,'\n');

const email = process.env.ADMIN_EMAIL || 'admin@muv.local';
const password = process.env.ADMIN_PASSWORD || 'admin123';

async function main() {
  const app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  const auth = getAuth(app);
  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch {
    user = await auth.createUser({ email, password, emailVerified: true, displayName: 'Admin' });
  }
  await auth.setCustomUserClaims(user.uid, { admin: true });
  console.log(`Admin ready. Email: ${email}  Password: ${password}  UID: ${user.uid}`);
}

main().catch((e)=>{ console.error(e); process.exit(1); });
