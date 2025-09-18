"use client";
import { Box, Flex, Link as CLink, Button, Text } from '@chakra-ui/react';
import Link from 'next/link';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icon, IconName } from '@/components/Icon';

const navItems: { href: string; label: string; icon: IconName }[] = [
  { href: '/admin/students', label: 'Alunos', icon: 'users' },
  { href: '/admin/plans', label: 'Planos', icon: 'folder' },
  { href: '/admin/checkins', label: 'Check-ins', icon: 'clock' },
  { href: '/admin/kiosk', label: 'Kiosque', icon: 'monitor' },
  { href: '/admin/users', label: 'Usuários', icon: 'user' },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [role, setRole] = useState<string | undefined>();
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [collapsed, setCollapsed] = useState<boolean>(false);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { setRole(undefined); setUserEmail(undefined); return; }
      const idt = await user.getIdTokenResult();
      const r = (idt.claims as any).role || ((idt.claims as any).admin ? 'admin' : undefined);
      setRole(r);
      setUserEmail(user.email || undefined);
    });
    return () => unsub();
  }, []);
  useEffect(() => {
    try {
      const v = typeof window !== 'undefined' ? localStorage.getItem('navCollapsed') === '1' : false;
      setCollapsed(v);
    } catch {}
  }, []);
  return (
    <Flex direction="column" minH="100vh" bg="brand.primary">
      <Flex as='header' bg='brand.primary' borderBottom='1px solid' borderColor='gray.200' h='64px' px={6} align='center' justify='space-between'>
        <Text fontWeight={700} letterSpacing='0.04em' color='brand.secondary'>MUV</Text>
        <Flex align='center' gap={4}>
          {userEmail && <Text fontSize='sm' color='gray.600'>{userEmail}</Text>}
          <Button variant='outline' size='sm' leftIcon={<Icon name='logOut' size={16} />} onClick={() => signOut(auth)}>Sair</Button>
        </Flex>
      </Flex>
      <Flex flex='1' overflow='hidden'>
        <Flex direction='column' bg='brand.secondary' color='brand.primary' w={collapsed ? '72px' : '264px'} transition='width 0.2s ease' p={4} overflowY='auto'>
          <Box flex='1'>
            {navItems
              .filter(item => {
                if (role === 'attendant') {
                  return item.href === '/admin/students' || item.href === '/admin/kiosk' || item.href === '/admin/checkins';
                }
                return true;
              })
              .map(item => {
                const active = pathname?.startsWith(item.href);
                return (
                  <CLink
                    as={Link}
                    key={item.href}
                    href={item.href}
                    px={4}
                    py={3}
                    display='flex'
                    alignItems='center'
                    justifyContent={collapsed ? 'center' : 'flex-start'}
                    gap={collapsed ? 0 : 3}
                    borderRadius='lg'
                    _hover={{ bg: 'rgba(255, 244, 0, 0.16)' }}
                    bg={active ? 'rgba(255, 244, 0, 0.28)' : undefined}
                    color='inherit'
                  >
                    <Icon name={item.icon} size={collapsed ? 22 : 18} />
                    {!collapsed && <span>{item.label}</span>}
                  </CLink>
                );
              })}
          </Box>
          <Button
            size='sm'
            variant='ghost'
            color='brand.primary'
            onClick={() => {
              const v = !collapsed; setCollapsed(v); if (typeof window !== 'undefined') localStorage.setItem('navCollapsed', v ? '1' : '0');
            }}
            leftIcon={collapsed ? <Icon name='chevronRight' size={20} /> : <Icon name='chevronLeft' size={18} />}
          >
            {!collapsed ? 'Recolher' : null}
          </Button>
        </Flex>
        <Box as='main' p={8} flex='1' overflowY='auto'>{children}</Box>
      </Flex>
    </Flex>
  );
}
