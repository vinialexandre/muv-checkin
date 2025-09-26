"use client";
import { ChakraProvider } from '@chakra-ui/react';
import theme from '@/theme/chakra';
import { ReactNode } from 'react';
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Analytics } from "@vercel/analytics/next"


export function Providers({ children }: { children: ReactNode }) {
  return (
    <ChakraProvider theme={theme}>
      {children}
      <SpeedInsights />
      <Analytics />
    </ChakraProvider>
  );
}
