import { useCallback } from 'react';
import { getDocs, collection, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { onlyDigits } from '@/app/admin/students/formConfig';

export type DuplicateCheckResult = {
  isDuplicate: boolean;
  field?: 'email' | 'phone' | 'document';
  existingStudentId?: string;
  existingStudentName?: string;
};

export function useDuplicateCheck(currentStudentId?: string) {
  const check = useCallback(async (
    email?: string,
    phone?: string,
    document?: string
  ): Promise<DuplicateCheckResult> => {
    try {
      const checks: Array<{ field: 'email' | 'phone' | 'document'; value: string }> = [];

      if (email?.trim()) {
        checks.push({ field: 'email', value: email.trim().toLowerCase() });
      }
      if (phone) {
        const phoneDigits = onlyDigits(phone);
        if (phoneDigits.length >= 10) {
          checks.push({ field: 'phone', value: phoneDigits });
        }
      }
      if (document) {
        const docDigits = onlyDigits(document);
        if (docDigits.length === 11) {
          checks.push({ field: 'document', value: docDigits });
        }
      }

      for (const checkItem of checks) {
        let q;
        if (checkItem.field === 'email') {
          q = query(collection(db, 'students'), where('email', '==', checkItem.value));
        } else if (checkItem.field === 'phone') {
          q = query(
            collection(db, 'students'),
            where('whatsapp', '==', checkItem.value)
          );
        } else {
          q = query(
            collection(db, 'students'),
            where('billingContact.document', '==', checkItem.value)
          );
        }

        const snap = await getDocs(q);
        if (!snap.empty) {
          const doc = snap.docs[0];
          const docId = doc.id;
          if (currentStudentId && docId === currentStudentId) {
            continue;
          }
          return {
            isDuplicate: true,
            field: checkItem.field,
            existingStudentId: docId,
            existingStudentName: doc.data().name,
          };
        }
      }

      return { isDuplicate: false };
    } catch (error) {
      console.error('duplicate_check_error', error);
      return { isDuplicate: false };
    }
  }, [currentStudentId]);

  return { check };
}

