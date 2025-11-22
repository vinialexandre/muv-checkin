'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
  VStack,
  SimpleGrid
} from '@chakra-ui/react'
import { IMaskInput } from 'react-imask'
import { Icon } from '@/components/Icon'

type CepResponse = {
  cep: string
  logradouro: string
  complemento: string
  bairro: string
  localidade: string
  uf: string
  erro?: boolean
}

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
  billingZipCode: yup.string().required('CEP obrigatório').test('cep', 'CEP inválido', (value) => onlyDigits(value).length === 8),
  billingStreet: yup.string().trim().min(2, 'Rua obrigatória').required('Rua obrigatória'),
  billingNumber: yup.string().trim().min(1, 'Número obrigatório').required('Número obrigatório'),
  billingComplement: yup.string().trim().optional(),
  billingDistrict: yup.string().trim().min(2, 'Bairro obrigatório').required('Bairro obrigatório'),
  billingCity: yup.string().trim().min(2, 'Cidade obrigatória').required('Cidade obrigatória'),
  billingState: yup.string().trim().required('UF obrigatória').test('uf', 'UF inválida', (value) => /^[A-Za-z]{2}$/.test(String(value || '').toUpperCase())),
  billingCountry: yup.string().trim().required('País obrigatório').test('country', 'País inválido', (value) => /^([A-Za-z]{2}|[A-Za-z]{2,})$/.test(String(value || ''))),
  cardNumber: yup.string().when('paymentMethod', {
    is: (v: any) => v === 'credit_card',
    then: (s) => s.required('Número do cartão obrigatório').test('card', 'Número inválido', (value) => {
      const d = onlyDigits(value)
      return d.length >= 13 && d.length <= 19
    }),
    otherwise: (s) => s.optional(),
  }),
  cardHolder: yup.string().when('paymentMethod', {
    is: (v: any) => v === 'credit_card',
    then: (s) => s.trim().min(3, 'Nome do titular obrigatório').required('Nome do titular obrigatório'),
    otherwise: (s) => s.optional(),
  }),
  cardExp: yup.string().when('paymentMethod', {
    is: (v: any) => v === 'credit_card',
    then: (s) => s.required('Validade obrigatória').test('exp', 'Use MM/AA', (value) => /^\d{2}\/\d{2}$/.test(String(value || ''))),
    otherwise: (s) => s.optional(),
  }),
  cardCvv: yup.string().when('paymentMethod', {
    is: (v: any) => v === 'credit_card',
    then: (s) => s.required('CVV obrigatório').test('cvv', 'CVV inválido', (value) => {
      const d = onlyDigits(value)
      return d.length >= 3 && d.length <= 4
    }),
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
  billingCountry: 'BR',
  cardNumber: '',
  cardHolder: '',
  cardExp: '',
  cardCvv: ''
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
  const [loadingCep, setLoadingCep] = useState(false)

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<FormValues>({
    mode: 'onChange',
    resolver: yupResolver(schema) as any,
    defaultValues
  })

  const currentMethod = watch('paymentMethod')
  const currentZipCode = watch('billingZipCode')

  const searchCep = useCallback(async (cep: string) => {
    const cleanCep = onlyDigits(cep)

    if (cleanCep.length !== 8) return

    setLoadingCep(true)

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`)
      const data: CepResponse = await response.json()

      if (data.erro) {
        throw new Error('CEP não encontrado')
      }

      setValue('billingStreet', data.logradouro || '')
      setValue('billingDistrict', data.bairro || '')
      setValue('billingCity', data.localidade || '')
      setValue('billingState', data.uf || '')
      setValue('billingCountry', 'BR')

    } catch (error) {
      console.error('Erro ao buscar CEP:', error)
    } finally {
      setLoadingCep(false)
    }
  }, [setValue])

  useEffect(() => {
    console.log('CEP mudou:', currentZipCode)
    if (currentZipCode) {
      const cleanCep = onlyDigits(currentZipCode)
      console.log('CEP limpo:', cleanCep, 'length:', cleanCep.length)
      if (cleanCep.length === 8) {
        console.log('Chamando searchCep')
        searchCep(currentZipCode)
      }
    }
  }, [currentZipCode, searchCep])

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
        const studentData = json.studentData
        const plans = json.plans || []

        if (!studentData) throw new Error('Dados do aluno não encontrados')

        const billingContact = studentData?.billingContact || {}
        const billingAddress = studentData?.billingAddress || {}

        const name = billingContact?.name || studentData?.name || ''
        const email = billingContact?.email || studentData?.email || ''
        const document = billingContact?.document || ''
        const phone = billingContact?.phone || studentData?.phone || studentData?.whatsapp || ''

        setStudentName(studentData?.name || '')
        setAllowedPlans(plans)

        const defaultId = plans.find((p: any) => p.id === basePlanId)?.id || plans[0]?.id || ''
        setSelectedPlanId(defaultId)

        const selected = plans.find((p: any) => p.id === defaultId)
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

  const PUBLIC_KEY = process.env.NEXT_PUBLIC_PAGARME_PUBLIC_KEY as string | undefined

  const tokenizeCardV5 = useCallback(async (params: { number: string; holder: string; exp: string; cvv: string }) => {
    if (!PUBLIC_KEY) throw new Error('chave_publica_ausente')
    const num = onlyDigits(params.number)
    const cvv = onlyDigits(params.cvv)
    const [mmRaw, yyRaw] = String(params.exp || '').split('/')
    const exp_month = onlyDigits(mmRaw || '').padStart(2, '0').slice(0,2)
    const yy = onlyDigits(yyRaw || '').slice(-2)
    const yearPrefix = Number(yy) <= 79 ? '20' : '19'
    const exp_year = (yearPrefix + yy)
    const res = await fetch('https://api.pagar.me/core/v5/tokens', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(PUBLIC_KEY + ':'),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'card',
        card: {
          number: num,
          holder_name: params.holder,
          exp_month,
          exp_year,
          cvv
        }
      })
    })
    const json = await res.json().catch(() => ({} as any))
    if (!res.ok) {
      const msg = json?.message || json?.error || 'falha_tokenizar_cartao'
      throw new Error(msg)
    }
    return json?.id || json?.token || ''
  }, [PUBLIC_KEY])


  const onSubmit = async (values: FormValues) => {
    if (!token) return
    setSubmitError(undefined)
    try {
      let cardToken: string | undefined
      if (values.paymentMethod === 'credit_card') {
        cardToken = await tokenizeCardV5({
          number: String(values.cardNumber || ''),
          holder: String(values.cardHolder || ''),
          exp: String(values.cardExp || ''),
          cvv: String(values.cardCvv || '')
        })
      }

      const payload: any = {
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
      if (cardToken) payload.cardToken = cardToken

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
      <Box px={{ base: 4, md: 6, lg: 8 }} py={12}>
        <Stack spacing={4} align="center">
          <Spinner size="xl" />
          <Text fontSize="md" color="gray.600">Carregando convite...</Text>
        </Stack>
      </Box>
    )
  }

  if (inviteError) {
    return (
      <Box px={{ base: 4, md: 6, lg: 8 }} py={12}>
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          <Stack spacing={1}>
            <AlertTitle>Convite inválido</AlertTitle>
            <AlertDescription>{inviteError}</AlertDescription>
          </Stack>
        </Alert>
      </Box>
    )
  }

  const disableSubmit = !methods.length || !currentMethod

  return (
    <Box px={{ base: 4, md: 6, lg: 8 }} py={{ base: 4, md: 6 }} minH="100vh">
      <VStack align="stretch" spacing={4} maxW="100%" mx="auto">
        <Stack spacing={1}>
          <Heading size="lg">Confirmar assinatura</Heading>
          <Text color="gray.600" fontSize="sm" display={{ base: 'none', md: 'block' }}>Complete os dados para finalizar</Text>
        </Stack>

        <Box bg="white" borderWidth="1px" borderRadius="lg" p={4} boxShadow="sm">
          <Stack spacing={4} direction={{ base: 'column', md: 'row' }} align={{ md: 'start' }}>
            <Stack spacing={1}>
              <Text fontSize="xs" color="gray.600" textTransform="uppercase" fontWeight={600}>Nome</Text>
              <Text fontSize="md" fontWeight={600}>{studentName || 'Aluno'}</Text>
            </Stack>
            <Divider display={{ base: 'block', md: 'none' }} />
            <Divider orientation="vertical" h="50px" display={{ base: 'none', md: 'block' }} />
            {allowedPlans.length > 1 ? (
              <Stack spacing={1}>
                <Text fontSize="xs" color="gray.600" textTransform="uppercase" fontWeight={600}>Plano</Text>
                <Select value={selectedPlanId} onChange={(e)=>setSelectedPlanId(e.target.value)} size="sm">
                  {allowedPlans.map((p)=> (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
              </Stack>
            ) : (
              <Stack spacing={1}>
                <Text fontSize="xs" color="gray.600" textTransform="uppercase" fontWeight={600}>Plano</Text>
                <Text fontSize="md" fontWeight={600}>{planName || 'Plano'}</Text>
              </Stack>
            )}
          </Stack>
        </Box>

        <Box as="form" onSubmit={handleSubmit(onSubmit as any)} borderWidth="1px" borderRadius="lg" p={6} boxShadow="sm" bg="white">
          <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={6}>
            <VStack align="stretch" spacing={4}>
              <HStack spacing={2}>
                <Icon name="creditCard" size={16} />
                <Text fontSize="sm" color="gray.600" textTransform="uppercase" fontWeight={700}>Pagamento</Text>
              </HStack>
              {methods.length ? (
                <Controller
                  name="paymentMethod"
                  control={control}
                  render={({ field }) => (
                    <RadioGroup value={field.value} onChange={field.onChange}>
                      <Stack spacing={3}>
                        {methods.map((method) => (
                          <Radio key={method} value={method}>
                            {method === 'pix' ? 'Pix' : method === 'boleto' ? 'Boleto' : 'Cartão de crédito'}
                          </Radio>
                        ))}
                      </Stack>
                    </RadioGroup>
                  )}
                />
              ) : (
                <Alert status="warning" size="sm">
                  <AlertIcon />
                  <Text fontSize="xs">Nenhum método disponível</Text>
                </Alert>
              )}
              {errors.paymentMethod && <Text color="red.500" fontSize="xs">{errors.paymentMethod.message}</Text>}

              {currentMethod === 'credit_card' && (
                <VStack align="stretch" spacing={3} pt={2}>
                  <Controller
                    name="cardNumber"
                    control={control}
                    render={({ field }) => (
                      <FormControl isInvalid={!!errors as any && !!(errors as any).cardNumber} isRequired>
                        <FormLabel fontSize="sm">Número do cartão</FormLabel>
                        <Input size="md" as={IMaskInput as any} mask="0000 0000 0000 0000 000" placeholder="0000 0000 0000 0000" value={field.value} onAccept={(val: string) => field.onChange(val)} />
                        <FormErrorMessage fontSize="xs">{(errors as any)?.cardNumber?.message as any}</FormErrorMessage>
                      </FormControl>
                    )}
                  />
                  <Controller
                    name="cardHolder"
                    control={control}
                    render={({ field }) => (
                      <FormControl isInvalid={!!(errors as any)?.cardHolder} isRequired>
                        <FormLabel fontSize="sm">Nome no cartão</FormLabel>
                        <Input size="md" placeholder="Nome do titular" {...field} />
                        <FormErrorMessage fontSize="xs">{(errors as any)?.cardHolder?.message as any}</FormErrorMessage>
                      </FormControl>
                    )}
                  />
                  <HStack spacing={3}>
                    <Controller
                      name="cardExp"
                      control={control}
                      render={({ field }) => (
                        <FormControl isInvalid={!!(errors as any)?.cardExp} isRequired>
                          <FormLabel fontSize="sm">Validade</FormLabel>
                          <Input size="md" as={IMaskInput as any} mask="00/00" placeholder="MM/AA" value={field.value} onAccept={(val: string) => field.onChange(val)} />
                          <FormErrorMessage fontSize="xs">{(errors as any)?.cardExp?.message as any}</FormErrorMessage>
                        </FormControl>
                      )}
                    />
                    <Controller
                      name="cardCvv"
                      control={control}
                      render={({ field }) => (
                        <FormControl isInvalid={!!(errors as any)?.cardCvv} isRequired>
                          <FormLabel fontSize="sm">CVV</FormLabel>
                          <Input size="md" as={IMaskInput as any} mask="0000" placeholder="CVV" value={field.value} onAccept={(val: string) => field.onChange(val)} />
                          <FormErrorMessage fontSize="xs">{(errors as any)?.cardCvv?.message as any}</FormErrorMessage>
                        </FormControl>
                      )}
                    />
                  </HStack>
                </VStack>
              )}
            </VStack>

            <VStack align="stretch" spacing={4}>
              <HStack spacing={2}>
                <Icon name="user" size={16} />
                <Text fontSize="sm" color="gray.600" textTransform="uppercase" fontWeight={700}>Dados do pagador</Text>
              </HStack>
              <Controller
                name="billingName"
                control={control}
                render={({ field }) => (
                  <FormControl isInvalid={!!errors.billingName} isRequired>
                    <FormLabel fontSize="sm">Nome completo</FormLabel>
                    <Input size="md" placeholder="Nome do pagador" {...field} />
                    <FormErrorMessage fontSize="xs">{errors.billingName?.message}</FormErrorMessage>
                  </FormControl>
                )}
              />
              <Controller
                name="billingEmail"
                control={control}
                render={({ field }) => (
                  <FormControl isInvalid={!!errors.billingEmail} isRequired>
                    <FormLabel fontSize="sm">E-mail</FormLabel>
                    <Input size="md" type="email" placeholder="email@exemplo.com" {...field} />
                    <FormErrorMessage fontSize="xs">{errors.billingEmail?.message}</FormErrorMessage>
                  </FormControl>
                )}
              />
              <Controller
                name="billingPhone"
                control={control}
                render={({ field }) => (
                  <FormControl isInvalid={!!errors.billingPhone} isRequired>
                    <FormLabel fontSize="sm">Telefone</FormLabel>
                    <Input size="md" as={IMaskInput as any} mask="(00) 00000-0000" placeholder="(00) 00000-0000" value={field.value} onAccept={(val: string) => field.onChange(val)} />
                    <FormErrorMessage fontSize="xs">{errors.billingPhone?.message}</FormErrorMessage>
                  </FormControl>
                )}
              />
              <Controller
                name="billingDocument"
                control={control}
                render={({ field }) => (
                  <FormControl isInvalid={!!errors.billingDocument} isRequired>
                    <FormLabel fontSize="sm">CPF</FormLabel>
                    <Input size="md" as={IMaskInput as any} mask="000.000.000-00" placeholder="000.000.000-00" value={field.value} onAccept={(val: string) => field.onChange(val)} />
                    <FormErrorMessage fontSize="xs">{errors.billingDocument?.message}</FormErrorMessage>
                  </FormControl>
                )}
              />
            </VStack>

            <VStack align="stretch" spacing={4}>
              <HStack spacing={2}>
                <Icon name="folder" size={16} />
                <Text fontSize="sm" color="gray.600" textTransform="uppercase" fontWeight={700}>Endereço de cobrança</Text>
              </HStack>
              <HStack spacing={3}>
                <Controller
                  name="billingZipCode"
                  control={control}
                  render={({ field }) => (
                    <FormControl isInvalid={!!errors.billingZipCode} isRequired>
                      <FormLabel fontSize="sm">CEP</FormLabel>
                      <HStack>
                        <Input size="md" as={IMaskInput as any} mask="00000-000" placeholder="00000-000" value={field.value} onAccept={(val: string) => field.onChange(val)} />
                        {loadingCep && <Spinner size="sm" />}
                      </HStack>
                      <FormErrorMessage fontSize="xs">{errors.billingZipCode?.message}</FormErrorMessage>
                    </FormControl>
                  )}
                />
                <Controller
                  name="billingNumber"
                  control={control}
                  render={({ field }) => (
                    <FormControl isInvalid={!!errors.billingNumber} isRequired maxW="140px">
                      <FormLabel fontSize="sm">Número</FormLabel>
                      <Input size="md" placeholder="Nº" {...field} />
                      <FormErrorMessage fontSize="xs">{errors.billingNumber?.message}</FormErrorMessage>
                    </FormControl>
                  )}
                />
              </HStack>
              <Controller
                name="billingStreet"
                control={control}
                render={({ field }) => (
                  <FormControl isInvalid={!!errors.billingStreet} isRequired>
                    <FormLabel fontSize="sm">Rua</FormLabel>
                    <Input size="md" placeholder="Rua" {...field} />
                    <FormErrorMessage fontSize="xs">{errors.billingStreet?.message}</FormErrorMessage>
                  </FormControl>
                )}
              />
              <Controller
                name="billingComplement"
                control={control}
                render={({ field }) => (
                  <FormControl>
                    <FormLabel fontSize="sm">Complemento</FormLabel>
                    <Input size="md" placeholder="Apto, bloco..." {...field} />
                  </FormControl>
                )}
              />
              <Controller
                name="billingDistrict"
                control={control}
                render={({ field }) => (
                  <FormControl isInvalid={!!errors.billingDistrict} isRequired>
                    <FormLabel fontSize="sm">Bairro</FormLabel>
                    <Input size="md" placeholder="Bairro" {...field} />
                    <FormErrorMessage fontSize="xs">{errors.billingDistrict?.message}</FormErrorMessage>
                  </FormControl>
                )}
              />
              <HStack spacing={3}>
                <Controller
                  name="billingCity"
                  control={control}
                  render={({ field }) => (
                    <FormControl isInvalid={!!errors.billingCity} isRequired>
                      <FormLabel fontSize="sm">Cidade</FormLabel>
                      <Input size="md" placeholder="Cidade" {...field} />
                      <FormErrorMessage fontSize="xs">{errors.billingCity?.message}</FormErrorMessage>
                    </FormControl>
                  )}
                />
                <Controller
                  name="billingState"
                  control={control}
                  render={({ field }) => (
                    <FormControl isInvalid={!!errors.billingState} isRequired maxW="100px">
                      <FormLabel fontSize="sm">UF</FormLabel>
                      <Input size="md" placeholder="UF" value={field.value} maxLength={2} textTransform="uppercase" onChange={(ev) => field.onChange(ev.target.value.toUpperCase())} />
                      <FormErrorMessage fontSize="xs">{errors.billingState?.message}</FormErrorMessage>
                    </FormControl>
                  )}
                />
              </HStack>
            </VStack>
          </SimpleGrid>

          <HStack justify="space-between" align="center" mt={6}>
            {submitError ? (
              <Alert status="error" borderRadius="md" flex="1" mr={4}>
                <AlertIcon />
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            ) : (
              <Box flex="1" />
            )}
            <Button
              type="submit"
              colorScheme="yellow"
              size="lg"
              minW="300px"
              isDisabled={disableSubmit || isSubmitting}
              isLoading={isSubmitting}
              loadingText="Processando..."
            >
              Confirmar assinatura
            </Button>
          </HStack>
        </Box>
      </VStack>
    </Box>
  )
}
