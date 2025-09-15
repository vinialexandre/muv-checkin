"use client";
import { Box, Flex, Link as CLink, Button, VStack, Text } from '@chakra-ui/react';
import Link from 'next/link';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const navItems = [
  { href: '/admin/students', label: 'Alunos', icon: 'ðŸ‘¥' },
  { href: '/admin/plans', label: 'Planos', icon: 'ðŸ—‚' },
  { href: '/kiosk', label: 'Kiosque', icon: 'ðŸ–¥' },
  { href: '/admin/users', label: 'UsuÃ¡rios', icon: 'ðŸ‘¤' },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [role, setRole] = useState<string|undefined>();
  const [userEmail, setUserEmail] = useState<string|undefined>();
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { setRole(undefined); setUserEmail(undefined); return; }
      const idt = await user.getIdTokenResult(true);
      const r = (idt.claims as any).role || ((idt.claims as any).admin ? 'admin' : undefined);
      setRole(r);
      setUserEmail(user.email || undefined);
    });
    return () => unsub();
  }, []);
  return (
    <Flex direction="column" minH="100vh" bg="gray.50">
      <Flex as='header' bg='white' borderBottom='1px solid' borderColor='gray.200' h='56px' px={4} align='center' justify='space-between'>
        <Text fontWeight={600} letterSpacing='0.04em'>MUV</Text>
        <Flex align='center' gap={3}>
          {userEmail && <Text fontSize='sm' color='gray.600'>{userEmail}</Text>}
          <Button variant='outline' size='sm' onClick={() => signOut(auth)}>Sair</Button>
        </Flex>
      </Flex>
      <Flex flex='1' overflow='hidden'>
        <VStack as='nav' align='stretch' spacing={1} bg='gray.900' color='whiteAlpha.900' w={[48,56]} p={3} overflowY='auto'>
          {navItems
            .filter(item => {
              if (role === 'attendant') {
                return item.href === '/admin/students' || item.href === '/kiosk';
              }
              return true;
            })
            .map(item => (
              <CLink
                as={Link}
                key={item.href}
                href={item.href}
                px={3}
                py={2}
                borderRadius='md'
                _hover={{ bg: 'whiteAlpha.200' }}
                bg={pathname?.startsWith(item.href) ? 'whiteAlpha.300' : undefined}
              >
                {item.label}
              </CLink>
            ))}
        </VStack>
        <Box as='main' p={6} flex='1' overflowY='auto'>{children}</Box>
      </Flex>
    </Flex>
  );
}
