"use client";
import { Box, Flex, Link as CLink, Button, Text, Image, Progress, Spinner, HStack, VStack, Drawer, DrawerOverlay, DrawerContent, DrawerHeader, DrawerBody, DrawerCloseButton, useDisclosure, useMediaQuery } from '@chakra-ui/react';
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
  { href: '/kiosk', label: 'Kiosque', icon: 'monitor' },
  { href: '/admin/users', label: 'Usuários', icon: 'user' },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [role, setRole] = useState<string | undefined>();
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [navLoading, setNavLoading] = useState(false);
  useEffect(()=>{ setNavLoading(false); }, [pathname]);

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
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [isMobile] = useMediaQuery('(max-width: 780px)');

  return (
    <Flex direction="column" minH="100vh" bg="brand.primary">
      <Flex as='header' position='fixed' top={0} left={0} right={0} zIndex={1001} bg='brand.primary' borderBottom='1px solid' borderColor='gray.200' h='64px' px={6} align='center' justify='space-between'>
        <HStack>
          <Image src='/logo-muv.png' alt='MUV' height='60px' width='auto' />
        </HStack>
        <Flex align='center' gap={4}>
          {userEmail && !isMobile && <Text fontSize='sm' color='gray.600'>{userEmail}</Text>}
          <Box position="fixed" top={0} left={0} right={0} zIndex={1000} pointerEvents="none" visibility={navLoading ? 'visible' : 'hidden'}>
            <Progress size="xs" isIndeterminate colorScheme="yellow" borderRadius={0} />
          </Box>
          {navLoading && (
            <Flex position="fixed" inset={0} zIndex={999} align="center" justify="center" pointerEvents="none">
              <Box position="absolute" inset={0} bg="rgba(0,0,0,0.28)" />
              <Box position="relative" zIndex={1} bg="white" px={4} py={2} borderRadius="md" boxShadow="lg">
                <HStack spacing={3}>
                  <Spinner size="sm" />
                  <Text fontWeight={600}>Carregando...</Text>
                </HStack>
              </Box>
            </Flex>
          )}
      {isMobile && (
        <Button
          position="fixed"
          bottom={4}
          left={4}
          zIndex={1000}
          bg="black"
          color="white"
          borderRadius="full"
          w={12}
          h={12}
          minW={12}
          onClick={onOpen}
          _hover={isMobile ? undefined : { bg: "gray.800" }}
        >
          <Icon name='menu' size={20} />
        </Button>
      )}
      <Drawer placement="left" isOpen={isOpen} onClose={onClose} size="full">
        <DrawerOverlay />
        <DrawerContent bg="black" color="white">
          <DrawerCloseButton color="white" size="lg" />
          <DrawerHeader color="white" fontSize="2xl">Navegação</DrawerHeader>
          <DrawerBody>
            <VStack align="stretch" spacing={4}>
              {navItems
                .filter(item => {
                  if (role === 'attendant') {
                    return item.href === '/admin/students' || item.href === '/kiosk' || item.href === '/admin/checkins';
                  }
                  return true;
                })
                .map(item => {
                  const active = pathname === item.href || (pathname?.startsWith(item.href + '/') && item.href !== '/');
                  return (
                    <CLink
                      as={Link}
                      key={item.href}
                      href={item.href}
                      onClick={() => { onClose(); if (!active && item.href !== '/kiosk') setNavLoading(true); }}
                      px={6}
                      py={6}
                      borderRadius='lg'
                      _hover={isMobile ? undefined : { bg: 'gray.800' }}
                      bg={active ? 'gray.700' : 'transparent'}
                      color='white'
                      target={item.href === '/kiosk' ? '_blank' : undefined}
                      rel={item.href === '/kiosk' ? 'noopener noreferrer' : undefined}
                    >
                      <HStack spacing={4}>
                        <Icon name={item.icon} size={28} />
                        <Text fontSize="xl">{item.label}</Text>
                      </HStack>
                    </CLink>
                  );
                })}
            </VStack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>

          <Button variant='outline' size='sm' leftIcon={<Icon name='logOut' size={16} />} onClick={() => { setNavLoading(true); signOut(auth); }}>Sair</Button>
        </Flex>
      </Flex>
      <Flex flex='1' overflow='hidden' pt='64px'>
        <Flex direction='column' bg='brand.secondary' color='brand.primary' w={collapsed ? '100px' : '264px'} transition='width 0.2s ease' p={4} overflowY='auto' display={isMobile ? 'none' : 'flex'}>
          <Box flex='1'>
            {navItems
              .filter(item => {
                if (role === 'attendant') {
                  return item.href === '/admin/students' || item.href === '/kiosk' || item.href === '/admin/checkins';
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
                    onClick={!active && item.href !== '/kiosk' ? (()=> setNavLoading(true)) : undefined}
                    px={4}
                    py={3}
                    display='flex'
                    alignItems='center'
                    justifyContent={collapsed ? 'center' : 'flex-start'}
                    gap={collapsed ? 0 : 3}
                    borderRadius='lg'
                    _hover={isMobile ? undefined : { bg: 'rgba(255, 244, 0, 0.16)' }}
                    bg={active ? 'rgba(255, 244, 0, 0.28)' : undefined}
                    color='inherit'
                    target={item.href === '/kiosk' ? '_blank' : undefined}
                    rel={item.href === '/kiosk' ? 'noopener noreferrer' : undefined}
                  >
                    <Icon name={item.icon} size={collapsed ? 22 : 18} />
                    {!collapsed && <span>{item.label}</span>}
                  </CLink>
                );
              })}
          </Box>

        </Flex>
        <Box as='main' p={isMobile ? 4 : 8} flex='1' overflowY='auto'>{children}</Box>
      </Flex>
      {!isMobile && (
        <Button
          position='fixed'
          bottom={4}
          left={collapsed ? '50px' : '132px'}
          transform='translateX(-50%)'
          zIndex={1000}
          size='md'
          variant='ghost'
          color='brand.primary'
          bg='brand.secondary'
          transition='left 0.2s ease'
          onClick={() => {
            const v = !collapsed; setCollapsed(v); if (typeof window !== 'undefined') localStorage.setItem('navCollapsed', v ? '1' : '0');
          }}
          leftIcon={collapsed ? <Icon name='chevronRight' size={22} /> : <Icon name='chevronLeft' size={20} />}
          _hover={{ bg: 'rgba(255, 244, 0, 0.16)' }}
        >
          {!collapsed ? 'Recolher' : null}
        </Button>
      )}
    </Flex>
  );
}
