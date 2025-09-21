import './globals.css';
import { ReactNode } from 'react';
import { Providers } from './providers';
import { Inter } from 'next/font/google';
import { ColorModeScript } from '@chakra-ui/react';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Plataforma MUV',
  description: 'Gestão de presença e check-ins',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-br" className={inter.className} suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="shortcut icon" href="/favicon.ico" />
      </head>
      <body suppressHydrationWarning>
        <ColorModeScript initialColorMode="light" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
