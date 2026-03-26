import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Walkie-Talkie — Remote Terminal Access',
  description: 'Access your terminal from any browser. One command to start, QR code to connect.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
