import type { Metadata } from 'next';
import '@/styles/globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';

export const metadata: Metadata = {
  title: 'PropManager — Modern Property Management',
  description: 'Streamline your property management with intelligent tools for landlords, property managers, and tenants.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
