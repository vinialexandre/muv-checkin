import { useToast } from '@chakra-ui/react';
import { useRouter } from 'next/navigation';
import { addDoc, collection, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { centroid } from '@/lib/face/match1vN';
import { onlyDigits, StudentFormData } from '@/app/admin/students/formConfig';

export function useStudentSave(mode: 'new' | 'edit', studentId?: string) {
  const router = useRouter();
  const toast = useToast();

  const save = async (data: StudentFormData, photoBlobs: Blob[], samples: number[][], stopVideo: () => void) => {
    if (!data.activePlanId) {
      toast({ title: 'Selecione um plano valido', status: 'warning' });
      return;
    }

    const payload: Record<string, any> = {
      name: data.name,
      phone: data.whatsapp,
      whatsapp: data.whatsapp,
      active: !!data.active,
      activePlanId: data.activePlanId
    };

    if (data.email) payload.email = data.email;

    const pwd = String((data as any).password ?? '').trim();
    if (pwd && !data.email) {
      toast({ title: 'Informe um email para criar login', status: 'warning' });
      return;
    }

    if (data.birthDate) payload.birthDate = data.birthDate;
    if (data.guardianName) payload.guardianName = data.guardianName;
    if (data.guardianPhone) payload.guardianPhone = data.guardianPhone;
    if (data.guardianEmail) payload.guardianEmail = data.guardianEmail;
    if (data.techNotes) payload.techNotes = data.techNotes;

    const toNum = (value: string) => {
      const replaced = String(value || '').replace(/\./g, '').replace(',', '.');
      const parsed = Number(replaced);
      return Number.isFinite(parsed) ? parsed : undefined;
    };
    if (data.weightKg) {
      const weight = toNum(data.weightKg);
      if (weight !== undefined) payload.weightKg = weight;
    }
    if (data.heightCm) {
      const height = toNum(data.heightCm);
      if (height !== undefined) payload.heightCm = height;
    }

    const billingDocumentDigits = onlyDigits(String(data.billingDocument || ''));
    const billingPhoneDigits = onlyDigits(String(data.billingPhone || ''));

    payload.billingContact = {
      name: String(data.billingName || '').trim(),
      email: String(data.billingEmail || '').trim().toLowerCase(),
      document: billingDocumentDigits,
      phone: billingPhoneDigits,
      countryCode: '55',
    };

    const address: Record<string, any> = {
      zipCode: onlyDigits(String(data.billingZipCode || '')),
      street: String(data.billingStreet || '').trim(),
      number: String(data.billingNumber || '').trim(),
      district: String(data.billingDistrict || '').trim(),
      city: String(data.billingCity || '').trim(),
      state: String(data.billingState || '').trim().toUpperCase(),
      country: String(data.billingCountry || '').trim().toUpperCase(),
    };
    const complement = String(data.billingComplement || '').trim();
    if (complement) address.complement = complement;
    payload.billingAddress = address;

    if (data.activities) {
      payload.activities = {
        funcional: Boolean(data.activities.funcional),
        boxe: Boolean(data.activities.boxe),
        mma: Boolean(data.activities.mma),
        jiuJitsu: Boolean(data.activities.jiuJitsu),
      };
    }

    if (data.jiuJitsuBelt) {
      payload.jiuJitsuBelt = data.jiuJitsuBelt;
    }

    {
      let degNum = Number(String((data as any).jiuJitsuDegree || '').trim() || '0');
      if (!Number.isFinite(degNum)) degNum = 0;
      if (degNum < 0) degNum = 0;
      if (degNum > 10) degNum = 10;
      {
        const belt = String((data as any).jiuJitsuBelt || '');
        const isBlackOrRed = belt === 'preta' || belt === 'vermelha';
        if (!isBlackOrRed && degNum > 4) {
          degNum = 4;
        }
      }
      payload.jiuJitsuDegree = degNum;
    }

    if (data.subscriptionDiscount && data.subscriptionDiscount > 0) {
      payload.subscriptionDiscount = data.subscriptionDiscount;
    }

    let docId = studentId;

    if (mode === 'new') {
      const created = await addDoc(collection(db, 'students'), payload);
      docId = created.id;
    } else if (mode === 'edit' && studentId) {
      await updateDoc(doc(db, 'students', studentId), payload);
    }

    if (pwd && docId) {
      const res = await fetch('/api/students/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email, password: pwd, name: data.name, studentId: docId })
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.error || `Erro ${res.status}`);
      }
    }

    if (photoBlobs.length && docId) {
      const photos: string[] = [];
      for (let i = 0; i < photoBlobs.length; i += 1) {
        const blob = photoBlobs[i];
        const path = `students/${docId}/${Date.now()}-${i}.jpg`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
        const url = await getDownloadURL(storageRef);
        photos.push(url);
      }

      const updateData: Record<string, any> = { photos };
      if (samples.length) {
        updateData.descriptors = samples.map((v) => ({ v }));
        updateData.centroid = centroid(samples);
      }
      await updateDoc(doc(db, 'students', docId), updateData);
    }

    toast({ title: mode === 'new' ? 'Aluno criado' : 'Aluno atualizado', status: 'success' });
    stopVideo();
    router.push('/admin/students');
  };

  return { save };
}
