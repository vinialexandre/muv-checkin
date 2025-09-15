import './globals.css';
import { ReactNode } from 'react';
import { Providers } from './providers';
import { Inter } from 'next/font/google';
import { ColorModeScript } from '@chakra-ui/react';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Check-in MUV',
  description: 'Attendance and check-in management',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-br" className={inter.className} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ColorModeScript initialColorMode="light" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
