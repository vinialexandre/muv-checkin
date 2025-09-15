"use client";
import { Box, Flex, Link as CLink, Button, Text, HStack } from '@chakra-ui/react';
import Link from 'next/link';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Users, FolderOpen, Calendar, FileText, Monitor, User } from 'lucide-react';

const navItems = [
  { href: '/admin/students', label: 'Alunos', icon: Users },
  { href: '/admin/plans', label: 'Planos', icon: FolderOpen },
  { href: '/admin/classes', label: 'Aulas', icon: Calendar },
  { href: '/admin/reports', label: 'Relatórios', icon: FileText },
  { href: '/kiosk', label: 'Kiosque', icon: Monitor },
  { href: '/admin/users', label: 'Usuários', icon: User },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [role, setRole] = useState<string|undefined>();
  const [userEmail, setUserEmail] = useState<string|undefined>();
  const [collapsed, setCollapsed] = useState<boolean>(false);
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
  // Read persisted sidebar state on mount to avoid SSR/CSR mismatch
  useEffect(() => {
    try {
      const v = typeof window !== 'undefined' ? localStorage.getItem('navCollapsed')==='1' : false;
      setCollapsed(v);
    } catch {}
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
        <Flex direction='column' bg='gray.900' color='whiteAlpha.900' w={collapsed ? 16 : 56} transition='width 0.2s ease' p={3} overflowY='auto'>
          <Box flex='1'>
            {navItems
              .filter(item => {
                if (role === 'attendant') {
                  return item.href === '/admin/students' || item.href === '/kiosk';
                }
                return true;
              })
              .map(item => {
                const Icon = item.icon;
                return (
                  <CLink
                    as={Link}
                    key={item.href}
                    href={item.href}
                    px={3}
                    py={2}
                    display='flex'
                    alignItems='center'
                    gap={collapsed ? 0 : 2}
                    borderRadius='md'
                    _hover={{ bg: 'whiteAlpha.200' }}
                    bg={pathname?.startsWith(item.href) ? 'whiteAlpha.300' : undefined}
                  >
                    <Icon size={18} />
                    {!collapsed && <span>{item.label}</span>}
                  </CLink>
                );
              })}
          </Box>
          <Button size='xs' variant='ghost' color='whiteAlpha.800' onClick={()=>{ const v=!collapsed; setCollapsed(v); if (typeof window!=='undefined') localStorage.setItem('navCollapsed', v?'1':'0'); }}>
            {collapsed ? '»' : '«'}
          </Button>
        </Flex>
        <Box as='main' p={6} flex='1' overflowY='auto'>{children}</Box>
      </Flex>
    </Flex>
  );
}
