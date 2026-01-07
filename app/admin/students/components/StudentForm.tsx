"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useToast, AlertDialog, AlertDialogBody, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogOverlay, Button, HStack, Text, VStack } from '@chakra-ui/react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { doc, getDoc, getDocs, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { buildStudentFormValues, emptyStudentFormValues, StudentFormData, studentFormSchema } from '@/app/admin/students/formConfig';
import { useCepLookup } from '@/lib/hooks/useCepLookup';
import { useStudentBiometry } from './useStudentBiometry';
import { useStudentSave } from './useStudentSave';
import StudentFormTabs from './StudentFormTabs';
import { useRouter, useSearchParams } from 'next/navigation';
import { isMinor } from '@/app/admin/students/formConfig';

type Plan = { id: string; name: string; price?: number; planSyncStatus?: string; pagarmePlanId?: string; active?: boolean; paymentMethods?: Array<'pix' | 'boleto' | 'credit_card'>; };

const SUBSCRIPTION_TAB_INDEX = 4;

interface StudentFormProps {
  mode: 'new' | 'edit';
  studentId?: string;
}

export default function StudentForm({ mode, studentId }: StudentFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPage, setLoadingPage] = useState(mode === 'edit');
  const initialTab = searchParams.get('tab') === 'subscription' ? SUBSCRIPTION_TAB_INDEX : 0;
  const [tabIndex, setTabIndex] = useState(initialTab);
  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmIdx, setConfirmIdx] = useState<number | null>(null);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  const currencyFormatter = useMemo(() => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }), []);

  const { control, handleSubmit, formState: { isValid, isSubmitting }, watch, setValue, reset } = useForm<StudentFormData>({
    mode: 'onChange',
    reValidateMode: 'onChange',
    resolver: yupResolver(studentFormSchema) as any,
    defaultValues: emptyStudentFormValues
  });

  const biometry = useStudentBiometry();
  const { save: saveStudent } = useStudentSave(mode, studentId);

  const birthDateValue = watch('birthDate');
  const isMinorNow = isMinor(birthDateValue);
  const studentNameValue = watch('name');
  const studentEmailValue = watch('email');
  const studentWhatsappValue = watch('whatsapp');
  const guardianNameValue = watch('guardianName');
  const guardianEmailValue = watch('guardianEmail');
  const guardianPhoneValue = watch('guardianPhone');
  const activePlanIdValue = watch('activePlanId');
  const jiuBeltValue = watch('jiuJitsuBelt');
  const jiuDegreeValue = watch('jiuJitsuDegree');
  const billingZipCodeValue = watch('billingZipCode');

  const cepLookup = useCepLookup({
    cep: String(billingZipCodeValue || ''),
    onAddress: (addr) => {
      setValue('billingStreet', addr.street || '', { shouldDirty: true, shouldValidate: true });
      setValue('billingDistrict', addr.district || '', { shouldDirty: true, shouldValidate: true });
      setValue('billingCity', addr.city || '', { shouldDirty: true, shouldValidate: true });
      setValue('billingState', addr.state || '', { shouldDirty: true, shouldValidate: true });
      setValue('billingCountry', addr.country || 'BR', { shouldDirty: true, shouldValidate: true });
    },
  });

  useEffect(() => {
    setLoadingCep(cepLookup.loading);
  }, [cepLookup.loading]);

  useEffect(() => {
    if (isMinorNow) {
      setValue('billingName', guardianNameValue || '');
    } else {
      setValue('billingName', studentNameValue || '');
    }
  }, [studentNameValue, guardianNameValue, isMinorNow, setValue]);

  useEffect(() => {
    if (isMinorNow) {
      setValue('billingEmail', guardianEmailValue || '');
    } else {
      setValue('billingEmail', studentEmailValue || '');
    }
  }, [studentEmailValue, guardianEmailValue, isMinorNow, setValue]);

  useEffect(() => {
    if (isMinorNow) {
      setValue('billingPhone', guardianPhoneValue || '');
    } else {
      setValue('billingPhone', studentWhatsappValue || '');
    }
  }, [studentWhatsappValue, guardianPhoneValue, isMinorNow, setValue]);

  useEffect(() => {
    getDocs(collection(db, 'plans')).then((snap) => {
      const fetched = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Plan[];
      const filtered = fetched.filter((plan) => plan.active !== false && plan.planSyncStatus === 'synced' && plan.pagarmePlanId);
      setPlans(filtered);
    });
  }, []);

  useEffect(() => {
    if (!plans.length && activePlanIdValue) {
      setValue('activePlanId', '', { shouldDirty: true, shouldValidate: true });
    } else if (activePlanIdValue && !plans.some((plan) => plan.id === activePlanIdValue)) {
      setValue('activePlanId', '', { shouldDirty: true, shouldValidate: true });
    }
  }, [plans, activePlanIdValue, setValue]);

  useEffect(() => {
    const deg = Number(String(jiuDegreeValue || '').trim() || '0');
    const isBlackOrRed = jiuBeltValue === 'preta' || jiuBeltValue === 'vermelha';
    if (!isBlackOrRed && deg > 4) {
      setValue('jiuJitsuDegree', '4');
    }
  }, [jiuBeltValue, jiuDegreeValue, setValue]);

  useEffect(() => {
    if (mode === 'edit' && studentId) {
      let cancelled = false;
      (async () => {
        try {
          setLoadingPage(true);
          const snap = await getDoc(doc(db, 'students', studentId));
          if (!snap.exists()) {
            toast({ title: 'Aluno não encontrado', status: 'error' });
            router.push('/admin/students');
            return;
          }
          const data = snap.data();
          if (cancelled) return;
          const { values } = buildStudentFormValues({ id: studentId, ...data });
          reset(values);

          if (searchParams.get('tab') !== 'subscription') {
            const subRes = await fetch(`/api/students/${studentId}/subscription`, { cache: 'no-store' });
            const subData = await subRes.json().catch(() => ({}));
            if (!cancelled && !subData?.subscription) {
              setTabIndex(SUBSCRIPTION_TAB_INDEX);
            }
          }
        } catch (error) {
          console.error('load_student_failed', error);
          toast({ title: 'Erro ao carregar aluno', status: 'error' });
          router.push('/admin/students');
        } finally {
          if (!cancelled) setLoadingPage(false);
        }
      })();
      return () => { cancelled = true; };
    }
  }, [mode, studentId, reset, router, toast, searchParams]);

  const openConfirm = (idx: number) => {
    setConfirmIdx(idx);
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    setConfirmOpen(false);
    setConfirmIdx(null);
  };

  const confirmDelete = async () => {
    if (confirmIdx === null) return;
    setDeletingPhoto(true);
    try {
      biometry.removePreviewAt(confirmIdx);
    } finally {
      setDeletingPhoto(false);
      closeConfirm();
    }
  };

  const save = handleSubmit(
    async (data) => {
      try {
        const savedId = await saveStudent(data, biometry.photoBlobs, biometry.samples, biometry.stopVideo);
        if (!savedId) {
          return;
        }
        if (mode === 'new') {
          router.push(`/admin/students/${savedId}/edit?tab=subscription`);
        } else {
          router.push('/admin/students');
        }
      } catch (error: any) {
        console.error('save_student_failed', error);
        toast({ title: 'Erro ao salvar aluno', status: 'error', description: String(error?.message || error) });
      }
    },
    () => {
      toast({ title: 'Formulario invalido', status: 'error' });
    }
  );

  const disableSubmit = !isValid || isSubmitting || !activePlanIdValue;

  if (loadingPage) {
    return (
      <VStack align="center" justify="center" minH="400px">
        <Text>Carregando...</Text>
      </VStack>
    );
  }

  return (
    <VStack align="stretch" spacing={6}>
      <StudentFormTabs
        mode={mode}
        studentId={studentId}
        control={control}
        watch={watch}
        plans={plans}
        currencyFormatter={currencyFormatter}
        showPwd={showPwd}
        setShowPwd={setShowPwd}
        showPwd2={showPwd2}
        setShowPwd2={setShowPwd2}
        video={biometry.video}
        setVideo={biometry.setVideo}
        faceReady={biometry.faceReady}
        faceErr={biometry?.faceErr || null}
        livenessOk={biometry.livenessOk}
        samples={biometry.samples}
        photoPreviews={biometry.photoPreviews}
        capturing={biometry.capturing}
        captureSample={biometry.captureSample}
        openConfirm={openConfirm}
        tabIndex={tabIndex}
        setTabIndex={setTabIndex}
        stopVideo={biometry.stopVideo}
        loadingCep={loadingCep}
        isMinorNow={isMinorNow}
      />

      <HStack justify="flex-end">
        <Button
          variant="ghost"
          onClick={() => {
            biometry.stopVideo();
            router.push('/admin/students');
          }}
        >
          Cancelar
        </Button>
        <Button
          variant="secondary"
          onClick={save}
          isLoading={isSubmitting}
          loadingText="Salvando..."
          isDisabled={disableSubmit}
        >
          Salvar
        </Button>
      </HStack>
      {!isSubmitting && disableSubmit && (
        <Text color="gray.600" fontSize="sm" textAlign="right">
          {!isValid ? 'Preencha os campos obrigatorios' : 'Selecione um plano'}
        </Text>
      )}

      <AlertDialog isOpen={confirmOpen} leastDestructiveRef={cancelRef} onClose={closeConfirm}>
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader>Remover foto</AlertDialogHeader>
            <AlertDialogBody>Tem certeza que deseja excluir esta foto? Esta acao nao pode ser desfeita.</AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef as any} onClick={closeConfirm}>Cancelar</Button>
              <Button colorScheme="red" onClick={confirmDelete} ml={3} isLoading={deletingPhoto}>Excluir</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </VStack>
  );
}
