import type { ReactNode } from 'react';
import { Header } from '@/components/site/Header';
import { Footer } from '@/components/site/Footer';
import { Ticker } from '@/components/site/Ticker';

export default function StoreLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Ticker />
      <Header />
      <main>{children}</main>
      <Footer />
    </>
  );
}
