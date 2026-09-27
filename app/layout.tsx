import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import { Exo_2, Inter_Tight, Poppins } from 'next/font/google';
import './globals.css';
import { AppProvider } from '@/components/AppProvider';
import { VerificationGate } from '@/components/VerificationGate';
import { VoiceAssistant } from '@/components/voice/VoiceAssistant';
import { ActionCards } from '@/components/ActionCards';
import { ServiceWorker } from '@/components/ServiceWorker';
import { DevicePreview } from '@/components/DevicePreview';
import { cookies } from 'next/headers';
import { VERIFIED_COOKIE } from '@/lib/constants';
import { getAdminSession } from '@/lib/auth';

const head = Inter_Tight({ subsets: ['latin'], weight: ['500', '600', '700', '800'], variable: '--font-head', display: 'swap' });
const body = Exo_2({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-body', display: 'swap' });
const alt = Poppins({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-alt', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: { default: 'Ridgeline Fit', template: '%s – Ridgeline Fit' },
  description: 'Research-grade peptides for laboratory studies. For in vitro research use only. Not for human or veterinary use.',
  applicationName: 'Ridgeline Fit',
  appleWebApp: { capable: true, title: 'Ridgeline Fit', statusBarStyle: 'black-translucent' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
  robots: { index: true, follow: true },
  openGraph: { siteName: 'Ridgeline Fit', type: 'website', images: ['/icons/icon-512.png'] },
};

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  // Researcher gate is remembered for 30 days on this device (cookie set by /api/verify).
  const verified = (await cookies()).get(VERIFIED_COOKIE)?.value === '1';
  // Device preview toolbar: always in development; in production only for signed-in admins
  // (or everyone with NEXT_PUBLIC_DEVICE_PREVIEW=on).
  const showPreview =
    process.env.NEXT_PUBLIC_DEVICE_PREVIEW === 'on' ||
    (process.env.NEXT_PUBLIC_DEVICE_PREVIEW !== 'off' && (process.env.NODE_ENV !== 'production' || !!(await getAdminSession())));
  return (
    // suppressHydrationWarning: browser extensions add attributes to <html>/<body> before React loads.
    <html lang="en" className={`${head.variable} ${body.variable} ${alt.variable}`} suppressHydrationWarning>
      <body className="min-h-screen pb-[env(safe-area-inset-bottom)]" suppressHydrationWarning>
        <AppProvider initialVerified={verified}>
          {children}
          <ActionCards />
          <VoiceAssistant />
          <VerificationGate />
        </AppProvider>
        {showPreview && <DevicePreview />}
        <ServiceWorker />
      </body>
    </html>
  );
}
