'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Controller, useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  Button,
  Container,
  Divider,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Heading,
  HStack,
  Input,
  Radio,
  RadioGroup,
  Spinner,
  Stack,
  Text,
  useToast,
  Select,
  VStack
} from '@chakra-ui/react'
import { doc, getDoc } from 'firebase/firestore'
import { IMaskInput } from 'react-imask'

import { db } from '@/lib/firebase'

const onlyDigits = (value?: string) => String(value || '').replace(/\D/g, '')

type PaymentMethod = 'pix' | 'boleto' | 'credit_card'

type PlanOption = {
  id: string
  name: string
  price?: number
  paymentMethods?: PaymentMethod[]
  pagarmePlanId?: string
}

const schema = yup.object({
  paymentMethod: yup.mixed<PaymentMethod>().oneOf(['pix', 'boleto', 'credit_card'], 'Selecione um método de pagamento').required('Selecione um método de pagamento'),
  billingName: yup.string().trim().min(3, 'Nome muito curto').required('Nome obrigatório'),
  billingEmail: yup.string().trim().lowercase().email('E-mail inválido').required('E-mail obrigatório'),
  billingDocument: yup.string().required('CPF obrigatório').test('cpf', 'CPF inválido', (value) => onlyDigits(value).length === 11),
  billingPhone: yup
    .string()
    .required('Telefone obrigatório')
    .test('phone', 'Telefone inválido', (value) => {
      const digits = onlyDigits(value)
      return digits.length === 10 || digits.length === 11
    }),
  billingZipCode: yup.string().when('paymentMethod', {
    is: (v: any) => v !== 'pix',
    then: (s) => s.required('CEP obrigatório').test('cep', 'CEP inválido', (value) => onlyDigits(value).length === 8),
    otherwise: (s) => s.optional(),
  }),
  billingStreet: yup.string().when('paymentMethod', {
    is: (v: any) => v !== 'pix',
    then: (s) => s.trim().min(2, 'Rua obrigatória').required('Rua obrigatória'),
    otherwise: (s) => s.optional(),
  }),
  billingNumber: yup.string().when('paymentMethod', {
    is: (v: any) => v !== 'pix',
    then: (s) => s.trim().min(1, 'Número obrigatório').required('Número obrigatório'),
    otherwise: (s) => s.optional(),
  }),
  billingComplement: yup.string().trim().optional(),
  billingDistrict: yup.string().when('paymentMethod', {
    is: (v: any) => v !== 'pix',
    then: (s) => s.trim().min(2, 'Bairro obrigatório').required('Bairro obrigatório'),
    otherwise: (s) => s.optional(),
  }),
  billingCity: yup.string().when('paymentMethod', {
    is: (v: any) => v !== 'pix',
    then: (s) => s.trim().min(2, 'Cidade obrigatória').required('Cidade obrigatória'),
    otherwise: (s) => s.optional(),
  }),
  billingState: yup.string().when('paymentMethod', {
    is: (v: any) => v !== 'pix',
    then: (s) => s.trim().required('UF obrigatória').test('uf', 'UF inválida', (value) => /^[A-Za-z]{2}$/.test(String(value || '').toUpperCase())),
    otherwise: (s) => s.optional(),
  }),
  billingCountry: yup.string().when('paymentMethod', {
    is: (v: any) => v !== 'pix',
    then: (s) => s.trim().required('País obrigatório').test('country', 'País inválido', (value) => /^([A-Za-z]{2}|[A-Za-z]{2,})$/.test(String(value || ''))),
    otherwise: (s) => s.optional(),
  })
})

type FormValues = yup.InferType<typeof schema>

const defaultValues: FormValues = {
  paymentMethod: 'pix',
  billingName: '',
  billingEmail: '',
  billingDocument: '',
  billingPhone: '',
  billingZipCode: '',
  billingStreet: '',
  billingNumber: '',
  billingComplement: '',
  billingDistrict: '',
  billingCity: '',
  billingState: '',
  billingCountry: 'BR'
}


// estado adicional para planos permitidos




export default function SubscribeTokenPage() {
  const params = useParams<{ token: string }>()
  const tokenParam = useMemo(() => {
    const raw = params?.token
    if (!raw) return ''
    return Array.isArray(raw) ? raw[0] : raw
  }, [params])
  const token = tokenParam
  const router = useRouter()
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [submitError, setSubmitError] = useState<string>()
  const [inviteError, setInviteError] = useState<string>()
  const [planName, setPlanName] = useState('')
  const [studentName, setStudentName] = useState('')
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [allowedPlans, setAllowedPlans] = useState<PlanOption[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState('')


  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<FormValues>({
    mode: 'onChange',
    resolver: yupResolver(schema) as any,
    defaultValues
  })

  const currentMethod = watch('paymentMethod')

  useEffect(() => {
    let active = true
    async function load() {
      if (!token) {
        setInviteError('Convite inválido')
        setLoading(false)
        return
      }
      try {
        setLoading(true)
        setInviteError(undefined)
        const res = await fetch('/api/subscribe/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        })
        const json = await res.json()
        if (!res.ok || !json?.valid) {
          throw new Error(json?.error || 'Convite inválido')
        }
        if (!active) return

        const studentId = String(json.studentId)
        const basePlanId = String(json.planId)
        const idList = Array.isArray(json.allowedPlanIds) && json.allowedPlanIds.length
          ? json.allowedPlanIds.map((x: any) => String(x))
          : [basePlanId]

        const studentSnap = await getDoc(doc(db, 'students', studentId))

        if (!studentSnap.exists()) throw new Error('Aluno não encontrado')
        const studentData = studentSnap.data() as any
        const billingContact = studentData?.billingContact || {}
        const billingAddress = studentData?.billingAddress || {}

        const name = billingContact?.name || studentData?.name || ''
        const email = billingContact?.email || studentData?.email || ''
        const document = billingContact?.document || ''
        const phone = billingContact?.phone || studentData?.phone || studentData?.whatsapp || ''

        setStudentName(studentData?.name || '')

        const planDocs = await Promise.all(idList.map((id: string) => getDoc(doc(db, 'plans', id))))
        const plans: PlanOption[] = planDocs
          .map((snap, idx) => (snap.exists() ? { id: idList[idx], ...(snap.data() as any) } : null))
          .filter(Boolean) as any
        const filtered = plans.filter((p) => (p as any)?.active !== false && String((p as any).planSyncStatus || '') === 'synced')
        setAllowedPlans(filtered)

        const defaultId = filtered.find((p) => p.id === basePlanId)?.id || filtered[0]?.id || ''
        setSelectedPlanId(defaultId)

        const selected = filtered.find((p) => p.id === defaultId)
        setPlanName(selected?.name || '')
        const allowed = Array.isArray(selected?.paymentMethods)
          ? (selected!.paymentMethods!.filter((m: any) => m === 'pix' || m === 'boleto' || m === 'credit_card')) as PaymentMethod[]
          : []
        setMethods(allowed)

        reset({
          paymentMethod: allowed?.[0] || '',
          billingName: name,
          billingEmail: email,
          billingDocument: document,
          billingPhone: phone,
          billingZipCode: billingAddress?.zipCode || '',
          billingStreet: billingAddress?.street || '',
          billingNumber: billingAddress?.number || '',
          billingComplement: billingAddress?.complement || '',
          billingDistrict: billingAddress?.district || '',
          billingCity: billingAddress?.city || '',
          billingState: billingAddress?.state || '',
          billingCountry: billingAddress?.country || 'BR'
        })


      } catch (e: any) {
        console.error(e)
        if (!active) return
        setInviteError(e?.message ? String(e.message) : 'Convite inválido')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [token, reset])

  useEffect(() => {
    const sel = allowedPlans.find((p) => p.id === selectedPlanId)
    setPlanName(sel?.name || '')
    const allowed = Array.isArray(sel?.paymentMethods)
      ? (sel!.paymentMethods!.filter((m: any) => m === 'pix' || m === 'boleto' || m === 'credit_card')) as PaymentMethod[]
      : []
    setMethods(allowed)
  }, [allowedPlans, selectedPlanId])


  const onSubmit = async (values: FormValues) => {
    if (!token) return
    setSubmitError(undefined)
    try {
      const payload = {
        token,
        planId: selectedPlanId,
        paymentMethod: values.paymentMethod,
        billingContact: {
          name: values.billingName.trim(),
          email: values.billingEmail.trim(),
          document: onlyDigits(values.billingDocument),
          phone: onlyDigits(values.billingPhone)
        },
        billingAddress: {
          zipCode: values.billingZipCode ? onlyDigits(values.billingZipCode) : undefined,
          street: values.billingStreet?.trim(),
          number: values.billingNumber?.trim(),
          complement: values.billingComplement?.trim() || undefined,
          district: values.billingDistrict?.trim(),
          city: values.billingCity?.trim(),
          state: values.billingState?.trim().toUpperCase(),
          country: values.billingCountry?.trim().toUpperCase()
        }
      }

      const res = await fetch('/api/subscribe/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const json = await res.json()
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || 'Falha ao criar assinatura')
      }
      toast({ title: 'Assinatura criada', status: 'success' })
      const invoiceId = json.invoiceId as string | undefined
      const subscriptionId = json.subscriptionId as string | undefined
      if (invoiceId) router.push(`/pay/${invoiceId}`)
      else if (subscriptionId) router.push(`/invoices/${subscriptionId}`)
      else router.push('/')
    } catch (e: any) {
      const message = String(e?.message || e || 'Erro desconhecido')
      setSubmitError(message)
      toast({ title: 'Erro ao criar assinatura', description: message, status: 'error' })
    }
  }

  if (loading) {
    return (
      <Container maxW="lg" py={12}>
        <Stack spacing={6} align="center">
          <Spinner size="xl" />
          <Text fontSize="lg" color="gray.600">Carregando convite...</Text>
        </Stack>
      </Container>
    )
  }

  if (inviteError) {
    return (
      <Container maxW="lg" py={12}>
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          <Stack spacing={1}>
            <AlertTitle>Convite inválido</AlertTitle>
            <AlertDescription>{inviteError}</AlertDescription>
          </Stack>
        </Alert>
      </Container>
    )
  }

  const disableSubmit = !methods.length || !currentMethod

  return (
    <Container maxW="lg" py={{ base: 8, md: 12 }}>
      <VStack align="stretch" spacing={6}>
        <Stack spacing={1}>
          <Heading size="lg">Assinatura</Heading>
          <Text color="gray.600">Confirme os dados de cobrança para concluir a assinatura.</Text>
        </Stack>

        <Box borderWidth="1px" borderRadius="lg" p={{ base: 6, md: 8 }} boxShadow="sm" bg="white">
          <VStack align="stretch" spacing={6}>
            <Stack spacing={1}>
              <Text fontWeight={600}>Aluno</Text>
              <Text color="gray.700">{studentName || 'Aluno'}</Text>
            </Stack>
            <Stack spacing={1}>
                {allowedPlans.length > 1 && (
                  <Stack spacing={3}>
                    <Text fontWeight={600}>Plano</Text>
                    <FormControl>
                      <Select value={selectedPlanId} onChange={(e)=>setSelectedPlanId(e.target.value)}>
                        {allowedPlans.map((p)=> (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </Select>
                    </FormControl>
                  </Stack>
                )}

              <Text fontWeight={600}>Plano</Text>
              <Text color="gray.700">{planName || 'Plano selecionado'}</Text>
            </Stack>
            <Divider />

            <form onSubmit={handleSubmit(onSubmit as any)}>
              <VStack align="stretch" spacing={5}>
                <Stack spacing={3}>
                  <Text fontWeight={600}>Método de pagamento</Text>
                  {methods.length ? (
                    <Controller
                      name="paymentMethod"
                      control={control}
                      render={({ field }) => (
                        <RadioGroup value={field.value} onChange={field.onChange}>
                          <HStack spacing={4} wrap="wrap">
                            {methods.map((method) => (
                              <Radio key={method} value={method}>
                                {method === 'pix' ? 'Pix' : method === 'boleto' ? 'Boleto' : 'Cartão de crédito'}
                              </Radio>
                            ))}
                          </HStack>
                        </RadioGroup>
                      )}
                    />
                  ) : (
                    <Alert status="warning" borderRadius="md">
                      <AlertIcon />
                      <Text>Nenhum método de pagamento disponível neste plano. Entre em contato com o suporte.</Text>
                    </Alert>
                  )}
                  {errors.paymentMethod && <Text color="red.500" fontSize="sm">{errors.paymentMethod.message}</Text>}
                </Stack>

                <Stack spacing={4}>
                  <Text fontWeight={600}>Dados do pagador</Text>
                  <Controller
                    name="billingName"
                    control={control}
                    render={({ field }) => (
                      <FormControl isInvalid={!!errors.billingName} isRequired>
                        <FormLabel>Nome completo</FormLabel>
                        <Input placeholder="Nome do pagador" {...field} />
                        <FormErrorMessage>{errors.billingName?.message}</FormErrorMessage>
                      </FormControl>
                    )}
                  />
                  <Controller
                    name="billingEmail"
                    control={control}
                    render={({ field }) => (
                      <FormControl isInvalid={!!errors.billingEmail} isRequired>
                        <FormLabel>E-mail</FormLabel>
                        <Input type="email" placeholder="email@exemplo.com" {...field} />
                        <FormErrorMessage>{errors.billingEmail?.message}</FormErrorMessage>
                      </FormControl>
                    )}
                  />
                  <Controller
                    name="billingDocument"
                    control={control}
                    render={({ field }) => (
                      <FormControl isInvalid={!!errors.billingDocument} isRequired>
                        <FormLabel>CPF</FormLabel>
                        <Input as={IMaskInput as any} mask="000.000.000-00" placeholder="000.000.000-00" value={field.value} onAccept={(val: string) => field.onChange(val)} />
                        <FormErrorMessage>{errors.billingDocument?.message}</FormErrorMessage>
                      </FormControl>
                    )}
                  />
                  <Controller
                    name="billingPhone"
                    control={control}
                    render={({ field }) => (
                      <FormControl isInvalid={!!errors.billingPhone} isRequired>
                        <FormLabel>Telefone</FormLabel>
                        <Input as={IMaskInput as any} mask="(00) 00000-0000" placeholder="(00) 00000-0000" value={field.value} onAccept={(val: string) => field.onChange(val)} />
                        <FormErrorMessage>{errors.billingPhone?.message}</FormErrorMessage>
                      </FormControl>
                    )}
                  />
                </Stack>

                <Stack spacing={4}>
                  <Text fontWeight={600}>Endereço de cobrança</Text>
                  <Controller
                    name="billingZipCode"
                    control={control}
                    render={({ field }) => (
                      <FormControl isInvalid={!!errors.billingZipCode} isRequired>
                        <FormLabel>CEP</FormLabel>
                        <Input as={IMaskInput as any} mask="00000-000" placeholder="00000-000" value={field.value} onAccept={(val: string) => field.onChange(val)} />
                        <FormErrorMessage>{errors.billingZipCode?.message}</FormErrorMessage>
                      </FormControl>
                    )}
                  />
                  <Controller
                    name="billingStreet"
                    control={control}
                    render={({ field }) => (
                      <FormControl isInvalid={!!errors.billingStreet} isRequired>
                        <FormLabel>Rua</FormLabel>
                        <Input placeholder="Rua" {...field} />
                        <FormErrorMessage>{errors.billingStreet?.message}</FormErrorMessage>
                      </FormControl>
                    )}
                  />
                  <HStack spacing={4} align="flex-start">
                    <Controller
                      name="billingNumber"
                      control={control}
                      render={({ field }) => (
                        <FormControl isInvalid={!!errors.billingNumber} isRequired>
                          <FormLabel>Número</FormLabel>
                          <Input placeholder="Número" {...field} />
                          <FormErrorMessage>{errors.billingNumber?.message}</FormErrorMessage>
                        </FormControl>
                      )}
                    />
                    <Controller
                      name="billingComplement"
                      control={control}
                      render={({ field }) => (
                        <FormControl>
                          <FormLabel>Complemento</FormLabel>
                          <Input placeholder="Apartamento, bloco..." {...field} />
                        </FormControl>
                      )}
                    />
                  </HStack>
                  <Controller
                    name="billingDistrict"
                    control={control}
                    render={({ field }) => (
                      <FormControl isInvalid={!!errors.billingDistrict} isRequired>
                        <FormLabel>Bairro</FormLabel>
                        <Input placeholder="Bairro" {...field} />
                        <FormErrorMessage>{errors.billingDistrict?.message}</FormErrorMessage>
                      </FormControl>
                    )}
                  />
                  <HStack spacing={4} align="flex-start">
                    <Controller
                      name="billingCity"
                      control={control}
                      render={({ field }) => (
                        <FormControl isInvalid={!!errors.billingCity} isRequired>
                          <FormLabel>Cidade</FormLabel>
                          <Input placeholder="Cidade" {...field} />
                          <FormErrorMessage>{errors.billingCity?.message}</FormErrorMessage>
                        </FormControl>
                      )}
                    />
                    <Controller
                      name="billingState"
                      control={control}
                      render={({ field }) => (
                        <FormControl isInvalid={!!errors.billingState} isRequired maxW="120px">
                          <FormLabel>UF</FormLabel>
                          <Input placeholder="UF" value={field.value} maxLength={2} textTransform="uppercase" onChange={(ev) => field.onChange(ev.target.value.toUpperCase())} />
                          <FormErrorMessage>{errors.billingState?.message}</FormErrorMessage>
                        </FormControl>
                      )}
                    />
                    <Controller
                      name="billingCountry"
                      control={control}
                      render={({ field }) => (
                        <FormControl isInvalid={!!errors.billingCountry} isRequired maxW="140px">
                          <FormLabel>País</FormLabel>
                          <Input placeholder="País" value={field.value} onChange={(ev) => field.onChange(ev.target.value.toUpperCase())} />
                          <FormErrorMessage>{errors.billingCountry?.message}</FormErrorMessage>
                        </FormControl>
                      )}
                    />
                  </HStack>
                </Stack>

                {submitError && (
                  <Alert status="error" borderRadius="md">
                    <AlertIcon />
                    <AlertDescription>{submitError}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  colorScheme="yellow"
                  size="lg"
                  isDisabled={disableSubmit || isSubmitting}
                  isLoading={isSubmitting}
                  loadingText="Criando..."
                >
                  Confirmar assinatura
                </Button>
              </VStack>
            </form>
          </VStack>
        </Box>
      </VStack>
    </Container>
  )
}
