// /home/root/apps/tickets-dashboard/app/layout.tsx

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Suspense } from 'react';
import LoadingState from '../components/LoadingState';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'block', // Mudamos para 'block' para evitar FOUT (Flash of Unstyled Text)
  preload: true,
  fallback: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
  adjustFontFallback: true, // Ajusta o fallback para evitar layout shift
});

// Metadados padrão para o seu site (serão usados em todas as páginas, a menos que uma página específica os substitua)
export const metadata: Metadata = {
  title: 'Painel de Tickets - AMS Sergipe', // Título que aparece na aba do navegador
  description: 'Histórico interativo de tickets de suporte da AMS Sergipe.', // Descrição para SEO e compartilhamento
  // Você pode adicionar mais metadados aqui, como:
  // icons: { icon: '/favicon.ico' }, // Se você tiver um favicon
};

// Este é o componente Layout principal
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={inter.className}>
      <head>
        <link
          rel="preconnect"
          href="https://s3.dev.amssergipe.com.br"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <div id="app-root">
          {children}
        </div>
      </body>
    </html>
  );
}
