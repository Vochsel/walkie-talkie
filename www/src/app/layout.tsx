import type { Metadata } from 'next';
import { Gelasio } from 'next/font/google';
import './globals.css';

const gelasio = Gelasio({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-gelasio',
});

export const metadata: Metadata = {
  title: 'Walkie-Talkie — Remote Terminal Access',
  description: 'Access your terminal from any browser. One command to start, QR code to connect.',
  openGraph: {
    title: 'Walkie-Talkie — Remote Terminal Access',
    description: 'Access your terminal from any browser. One command to start, QR code to connect.',
    images: [{ url: '/og.svg' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/og.svg'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={gelasio.variable}>
      <body>{children}</body>
    </html>
  );
}
