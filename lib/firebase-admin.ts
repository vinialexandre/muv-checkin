import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

let app: App | undefined;
const existing = getApps();
if (existing.length) {
  app = existing[0];
} else {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (projectId && clientEmail && privateKey) {
    app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
}

export const adminAuth = app ? getAuth(app) : undefined;
export const adminDb = app ? getFirestore(app) : undefined;
