# muv-checkin

Aplicativo Next.js 15 + Chakra UI + Firebase para check-in e gestão de presença/planos de alunos. Inclui um kiosque em tela cheia com webcam, verificação simples de liveness e reconhecimento facial 1:N usando `@vladmandic/face-api`.

## Stack

- Next 15 (App Router, TypeScript)
- Chakra UI com tema minimalista (P&B)
- Firebase: Auth (email/senha), Firestore, Storage
- FaceID: `@vladmandic/face-api` no navegador; modelos em `public/models`

## Estrutura do app

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

## Coleções do Firestore

- `students: { name, phone, active, photos: string[], descriptors: number[128][], centroid: number[128], activePlanId?: string, paymentStatus?: 'ok'|'late', paymentDueAt?: Timestamp }`
- `plans: { name, price }` (mensal, sem créditos)
- `classes: { modality, startsAt, endsAt, roster: string[] }`
- `attendances: { id=classId_studentId_yyyymmdd, classId, studentId, source:'face'|'manual', createdAt }`

Regras de idempotência e janela de tempo estão em `lib/firestore.ts`.

## Configuração

1. Copie `.env.example` para `.env.local` e preencha as variáveis do Firebase (Web) e Admin SDK.
2. Coloque os arquivos de modelo do face-api em `public/models` (veja abaixo). Você pode automatizar com `npm run models`.
3. Instale e rode:
   - `npm i`
   - `npm run dev`

### Modelos de Face (face-api.js)

Opção A — Baixar localmente (recomendado em produção)

1. Rode o script: `npm run models` (usa jsDelivr para baixar)
2. Verifique `public/models` com os arquivos:
   - `tiny_face_detector_model-weights_manifest.json` (+ shards)
   - `face_landmark_68_model-weights_manifest.json` (+ shards)
   - `face_recognition_model-weights_manifest.json` (+ shards)

Opção B — CDN (rápido para desenvolvimento)

- Defina no `.env.local`:
  - `NEXT_PUBLIC_FACE_MODELS_PATH=https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights`

Backend do TensorFlow (webgl/cpu)

- Opcional: force via `.env.local`: `NEXT_PUBLIC_TF_BACKEND=webgl` ou `cpu`.
- O loader tenta `webgl` e cai para `cpu` automaticamente.

Por que não Firebase?

- Esses pesos são arquivos estáticos (iguais para todos). Servi-los como assets em `public/models` (ou CDN próprio) evita CORS/autenticação, reduz latência e é mais simples. Os dados biométricos (descritores/centroide) continuam no Firestore pois são específicos por aluno.

## Claims de Admin

O acesso administrativo usa a custom claim `admin` do Firebase. Crie um usuário (email/senha) no Firebase Auth e defina a claim:

`POST /api/_internal/set-claim` com body `{ uid: string, admin: boolean }`

Passos:
- Localize o UID do usuário no Console Firebase → Authentication.
- Garanta que as variáveis do Admin SDK estejam configuradas (veja `.env.example`).
- Do app ou via `curl`, chame o endpoint acima com `{ uid, admin: true }`.
- Faça login em `/login`. As páginas de admin exigem essa claim.

Requer variáveis do Admin SDK. Indicado para configuração inicial.

Alternativa via CLI:
- `npm run -s tsx scripts/set-admin.ts <uid> true`

Bypass de desenvolvimento (somente local):
- Defina `NEXT_PUBLIC_DEV_ADMIN_BYPASS=1` no `.env` (apenas local).
- Em `/login`, use `admin` / `admin` para acessar sem Firebase Auth.
- Não habilite isso em produção.

## Deploy

- Vercel: adicione as variáveis `.env`. Defina as `NEXT_PUBLIC_*` do cliente.
- Firebase: crie o projeto, habilite Auth (email/senha), Firestore e Storage. Suba os modelos em `public/models` e depois faça o deploy na Vercel.

## Seed (opcional)

`npm run seed` usa o Admin SDK para criar planos e uma aula de exemplo. Configure as variáveis do Admin antes.
