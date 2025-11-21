"use client";
import PageCard from '@/components/PageCard';
import { Icon } from '@/components/Icon';

import { db, storage } from '@/lib/firebase';
import {
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
  FormControl,
  FormErrorMessage,
  FormLabel,
  HStack,
  Image,
  Input, InputGroup, InputRightElement,
  Select,
  SimpleGrid,
  Spinner,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  Textarea,
  VStack,
  useBreakpointValue,
  useToast
} from '@chakra-ui/react';
import { addDoc, collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { yupResolver } from '@hookform/resolvers/yup';
import { Controller, useForm } from 'react-hook-form';
import { IMaskInput } from 'react-imask';

import { Eye, EyeOff } from 'lucide-react';

import VideoCanvas from '@/components/VideoCanvas';
import LivenessHint from '@/components/LivenessHint';
import { useFaceModels } from '@/lib/face/useFaceModels';
import { centroid, getEmbeddingFor } from '@/lib/face/match1vN';
import { simpleLiveness } from '@/lib/face/liveness';
import {
  studentFormSchema,
  emptyStudentFormValues,
  StudentFormData,
  onlyDigits,
  isMinor
} from '@/app/admin/students/formConfig';

type Plan = { id: string; name: string; price?: number; planSyncStatus?: string; pagarmePlanId?: string; active?: boolean; paymentMethods?: Array<'pix'|'boleto'|'credit_card'>; };

const formatPaymentMethod = (method: 'pix'|'boleto'|'credit_card') => {
  switch (method) {
    case 'pix':
      return 'Pix';
    case 'boleto':
      return 'Boleto';
    case 'credit_card':
      return 'Cartão';
    default:
      return method;
  }
};

type FormData = StudentFormData;
export default function NewStudentPage() {
  const router = useRouter();
  const toast = useToast();
  const { ready: faceReady, error: faceErr } = useFaceModels();
  const [plans, setPlans] = useState<Plan[]>([]);
  const currencyFormatter = useMemo(() => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }), []);

  const { control, handleSubmit, formState: { isValid, isSubmitting }, watch, setValue } = useForm<FormData>({
    mode: 'onChange',
    reValidateMode: 'onChange',
    resolver: yupResolver(studentFormSchema) as any,
    defaultValues: emptyStudentFormValues
  });
  const birthDateValue = watch('birthDate');
  const isMinorNow = isMinor(birthDateValue);
  const studentNameValue = watch('name');
  const billingNameValue = watch('billingName');
  const studentEmailValue = watch('email');
  const billingEmailValue = watch('billingEmail');
  const activePlanIdValue = watch('activePlanId');
  const selectedPlan = useMemo(() => plans.find((plan) => plan.id === activePlanIdValue), [plans, activePlanIdValue]);
  const selectedPlanMethods = selectedPlan?.paymentMethods?.map((method) => formatPaymentMethod(method)).join(' - ');

  const jiuBeltValue = watch('jiuJitsuBelt');
  const jiuDegreeValue = watch('jiuJitsuDegree');

  useEffect(() => {
    if (studentNameValue && !billingNameValue) {
      setValue('billingName', studentNameValue);
    }
  }, [studentNameValue, billingNameValue, setValue]);

  useEffect(() => {
    if (studentEmailValue && !billingEmailValue) {
      setValue('billingEmail', studentEmailValue);
    }
  }, [studentEmailValue, billingEmailValue, setValue]);


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

  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);


  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    videoRef.current = video;
  }, [video]);
  useEffect(() => {
    return () => {
      try {
        const currentVideo = videoRef.current;
        if (currentVideo?.srcObject) {
          (currentVideo.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
        }
      } catch {}
    };
  }, []);

  const [livenessOk, setLivenessOk] = useState(false);
  const [samples, setSamples] = useState<number[][]>([]);
  const [photoBlobs, setPhotoBlobs] = useState<Blob[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [tabIndex, setTabIndex] = useState(0);
  const FACE_TAB_INDEX = 3;


  const removePreviewAt = (idx: number) => {
    setPhotoBlobs((prev) => prev.filter((_, i) => i !== idx));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== idx));
    setSamples((prev) => prev.filter((_, i) => i !== idx));
  };

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmIdx, setConfirmIdx] = useState<number | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const [deletingPhoto, setDeletingPhoto] = useState(false);

  const closeConfirm = () => {
    setConfirmOpen(false);
    setConfirmIdx(null);
  };
  const openConfirm = (idx: number) => {
    setConfirmIdx(idx);
    setConfirmOpen(true);
  };
  const confirmDelete = async () => {
    if (confirmIdx === null) return;
    setDeletingPhoto(true);
    try {
      removePreviewAt(confirmIdx);
    } finally {
      setDeletingPhoto(false);
      closeConfirm();
    }
  };

  useEffect(() => {
    if (!video || !faceReady) return;
    let active = true;
    let running = false;
    const id = window.setInterval(async () => {
      if (!active || running) return;
      running = true;
      try {
        const lv = await simpleLiveness(video);
        if (active) setLivenessOk(!!(lv.blinked && lv.turned));
      } catch {}
      finally {
        running = false;
      }
    }, 250);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [video, faceReady]);

  async function captureCurrentFrameBlob(v: HTMLVideoElement): Promise<{ blob: Blob; dataUrl: string }> {
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth || 640;
    canvas.height = v.videoHeight || 480;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b as Blob), 'image/jpeg', 0.9));
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    return { blob, dataUrl };
  }
  async function captureSample() {
    if (!video || !faceReady) return;
    if (samples.length >= 5) {
      toast({ title: 'Limite atingido', description: 'Use no maximo 5 amostras', status: 'info' });
      return;
    }
    setCapturing(true);
    toast({ title: 'Captura iniciada', status: 'info', duration: 1200 });
    try {
      const emb = await getEmbeddingFor(video);
      if (!emb) {
        toast({ title: 'Rosto nao detectado', status: 'warning' });
        return;
      }
      const { blob, dataUrl } = await captureCurrentFrameBlob(video);
      setPhotoBlobs((prev) => [...prev, blob]);
      setPhotoPreviews((prev) => [...prev, dataUrl]);
      setSamples((prev) => [...prev, Array.from(emb) as number[]]);
    } finally {
      setCapturing(false);
    }
  }

  const save = handleSubmit(
    async (data) => {
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
      } satisfies Record<string, any>;

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



      const created = await addDoc(collection(db, 'students'), payload);


      if (pwd) {
        const res = await fetch('/api/students/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: data.email, password: pwd, name: data.name, studentId: created.id })
        });
        if (!res.ok) {
          const b = await res.json().catch(() => ({}));
          throw new Error(b?.error || `Erro ${res.status}`);
        }
      }

      if (photoBlobs.length) {
        const photos: string[] = [];
        for (let i = 0; i < photoBlobs.length; i += 1) {
          const blob = photoBlobs[i];
          const path = `students/${created.id}/${Date.now()}-${i}.jpg`;
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
        await updateDoc(doc(db, 'students', created.id), updateData);
      }

      toast({ title: 'Aluno criado', status: 'success' });
      try {
        if (video?.srcObject) {
          (video.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
        }
      } catch {}
      setVideo(null);
      router.push('/admin/students');
    },
    () => {
      toast({ title: 'Formulario invalido', status: 'error' });
    }
  );

  const disableSubmit = !isValid || isSubmitting || !activePlanIdValue;
  const videoSize = useBreakpointValue({ base: 300, md: 500 });

  return (
    <VStack align="stretch" spacing={6}>
      <Tabs
        variant="enclosed"
        isLazy
        lazyBehavior="unmount"
        index={tabIndex}
        onChange={(index) => {
          if (tabIndex === FACE_TAB_INDEX && index !== FACE_TAB_INDEX) {
            try {
              if (video?.srcObject) {
                (video.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
              }
            } catch {}
            setVideo(null);
            setCapturing(false);
          }
          setTabIndex(index);
        }}
      >
        <TabList>
          <Tab _selected={{ color: '#000', borderColor: '#bfbfbf', borderWidth: '1px', borderBottomColor: 'white' }}>Dados gerais</Tab>
          <Tab _selected={{ color: '#000', borderColor: '#bfbfbf', borderWidth: '1px', borderBottomColor: 'white' }}>Cobrança</Tab>
          <Tab _selected={{ color: '#000', borderColor: '#bfbfbf', borderWidth: '1px', borderBottomColor: 'white' }}>Ficha técnica</Tab>
          <Tab _selected={{ color: '#000', borderColor: '#bfbfbf', borderWidth: '1px', borderBottomColor: 'white' }}>Biometria facial</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <PageCard>
              <VStack align="stretch" spacing={6}>
                <HStack>
                  <Icon name='users' />
                  <Text fontSize="xl" fontWeight={700}>Cadastro de aluno</Text>
                </HStack>
                <VStack align="stretch" spacing={4}>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} alignItems="start">
                    <VStack align="stretch" spacing={4}>
                      <HStack spacing={3} wrap="wrap">
                        <Controller name="name" control={control} render={({ field, fieldState }) => (
                          <FormControl isInvalid={!!fieldState.error} isRequired>
                            <FormLabel>Nome</FormLabel>
                            <Input placeholder="Nome" {...field} />
                            <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                          </FormControl>
                        )}/>
                        <Controller name="birthDate" control={control} render={({ field, fieldState }) => (
                          <FormControl isInvalid={!!fieldState.error} isRequired>
                            <FormLabel>Data de nascimento</FormLabel>
                            <Input type="date" placeholder="Data de nascimento" {...field} />
                            <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                          </FormControl>
                        )}/>
                      </HStack>
                      <HStack spacing={3} wrap="wrap">
                        <Controller name="email" control={control} render={({ field, fieldState }) => (
                          <FormControl isInvalid={!!fieldState.error} isRequired={!isMinorNow}>
                            <FormLabel>E-mail</FormLabel>
                            <Input type="email" placeholder="E-mail" {...field} />
                            <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                          </FormControl>
                        )}/>
                        <Controller name="whatsapp" control={control} render={({ field, fieldState }) => (
                          <FormControl isInvalid={!!fieldState.error} isRequired={!isMinorNow}>
                            <FormLabel>WhatsApp</FormLabel>
                            <Input as={IMaskInput as any} mask="(00) 00000-0000" placeholder="WhatsApp" value={field.value as any} onAccept={(val:any)=>field.onChange(val)} inputMode="tel" autoComplete="tel" type="tel" />
                            <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                          </FormControl>
                        )}/>
                      </HStack>
                      <HStack spacing={3} wrap="wrap">
                        <Controller name="password" control={control} render={({ field, fieldState }) => (
                          <FormControl isInvalid={!!fieldState.error}>
                            <FormLabel>Senha</FormLabel>
                            <InputGroup>
                              <Input type={showPwd ? 'text' : 'password'} placeholder="Senha" {...field} />
                              <InputRightElement>
                                <Button variant="ghost" size="sm" onClick={() => setShowPwd((s) => !s)}>
                                  {showPwd ? <Eye size={16} /> : <EyeOff size={16} />}
                                </Button>
                              </InputRightElement>
                            </InputGroup>
                            <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                          </FormControl>
                        )}/>
                        <Controller name="confirmPassword" control={control} render={({ field, fieldState }) => (
                          <FormControl isInvalid={!!fieldState.error}>
                            <FormLabel>Confirmar senha</FormLabel>
                            <InputGroup>
                              <Input type={showPwd2 ? 'text' : 'password'} placeholder="Confirmar senha" {...field} />
                              <InputRightElement>
                                <Button variant="ghost" size="sm" onClick={() => setShowPwd2((s) => !s)}>
                                  {showPwd2 ? <Eye size={16} /> : <EyeOff size={16} />}
                                </Button>
                              </InputRightElement>
                            </InputGroup>
                            <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                          </FormControl>
                        )}/>
                      </HStack>

                      <Controller
                        name="active"
                        control={control}
                        render={({ field }) => (
                          <Checkbox isChecked={!!field.value} onChange={(e) => field.onChange(e.target.checked)}>Ativo</Checkbox>
                        )}
                      />
                    </VStack>
                    <VStack align="stretch" spacing={2}>
                      <Text fontWeight={600} marginTop={5}>Dados do responsável</Text>
                      <Text color="gray.600" fontSize="sm" marginBottom={1}>Obrigatório telefone e e-mail do responsável para menor de idade</Text>
                      <HStack spacing={3} wrap="wrap">
                        <Controller name="guardianName" control={control} render={({ field, fieldState }) => (
                          <FormControl isInvalid={!!fieldState.error} isRequired={isMinorNow} isDisabled={!isMinorNow}>
                            <FormLabel>Nome do responsável</FormLabel>
                            <Input placeholder="Nome do responsável" {...field} />
                            <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                          </FormControl>
                        )}/>
                        <Controller name="guardianEmail" control={control} render={({ field, fieldState }) => (
                          <FormControl marginTop={0.5} isInvalid={!!fieldState.error} isDisabled={!isMinorNow}>
                            <FormLabel>E-mail do responsável</FormLabel>
                            <Input type="email" placeholder="E-mail do responsável" {...field} />
                            <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                          </FormControl>
                        )}/>
                        <Controller name="guardianPhone" control={control} render={({ field, fieldState }) => (
                          <FormControl marginTop={0.5} isInvalid={!!fieldState.error} isRequired={isMinorNow} isDisabled={!isMinorNow}>
                            <FormLabel>WhatsApp do responsável</FormLabel>
                            <Input as={IMaskInput as any} mask="(00) 00000-0000" placeholder="WhatsApp do responsável" value={field.value as any} onAccept={(val:any)=>field.onChange(val)} />
                            <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                          </FormControl>
                        )}/>
                      </HStack>
                    </VStack>
                  </SimpleGrid>
                </VStack>
              </VStack>
            </PageCard>
          </TabPanel>
          <TabPanel>
            <PageCard>
              <VStack align="stretch" spacing={6}>
                <HStack>
                  <Icon name='creditCard' />
                  <Text fontSize="xl" fontWeight={700}>Dados de cobrança</Text>
                </HStack>
                <VStack align="stretch" spacing={4}>
                  <VStack align="stretch" spacing={3}>
                    <Controller
                      name="activePlanId"
                      control={control}
                      render={({ field, fieldState }) => (
                        <FormControl isInvalid={!!fieldState.error} isRequired maxW="280px">
                          <FormLabel>Plano</FormLabel>
                          <Select placeholder="Selecione um plano" {...field}>
                            {plans.map((plan) => (
                              <option key={plan.id} value={plan.id}>{plan.name}</option>
                            ))}
                          </Select>
                          <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                        </FormControl>
                      )}
                    />
                  </VStack>
                  {plans.length === 0 ? (
                    <Alert status="warning">
                      <AlertIcon />
                      <AlertTitle fontSize="sm">Nenhum plano sincronizado</AlertTitle>
                      <AlertDescription fontSize="sm">Cadastre e sincronize um plano no Pagar.me para liberar as assinaturas.</AlertDescription>
                    </Alert>
                  ) : selectedPlan ? (
                    <Text fontSize="sm" color="gray.600">
                      Valor: {selectedPlan.price ? currencyFormatter.format(selectedPlan.price) : '-'}
                      {selectedPlanMethods ? ` - Métodos: ${selectedPlanMethods}` : ''}
                    </Text>
                  ) : null}
                  <Divider />
                  <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                    <Controller name="billingDistrict" control={control} render={({ field, fieldState }) => (
                      <FormControl isInvalid={!!fieldState.error} isRequired>
                        <FormLabel>Bairro</FormLabel>
                        <Input placeholder="Bairro" {...field} />
                        <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                      </FormControl>
                    )}/>
                    <Controller name="billingCity" control={control} render={({ field, fieldState }) => (
                      <FormControl isInvalid={!!fieldState.error} isRequired>
                        <FormLabel>Cidade</FormLabel>
                        <Input placeholder="Cidade" {...field} />
                        <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                      </FormControl>
                    )}/>
                    <Controller name="billingState" control={control} render={({ field, fieldState }) => (
                      <FormControl isInvalid={!!fieldState.error} isRequired>
                        <FormLabel>UF</FormLabel>
                        <Input placeholder="UF" maxW="120px" {...field} />
                        <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                      </FormControl>
                    )}/>
                  </SimpleGrid>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                    <Controller name="billingComplement" control={control} render={({ field }) => (
                      <FormControl>
                        <FormLabel>Complemento</FormLabel>
                        <Input placeholder="Apartamento, bloco..." {...field} />
                      </FormControl>
                    )}/>
                    <Controller name="billingCountry" control={control} render={({ field, fieldState }) => (
                      <FormControl isInvalid={!!fieldState.error} isRequired>
                        <FormLabel>País</FormLabel>
                        <Input placeholder="BR" maxW="160px" {...field} />
                        <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                      </FormControl>
                    )}/>
                  </SimpleGrid>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                    <Controller name="billingName" control={control} render={({ field, fieldState }) => (
                      <FormControl isInvalid={!!fieldState.error} isRequired>
                        <FormLabel>Pagador</FormLabel>
                        <Input placeholder="Nome completo do pagador" {...field} />
                        <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                      </FormControl>
                    )}/>
                    <Controller name="billingEmail" control={control} render={({ field, fieldState }) => (
                      <FormControl isInvalid={!!fieldState.error} isRequired>
                        <FormLabel>E-mail do pagador</FormLabel>
                        <Input type="email" placeholder="email@exemplo.com" {...field} />
                        <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                      </FormControl>
                    )}/>
                  </SimpleGrid>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                    <Controller name="billingDocument" control={control} render={({ field, fieldState }) => (
                      <FormControl isInvalid={!!fieldState.error} isRequired>
                        <FormLabel>CPF do pagador</FormLabel>
                        <Input
                          as={IMaskInput as any}
                          mask="000.000.000-00"
                          placeholder="000.000.000-00"
                          value={field.value as any}
                          name={field.name}
                          onBlur={field.onBlur}
                          onAccept={(val: any) => field.onChange(val)}
                          onChange={(e: any) => field.onChange(e?.target?.value)}
                        />
                        <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                      </FormControl>
                    )}/>
                    <Controller name="billingPhone" control={control} render={({ field, fieldState }) => (
                      <FormControl isInvalid={!!fieldState.error} isRequired>
                        <FormLabel>Telefone do pagador</FormLabel>
                        <Input
                          as={IMaskInput as any}
                          mask="(00) 00000-0000"
                          placeholder="(00) 00000-0000"
                          value={field.value as any}
                          name={field.name}
                          onBlur={field.onBlur}
                          onAccept={(val: any) => field.onChange(val)}
                          onChange={(e: any) => field.onChange(e?.target?.value)}
                        />
                        <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                      </FormControl>
                    )}/>
                  </SimpleGrid>
                </VStack>
              </VStack>
            </PageCard>
          </TabPanel>
          <TabPanel>
            <PageCard>
              <VStack align="stretch" spacing={4}>
                <VStack align="stretch" spacing={3}>
                  <HStack>
                    <Icon name='settings' />
                    <Text fontSize="lg" fontWeight={700}>Ficha técnica</Text>
                  </HStack>
                </VStack>

                <HStack spacing={3} wrap="wrap">
                  <Controller name="weightKg" control={control} render={({ field }) => (
                    <FormControl>
                      <FormLabel>Peso (kg)</FormLabel>
                      <Input
                        as={IMaskInput as any}
                        mask={Number}
                        radix=","
                        mapToRadix={["."]}
                        thousandsSeparator="."
                        scale={2}
                        normalizeZeros
                        padFractionalZeros
                        placeholder="Peso (kg)"
                        maxW="200px"
                        value={field.value as any}
                        onAccept={(val: any) => field.onChange(val)}
                      />
                    </FormControl>
                  )}/>
                  <Controller name="heightCm" control={control} render={({ field }) => (
                    <FormControl>
                      <FormLabel>Altura (cm)</FormLabel>
                      <Input
                        as={IMaskInput as any}
                        mask={Number}
                        radix=","
                        mapToRadix={["."]}
                        thousandsSeparator="."
                        scale={2}
                        normalizeZeros
                        padFractionalZeros
                        placeholder="Altura (cm)"
                        maxW="200px"
                        value={field.value as any}
                        onAccept={(val: any) => field.onChange(val)}
                      />
                    </FormControl>
                  )}/>
                </HStack>
                <VStack align="stretch" spacing={3}>
                  <Text fontWeight={600}>Atividades praticadas</Text>
                  <HStack spacing={4} wrap="wrap">
                    <Controller
                      name="activities.funcional"
                      control={control}
                      render={({ field }) => (
                        <Checkbox
                          isChecked={field.value}
                          onChange={(e) => field.onChange(e.target.checked)}
                          sx={{
                            '.chakra-checkbox__control': {
                              bg: field.value ? 'black' : 'white',
                              borderColor: 'black',
                              _checked: {
                                bg: 'black',
                                borderColor: 'black',
                                color: 'white'
                              }
                            }
                          }}
                        >
                          Funcional
                        </Checkbox>
                      )}
                    />
                    <Controller
                      name="activities.boxe"
                      control={control}
                      render={({ field }) => (
                        <Checkbox
                          isChecked={field.value}
                          onChange={(e) => field.onChange(e.target.checked)}
                          sx={{
                            '.chakra-checkbox__control': {
                              bg: field.value ? 'black' : 'white',
                              borderColor: 'black',
                              _checked: {
                                bg: 'black',
                                borderColor: 'black',
                                color: 'white'
                              }
                            }
                          }}
                        >
                          Boxe
                        </Checkbox>
                      )}
                    />
                    <Controller
                      name="activities.mma"
                      control={control}
                      render={({ field }) => (
                        <Checkbox
                          isChecked={field.value}
                          onChange={(e) => field.onChange(e.target.checked)}
                          sx={{
                            '.chakra-checkbox__control': {
                              bg: field.value ? 'black' : 'white',
                              borderColor: 'black',
                              _checked: {
                                bg: 'black',
                                borderColor: 'black',
                                color: 'white'
                              }
                            }
                          }}
                        >
                          MMA
                        </Checkbox>
                      )}
                    />
                    <Controller
                      name="activities.jiuJitsu"
                      control={control}
                      render={({ field }) => (
                        <Checkbox
                          isChecked={field.value}
                          onChange={(e) => field.onChange(e.target.checked)}
                          sx={{
                            '.chakra-checkbox__control': {
                              bg: field.value ? 'black' : 'white',
                              borderColor: 'black',
                              _checked: {
                                bg: 'black',
                                borderColor: 'black',
                                color: 'white'
                              }
                            }
                          }}
                        >
                          Jiu Jitsu
                        </Checkbox>
                      )}
                    />
                  </HStack>
                </VStack>

                {watch('activities.jiuJitsu') && (
                  <Accordion allowToggle maxW="900px">
                    <AccordionItem borderTop="none">
                      <AccordionButton px={0}>
                        <Box flex="1" textAlign="left" fontWeight={600}>
                          Especificações
                        </Box>
                        <AccordionIcon />
                      </AccordionButton>
                      <AccordionPanel>
                        <HStack spacing={4} align="stretch">
                          <Controller
                            name="jiuJitsuBelt"
                            control={control}
                            render={({ field }) => (
                              <FormControl maxW="200px">
                                <FormLabel>Faixa de Jiu-Jitsu</FormLabel>
                                <Select placeholder="Selecione a faixa" {...field}>
                                  <option value="branca">Branca</option>
                                  <option value="cinza">Cinza</option>
                                  <option value="amarela">Amarela</option>
                                  <option value="laranja">Laranja</option>
                                  <option value="verde">Verde</option>
                                  <option value="azul">Azul</option>
                                  <option value="roxa">Roxa</option>
                                  <option value="marrom">Marrom</option>
                                  <option value="preta">Preta</option>
                                  <option value="vermelha">Vermelha</option>
                                </Select>
                              </FormControl>
                            )}
                          />

                          <Controller
                            name="jiuJitsuDegree"
                            control={control}
                            render={({ field }) => (
                              <FormControl maxW="200px">
                                <FormLabel>Grau</FormLabel>
                                <Select placeholder="Selecione o grau" {...field}>
                                  <option value="0">Sem grau</option>
                                  {Array.from({ length: 10 }).map((_, idx) => {
                                    const n = idx + 1;
                                    const disabled = n >= 5 && !(jiuBeltValue === 'preta' || jiuBeltValue === 'vermelha');
                                    return (
                                      <option key={n} value={String(n)} disabled={disabled}>
                                        {`${n}° Grau`}
                                      </option>
                                    );
                                  })}
                                </Select>
                              </FormControl>
                            )}
                          />
                        </HStack>
                      </AccordionPanel>
                    </AccordionItem>
                  </Accordion>
                )}

                <Controller name="techNotes" control={control} render={({ field }) => (
                  <FormControl>
                    <FormLabel>Observações</FormLabel>
                    <Textarea placeholder="Anote suas observações aqui" {...field} />
                  </FormControl>
                )}/>
              </VStack>
            </PageCard>
          </TabPanel>

          <TabPanel>
            <PageCard>
              <VStack align="stretch" spacing={4}>
                <VStack align="stretch" spacing={3}>
                  <HStack>
                    <Icon name='camera' />
                    <Text fontSize="lg" fontWeight={700}>Biometria facial</Text>
                  </HStack>
                  <VStack align="stretch" spacing={2}>
                    <Badge colorScheme={faceReady ? 'green' : faceErr ? 'red' : 'gray'} alignSelf="flex-start">
                      Modelos {faceReady ? 'OK' : faceErr ? 'Erro' : 'Carregando'}
                    </Badge>
                    <Badge colorScheme={samples.length >= 3 ? 'green' : 'red'} alignSelf="flex-start">
                      {samples.length >= 3 ? `${samples.length} amostras` : 'Minimo de 3 amostras'}
                    </Badge>
                  </VStack>
                </VStack>
                <Text color="gray.600">Colete pelo menos 3 amostras com boa iluminacao e rosto centralizado.</Text>
                {!!faceErr && <Text color='red.500' fontSize='sm'>{faceErr}</Text>}
                <Box
                  position="relative"
                  width={{ base: '100%', md: '500px' }}
                  height={{ base: '300px', md: '500px' }}
                  display="inline-block"
                  maxW="500px"
                >
                  <VideoCanvas size={videoSize || 300} onReady={setVideo} />
                  {capturing && (
                    <Box
                      position="absolute"
                      inset={0}
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      bg="rgba(0,0,0,0.35)"
                      zIndex={1}
                    >
                      <HStack
                        spacing={3}
                        bg="rgba(255,255,255,0.9)"
                        px={4}
                        py={2}
                        borderRadius="md"
                        boxShadow="md"
                      >
                        <Spinner size="sm" />
                        <Text color="gray.800" fontWeight={600}>Capturando...</Text>
                      </HStack>
                    </Box>
                  )}
                </Box>
                <LivenessHint ok={livenessOk} />
                <VStack align="stretch" spacing={2}>
                  <Button
                    variant='secondary'
                    onClick={captureSample}
                    isDisabled={!video || !faceReady || capturing || samples.length >= 5}
                    isLoading={capturing}
                    loadingText="Capturando..."
                  >
                    Capturar amostra
                  </Button>
                  <Text color="gray.700" textAlign="center">Amostras coletadas: {samples.length}/5</Text>
                </VStack>
                {photoPreviews.length > 0 && (
                  <SimpleGrid columns={{ base: 3, md: 5 }} spacing={2}>
                    {photoPreviews.map((src, index) => (
                      <Box key={index} position="relative" boxSize="96px">
                        <Image src={src} alt={`amostra ${index + 1}`} borderRadius="md" boxSize="96px" objectFit="cover" />
                        <Button
                          size="xs"
                          onClick={() => openConfirm(index)}
                          position="absolute"
                          top={1}
                          right={1}
                          borderRadius="full"
                          bg="white"
                          _hover={{ bg: 'red.500', color: 'white' }}
                        >
                          x
                        </Button>
                      </Box>
                    ))}
                  </SimpleGrid>
                )}
              </VStack>
            </PageCard>
          </TabPanel>
        </TabPanels>
      </Tabs>

      <HStack justify="flex-end">
        <Button
          variant="ghost"
          onClick={() => {
            try {
              if (video?.srcObject) {
                (video.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
              }
            } catch {}
            setVideo(null);
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

  const router = useRouter();
  const toast = useToast();
  const { ready: faceReady, error: faceErr } = useFaceModels();
  const [plans, setPlans] = useState<Plan[]>([]);
  const currencyFormatter = useMemo(() => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }), []);

  const { control, handleSubmit, formState: { isValid, isSubmitting }, watch, setValue } = useForm<FormData>({
    mode: 'onChange',
    reValidateMode: 'onChange',
    resolver: yupResolver(studentFormSchema) as any,
    defaultValues: emptyStudentFormValues
  });
  const birthDateValue = watch('birthDate');
  const isMinorNow = isMinor(birthDateValue);
  const studentNameValue = watch('name');
  const billingNameValue = watch('billingName');
  const studentEmailValue = watch('email');
  const billingEmailValue = watch('billingEmail');
  const activePlanIdValue = watch('activePlanId');
  const selectedPlan = useMemo(() => plans.find((plan) => plan.id === activePlanIdValue), [plans, activePlanIdValue]);
  const selectedPlanMethods = selectedPlan?.paymentMethods?.map((method) => formatPaymentMethod(method)).join(' - ');

  useEffect(() => {
    if (studentNameValue && !billingNameValue) {
      setValue('billingName', studentNameValue);
    }
  }, [studentNameValue, billingNameValue, setValue]);

  useEffect(() => {
    if (studentEmailValue && !billingEmailValue) {
      setValue('billingEmail', studentEmailValue);
    }
  }, [studentEmailValue, billingEmailValue, setValue]);


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

  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    videoRef.current = video;
  }, [video]);
  useEffect(() => {
    return () => {
      try {
        const currentVideo = videoRef.current;
        if (currentVideo?.srcObject) {
          (currentVideo.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
        }
      } catch {}
    };
  }, []);

  const [livenessOk, setLivenessOk] = useState(false);
  const [samples, setSamples] = useState<number[][]>([]);
  const [photoBlobs, setPhotoBlobs] = useState<Blob[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [tabIndex, setTabIndex] = useState(0);
  const FACE_TAB_INDEX = 3;


  const removePreviewAt = (idx: number) => {
    setPhotoBlobs((prev) => prev.filter((_, i) => i !== idx));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== idx));
    setSamples((prev) => prev.filter((_, i) => i !== idx));
  };

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmIdx, setConfirmIdx] = useState<number | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const [deletingPhoto, setDeletingPhoto] = useState(false);

  const closeConfirm = () => {
    setConfirmOpen(false);
    setConfirmIdx(null);
  };
  const openConfirm = (idx: number) => {
    setConfirmIdx(idx);
    setConfirmOpen(true);
  };
  const confirmDelete = async () => {
    if (confirmIdx === null) return;
    setDeletingPhoto(true);
    try {
      removePreviewAt(confirmIdx);
    } finally {
      setDeletingPhoto(false);
      closeConfirm();
    }
  };

  useEffect(() => {
    if (!video || !faceReady) return;
    let active = true;
    let running = false;
    const id = window.setInterval(async () => {
      if (!active || running) return;
      running = true;
      try {
        const lv = await simpleLiveness(video);
        if (active) setLivenessOk(!!(lv.blinked && lv.turned));
      } catch {}
      finally {
        running = false;
      }
    }, 250);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [video, faceReady]);

  async function captureCurrentFrameBlob(v: HTMLVideoElement): Promise<{ blob: Blob; dataUrl: string }> {
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth || 640;
    canvas.height = v.videoHeight || 480;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b as Blob), 'image/jpeg', 0.9));
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    return { blob, dataUrl };
  }
  async function captureSample() {
    if (!video || !faceReady) return;
    if (samples.length >= 5) {
      toast({ title: 'Limite atingido', description: 'Use no maximo 5 amostras', status: 'info' });
      return;
    }
    setCapturing(true);
    toast({ title: 'Captura iniciada', status: 'info', duration: 1200 });
    try {
      const emb = await getEmbeddingFor(video);
      if (!emb) {
        toast({ title: 'Rosto nao detectado', status: 'warning' });
        return;
      }
      const { blob, dataUrl } = await captureCurrentFrameBlob(video);
      setPhotoBlobs((prev) => [...prev, blob]);
      setPhotoPreviews((prev) => [...prev, dataUrl]);
      setSamples((prev) => [...prev, Array.from(emb) as number[]]);
    } finally {
      setCapturing(false);
    }
  }

  const save = handleSubmit(
    async (data) => {
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
      } satisfies Record<string, any>;

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

      const created = await addDoc(collection(db, 'students'), payload);

      if (photoBlobs.length) {
        const photos: string[] = [];
        for (let i = 0; i < photoBlobs.length; i += 1) {
          const blob = photoBlobs[i];
          const path = `students/${created.id}/${Date.now()}-${i}.jpg`;
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
        await updateDoc(doc(db, 'students', created.id), updateData);
      }

      toast({ title: 'Aluno criado', status: 'success' });
      try {
        if (video?.srcObject) {
          (video.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
        }
      } catch {}
      setVideo(null);
      router.push('/admin/students');
    },
    () => {
      toast({ title: 'Formulario invalido', status: 'error' });
    }
  );

  const disableSubmit = !isValid || isSubmitting || !activePlanIdValue;
  const videoSize = useBreakpointValue({ base: 300, md: 500 });

  return (
    <VStack align="stretch" spacing={6}>
      <Tabs
        variant="enclosed"
        isLazy
        lazyBehavior="unmount"
        index={tabIndex}
        onChange={(index) => {
          if (tabIndex === FACE_TAB_INDEX && index !== FACE_TAB_INDEX) {
            try {
              if (video?.srcObject) {
                (video.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
              }
            } catch {}
            setVideo(null);
            setCapturing(false);
          }
          setTabIndex(index);
        }}
      >
        <TabList>
          <Tab _selected={{ color: '#000', borderColor: '#bfbfbf', borderWidth: '1px', borderBottomColor: 'white' }}>Dados gerais</Tab>
          <Tab _selected={{ color: '#000', borderColor: '#bfbfbf', borderWidth: '1px', borderBottomColor: 'white' }}>Cobrança</Tab>
          <Tab _selected={{ color: '#000', borderColor: '#bfbfbf', borderWidth: '1px', borderBottomColor: 'white' }}>Ficha t e9cnica</Tab>
          <Tab _selected={{ color: '#000', borderColor: '#bfbfbf', borderWidth: '1px', borderBottomColor: 'white' }}>Biometria facial</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <PageCard>
              <VStack align="stretch" spacing={6}>
                <HStack>
                  <Icon name='users' />
                  <Text fontSize="xl" fontWeight={700}>Cadastro de aluno</Text>
                </HStack>
                <VStack align="stretch" spacing={4}>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} alignItems="start">
                    <VStack align="stretch" spacing={4}>
                      <HStack spacing={3} wrap="wrap">
                        <Controller name="name" control={control} render={({ field, fieldState }) => (
                          <FormControl isInvalid={!!fieldState.error} isRequired>
                            <FormLabel>Nome</FormLabel>
                            <Input placeholder="Nome" {...field} />
                            <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                          </FormControl>
                        )}/>
                        <Controller name="birthDate" control={control} render={({ field, fieldState }) => (
                          <FormControl isInvalid={!!fieldState.error} isRequired>
                            <FormLabel>Data de nascimento</FormLabel>
                            <Input type="date" placeholder="Data de nascimento" {...field} />
                            <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                          </FormControl>
                        )}/>
                      </HStack>
                      <HStack spacing={3} wrap="wrap">
                        <Controller name="email" control={control} render={({ field, fieldState }) => (
                          <FormControl isInvalid={!!fieldState.error} isRequired={!isMinorNow}>
                            <FormLabel>E-mail</FormLabel>
                            <Input type="email" placeholder="E-mail" {...field} />
                            <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                          </FormControl>
                        )}/>
                        <Controller name="whatsapp" control={control} render={({ field, fieldState }) => (
                          <FormControl isInvalid={!!fieldState.error} isRequired={!isMinorNow}>
                            <FormLabel>WhatsApp</FormLabel>
                            <Input as={IMaskInput as any} mask="(00) 00000-0000" placeholder="WhatsApp" value={field.value as any} onAccept={(val:any)=>field.onChange(val)} />
                            <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                          </FormControl>
                        )}/>
                      </HStack>
                      <Controller
                        name="active"
                        control={control}
                        render={({ field }) => (
                          <Checkbox isChecked={!!field.value} onChange={(e) => field.onChange(e.target.checked)}>Ativo</Checkbox>
                        )}
                      />
                    </VStack>
                    <VStack align="stretch" spacing={2}>
                      <Text fontWeight={600} marginTop={5}>Dados do responsável</Text>
                      <Text color="gray.600" fontSize="sm" marginBottom={1}>Obrigatório telefone e e-mail do responsável para menor de idade</Text>
                      <HStack spacing={3} wrap="wrap">
                        <Controller name="guardianName" control={control} render={({ field, fieldState }) => (
                          <FormControl isInvalid={!!fieldState.error} isRequired={isMinorNow} isDisabled={!isMinorNow}>
                            <FormLabel>Nome do responsável</FormLabel>
                            <Input placeholder="Nome do responsável" {...field} />
                            <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                          </FormControl>
                        )}/>
                        <Controller name="guardianEmail" control={control} render={({ field, fieldState }) => (
                          <FormControl marginTop={0.5} isInvalid={!!fieldState.error} isDisabled={!isMinorNow}>
                            <FormLabel>E-mail do responsável</FormLabel>
                            <Input type="email" placeholder="E-mail do responsável" {...field} />
                            <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                          </FormControl>
                        )}/>
                        <Controller name="guardianPhone" control={control} render={({ field, fieldState }) => (
                          <FormControl marginTop={0.5} isInvalid={!!fieldState.error} isRequired={isMinorNow} isDisabled={!isMinorNow}>
                            <FormLabel>WhatsApp do responsável</FormLabel>
                            <Input as={IMaskInput as any} mask="(00) 00000-0000" placeholder="WhatsApp do responsável" value={field.value as any} onAccept={(val:any)=>field.onChange(val)} />
                            <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                          </FormControl>
                        )}/>
                      </HStack>
                    </VStack>
                  </SimpleGrid>
                </VStack>
              </VStack>
            </PageCard>
          </TabPanel>
          <TabPanel>
            <PageCard>
              <VStack align="stretch" spacing={6}>
                <HStack>
                  <Icon name='creditCard' />
                  <Text fontSize="xl" fontWeight={700}>Dados de cobrança</Text>
                </HStack>
                <VStack align="stretch" spacing={4}>
                  <VStack align="stretch" spacing={3}>
                    <Controller
                      name="activePlanId"
                      control={control}
                      render={({ field, fieldState }) => (
                        <FormControl isInvalid={!!fieldState.error} isRequired maxW="280px">
                          <FormLabel>Plano</FormLabel>
                          <Select placeholder="Selecione um plano" {...field}>
                            {plans.map((plan) => (
                              <option key={plan.id} value={plan.id}>{plan.name}</option>
                            ))}
                          </Select>
                          <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                        </FormControl>
                      )}
                    />
                  </VStack>
                  {plans.length === 0 ? (
                    <Alert status="warning">
                      <AlertIcon />
                      <AlertTitle fontSize="sm">Nenhum plano sincronizado</AlertTitle>
                      <AlertDescription fontSize="sm">Cadastre e sincronize um plano no Pagar.me para liberar as assinaturas.</AlertDescription>
                    </Alert>
                  ) : selectedPlan ? (
                    <Text fontSize="sm" color="gray.600">
                      Valor: {selectedPlan.price ? currencyFormatter.format(selectedPlan.price) : '-'}
                      {selectedPlanMethods ? ` - Métodos: ${selectedPlanMethods}` : ''}
                    </Text>
                  ) : null}
                  <Divider />
                  <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
                    <Controller name="billingDistrict" control={control} render={({ field, fieldState }) => (
                      <FormControl isInvalid={!!fieldState.error} isRequired>
                        <FormLabel>Bairro</FormLabel>
                        <Input placeholder="Bairro" {...field} />
                        <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                      </FormControl>
                    )}/>
                    <Controller name="billingCity" control={control} render={({ field, fieldState }) => (
                      <FormControl isInvalid={!!fieldState.error} isRequired>
                        <FormLabel>Cidade</FormLabel>
                        <Input placeholder="Cidade" {...field} />
                        <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                      </FormControl>
                    )}/>
                    <Controller name="billingState" control={control} render={({ field, fieldState }) => (
                      <FormControl isInvalid={!!fieldState.error} isRequired>
                        <FormLabel>UF</FormLabel>
                        <Input placeholder="UF" maxW="120px" {...field} />
                        <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                      </FormControl>
                    )}/>
                  </SimpleGrid>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                    <Controller name="billingComplement" control={control} render={({ field }) => (
                      <FormControl>
                        <FormLabel>Complemento</FormLabel>
                        <Input placeholder="Apartamento, bloco..." {...field} />
                      </FormControl>
                    )}/>
                    <Controller name="billingCountry" control={control} render={({ field, fieldState }) => (
                      <FormControl isInvalid={!!fieldState.error} isRequired>
                        <FormLabel>País</FormLabel>
                        <Input placeholder="BR" maxW="160px" {...field} />
                        <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                      </FormControl>
                    )}/>
                  </SimpleGrid>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                    <Controller name="billingName" control={control} render={({ field, fieldState }) => (
                      <FormControl isInvalid={!!fieldState.error} isRequired>
                        <FormLabel>Pagador</FormLabel>
                        <Input placeholder="Nome completo do pagador" {...field} />
                        <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                      </FormControl>
                    )}/>
                    <Controller name="billingEmail" control={control} render={({ field, fieldState }) => (
                      <FormControl isInvalid={!!fieldState.error} isRequired>
                        <FormLabel>E-mail do pagador</FormLabel>
                        <Input type="email" placeholder="email@exemplo.com" {...field} />
                        <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                      </FormControl>
                    )}/>
                  </SimpleGrid>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                    <Controller name="billingDocument" control={control} render={({ field, fieldState }) => (
                      <FormControl isInvalid={!!fieldState.error} isRequired>
                        <FormLabel>CPF do pagador</FormLabel>
                        <Input
                          as={IMaskInput as any}
                          mask="000.000.000-00"
                          placeholder="000.000.000-00"
                          value={field.value as any}
                          name={field.name}
                          onBlur={field.onBlur}
                          onAccept={(val: any) => field.onChange(val)}
                          onChange={(e: any) => field.onChange(e?.target?.value)}
                        />
                        <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                      </FormControl>
                    )}/>
                    <Controller name="billingPhone" control={control} render={({ field, fieldState }) => (
                      <FormControl isInvalid={!!fieldState.error} isRequired>
                        <FormLabel>Telefone do pagador</FormLabel>
                        <Input
                          as={IMaskInput as any}
                          mask="(00) 00000-0000"
                          placeholder="(00) 00000-0000"
                          value={field.value as any}
                          name={field.name}
                          onBlur={field.onBlur}
                          onAccept={(val: any) => field.onChange(val)}
                          onChange={(e: any) => field.onChange(e?.target?.value)}
                        />
                        <FormErrorMessage>{fieldState.error?.message as any}</FormErrorMessage>
                      </FormControl>
                    )}/>
                  </SimpleGrid>
                </VStack>
              </VStack>
            </PageCard>
          </TabPanel>
          <TabPanel>
            <PageCard>
              <VStack align="stretch" spacing={4}>
                <VStack align="stretch" spacing={3}>
                  <HStack>
                    <Icon name='settings' />
                    <Text fontSize="lg" fontWeight={700}>Ficha técnica</Text>
                  </HStack>
                </VStack>
                <HStack spacing={3} wrap="wrap">
                  <Controller name="weightKg" control={control} render={({ field }) => (
                    <FormControl>
                      <FormLabel>Peso (kg)</FormLabel>
                      <Input
                        as={IMaskInput as any}
                        mask={Number}
                        radix=","
                        mapToRadix={["."]}
                        thousandsSeparator="."
                        scale={2}
                        normalizeZeros
                        padFractionalZeros
                        placeholder="Peso (kg)"
                        maxW="200px"
                        value={field.value as any}
                        onAccept={(val: any) => field.onChange(val)}
                      />
                    </FormControl>
                  )}/>
                  <Controller name="heightCm" control={control} render={({ field }) => (
                    <FormControl>
                      <FormLabel>Altura (cm)</FormLabel>
                      <Input
                        as={IMaskInput as any}
                        mask={Number}
                        radix=","
                        mapToRadix={["."]}
                        thousandsSeparator="."
                        scale={2}
                        normalizeZeros
                        padFractionalZeros
                        placeholder="Altura (cm)"
                        maxW="200px"
                        value={field.value as any}
                        onAccept={(val: any) => field.onChange(val)}
                      />
                    </FormControl>
                  )}/>
                </HStack>
                <Controller name="techNotes" control={control} render={({ field }) => (
                  <FormControl>
                    <FormLabel>Histórico/observações</FormLabel>
                    <Textarea placeholder="Histórico/observações" {...field} />
                  </FormControl>
                )}/>
              </VStack>
            </PageCard>
          </TabPanel>

          <TabPanel>
            <PageCard>
              <VStack align="stretch" spacing={4}>
                <VStack align="stretch" spacing={3}>
                  <HStack>
                    <Icon name='camera' />
                    <Text fontSize="lg" fontWeight={700}>Biometria facial</Text>
                  </HStack>
                  <VStack align="stretch" spacing={2}>
                    <Badge colorScheme={faceReady ? 'green' : faceErr ? 'red' : 'gray'} alignSelf="flex-start">
                      Modelos {faceReady ? 'OK' : faceErr ? 'Erro' : 'Carregando'}
                    </Badge>
                    <Badge colorScheme={samples.length >= 3 ? 'green' : 'red'} alignSelf="flex-start">
                      {samples.length >= 3 ? `${samples.length} amostras` : 'Minimo de 3 amostras'}
                    </Badge>
                  </VStack>
                </VStack>
                <Text color="gray.600">Colete pelo menos 3 amostras com boa iluminacao e rosto centralizado.</Text>
                {!!faceErr && <Text color='red.500' fontSize='sm'>{faceErr}</Text>}
                <Box
                  position="relative"
                  width={{ base: '100%', md: '500px' }}
                  height={{ base: '300px', md: '500px' }}
                  display="inline-block"
                  maxW="500px"
                >
                  <VideoCanvas size={videoSize || 300} onReady={setVideo} />
                  {capturing && (
                    <Box
                      position="absolute"
                      inset={0}
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      bg="rgba(0,0,0,0.35)"
                      zIndex={1}
                    >
                      <HStack
                        spacing={3}
                        bg="rgba(255,255,255,0.9)"
                        px={4}
                        py={2}
                        borderRadius="md"
                        boxShadow="md"
                      >
                        <Spinner size="sm" />
                        <Text color="gray.800" fontWeight={600}>Capturando...</Text>
                      </HStack>
                    </Box>
                  )}
                </Box>
                <LivenessHint ok={livenessOk} />
                <VStack align="stretch" spacing={2}>
                  <Button
                    variant='secondary'
                    onClick={captureSample}
                    isDisabled={!video || !faceReady || capturing || samples.length >= 5}
                    isLoading={capturing}
                    loadingText="Capturando..."
                  >
                    Capturar amostra
                  </Button>
                  <Text color="gray.700" textAlign="center">Amostras coletadas: {samples.length}/5</Text>
                </VStack>
                {photoPreviews.length > 0 && (
                  <SimpleGrid columns={{ base: 3, md: 5 }} spacing={2}>
                    {photoPreviews.map((src, index) => (
                      <Box key={index} position="relative" boxSize="96px">
                        <Image src={src} alt={`amostra ${index + 1}`} borderRadius="md" boxSize="96px" objectFit="cover" />
                        <Button
                          size="xs"
                          onClick={() => openConfirm(index)}
                          position="absolute"
                          top={1}
                          right={1}
                          borderRadius="full"
                          bg="white"
                          _hover={{ bg: 'red.500', color: 'white' }}
                        >
                          x
                        </Button>
                      </Box>
                    ))}
                  </SimpleGrid>
                )}
              </VStack>
            </PageCard>
          </TabPanel>
        </TabPanels>
      </Tabs>

      <HStack justify="flex-end">
        <Button
          variant="ghost"
          onClick={() => {
            try {
              if (video?.srcObject) {
                (video.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
              }
            } catch {}
            setVideo(null);
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
