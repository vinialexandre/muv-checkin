# muv-checkin

Next.js 15 + Chakra UI + Firebase app for student check-in, attendance, and plan management. Includes a full-screen kiosk with webcam, simple liveness, and 1:N face matching using `@vladmandic/face-api`.

## Stack

- Next 15 (App Router, TypeScript)
- Chakra UI with minimalist MUV theme (P&B)
- Firebase: Auth (email/password), Firestore, Storage
- FaceID: `@vladmandic/face-api` in browser; models in `public/models`

## App Structure

```
/app
  /(auth)/login
  /admin/{students,plans,classes,reports}
  /kiosk
/app/api/_internal/set-claim
/lib/{firebase,firestore}.ts
/lib/face/{loadModels,match1vN,liveness}.ts
/theme/chakra.ts
/components/{VideoCanvas,LivenessHint,Table,Form}
```

## Firestore Collections

- `students: { name, phone, active, photos: string[], descriptors: number[128][], centroid: number[128], activePlanId?: string, paymentStatus?: 'ok'|'late', paymentDueAt?: Timestamp }`
- `plans: { name, price }` (mensal, sem créditos)
- `classes: { modality, startsAt, endsAt, roster: string[] }`
- `attendances: { id=classId_studentId_yyyymmdd, classId, studentId, source:'face'|'manual', createdAt }`

Idempotency and time-window rules are implemented in `lib/firestore.ts`.

## Setup

1. Copy `.env.example` to `.env.local` and fill Firebase Web config and Admin credentials.
2. Place face-api model files into `public/models` (see below).
3. Install deps and run:
   - `npm i`
   - `npm run dev`

### Face Models

Download model files compatible with `@vladmandic/face-api` and put them in `public/models`:

- `tiny_face_detector_model-weights_manifest.json` and shards
- `face_landmark_68_model-weights_manifest.json` and shards
- `face_recognition_model-weights_manifest.json` and shards

You can change the base path using `NEXT_PUBLIC_FACE_MODELS_PATH`.

## Admin Claims

Admin access is via Firebase custom claim `admin`. Create a user (email/senha) in Firebase Auth, then set the claim:

`POST /api/_internal/set-claim` body `{ uid: string, admin: boolean }`

Steps:
- Find the user UID in Firebase Console > Authentication.
- Ensure Admin SDK env vars are configured (see `.env.example`).
- From your app or `curl`, call the endpoint above with `{ uid, admin: true }`.
- Log in at `/login`. Admin pages are protected and require this claim.

Requires Admin SDK env vars. Intended for one-time setup.

CLI alternative:
- `npm run -s tsx scripts/set-admin.ts <uid> true`

Dev bypass (local only):
- Set `NEXT_PUBLIC_DEV_ADMIN_BYPASS=1` in `.env` (already set by default for local).
- At `/login`, use `admin` / `admin` to access admin without Firebase Auth.
- Do NOT enable this in production.

## Deploy

- Vercel: add `.env` variables. Set `NEXT_PUBLIC_*` client vars.
- Firebase: create project, enable Auth (email/password), Firestore, Storage. Upload models to `public/models` in the repo, then deploy to Vercel.

## Seed (optional)

`npm run seed` uses Admin SDK to create sample plans and classes. Configure Admin env vars first.
