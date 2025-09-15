import { App, cert, getApps, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

let app: App | undefined;
const existing = getApps();
if (existing.length) {
  app = existing[0];
} else {
  const envProjectId = process.env.FIREBASE_ADMIN_PROJECT_ID
    || process.env.GOOGLE_CLOUD_PROJECT
    || process.env.GCLOUD_PROJECT
    || process.env.FIREBASE_PROJECT_ID
    || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (envProjectId && clientEmail && privateKey) {
    app = initializeApp({ credential: cert({ projectId: envProjectId, clientEmail, privateKey }), projectId: envProjectId });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      app = envProjectId
        ? initializeApp({ credential: applicationDefault(), projectId: envProjectId })
        : initializeApp({ credential: applicationDefault() });
    } catch {}
  }
}

export const adminAuth = app ? getAuth(app) : undefined;
export const adminDb = app ? getFirestore(app) : undefined;
