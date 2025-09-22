"use client";
import { ChakraProvider } from '@chakra-ui/react';
import theme from '@/theme/chakra';
import { ReactNode } from 'react';
import { SpeedInsights } from "@vercel/speed-insights/next"


export function Providers({ children }: { children: ReactNode }) {
  return (
    <ChakraProvider theme={theme}>
      {children}
      <SpeedInsights />
    </ChakraProvider>
  );
}
