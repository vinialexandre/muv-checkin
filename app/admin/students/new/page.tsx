"use client";
import PageCard from '@/components/PageCard';
import { db } from '@/lib/firebase';
import { Button, Checkbox, FormControl, FormErrorMessage, HStack, Input, Select, Text, VStack, useToast } from '@chakra-ui/react';
import { addDoc, collection, getDocs } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { IMaskInput } from 'react-imask';

type Plan = { id: string; name: string };

export default function NewStudentPage() {
  const router = useRouter();
  const toast = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [active, setActive] = useState(true);
  const [activePlanId, setActivePlanId] = useState<string>('');
  const [nameErr, setNameErr] = useState<string|undefined>();
  const [phoneErr, setPhoneErr] = useState<string|undefined>();
  const [saving, setSaving] = useState(false);

  useEffect(()=>{
    getDocs(collection(db,'plans')).then(s => setPlans(s.docs.map(d => ({ id: d.id, ...(d.data() as any) }))));
  }, []);

  function validate(): boolean {
    let ok = true;
    if (!name || name.trim().length < 2) { setNameErr('Nome obrigatório'); ok = false; }
    const digits = (phone||'').replace(/\D/g,'');
    if (digits && !(digits.length===10 || digits.length===11)) { setPhoneErr('Telefone inválido'); ok = false; }
    return ok;
  }

  async function save() {
    if (!validate()) return;
    setSaving(true);
    try {
      await addDoc(collection(db,'students'), { name, phone, active, activePlanId: activePlanId || undefined });
      toast({ title:'Aluno criado', status:'success' });
      router.push('/admin/students');
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageCard>
      <VStack align="stretch" spacing={4}>
        <Text fontSize="lg" fontWeight={600}>Cadastro de aluno</Text>
        <HStack spacing={3} wrap="wrap">
          <FormControl isInvalid={!!nameErr} isRequired>
            <Input placeholder="Nome" value={name} onChange={(e)=>{ setName(e.target.value); if (nameErr) setNameErr(undefined); }} onBlur={()=>{ if (!name || name.trim().length<2) setNameErr('Nome obrigatório'); }} />
            <FormErrorMessage>{nameErr}</FormErrorMessage>
          </FormControl>
          <FormControl isInvalid={!!phoneErr}>
            <Input as={IMaskInput as any} mask="(00) 00000-0000" placeholder="Telefone" value={phone as any} onAccept={(val:any)=>{ setPhone(val); if (phoneErr) setPhoneErr(undefined); }} onBlur={()=>{ const d=(phone||'').replace(/\D/g,''); if (d && !(d.length===10||d.length===11)) setPhoneErr('Telefone inválido'); }} />
            <FormErrorMessage>{phoneErr}</FormErrorMessage>
          </FormControl>
          <Select placeholder="Plano" value={activePlanId} onChange={(e)=>setActivePlanId(e.target.value)} maxW="240px">
            {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Checkbox isChecked={active} onChange={(e)=>setActive(e.target.checked)}>Ativo</Checkbox>
        </HStack>
        <HStack justify="flex-end">
          <Button variant="ghost" onClick={()=>router.push('/admin/students')}>Cancelar</Button>
          <Button colorScheme="blue" onClick={save} isLoading={saving}>Salvar</Button>
        </HStack>
      </VStack>
    </PageCard>
  );
}

