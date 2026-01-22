import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CollabHub - Collaborative Project Management',
  description: 'A collaborative project management tool with group-based access control',
  icons: {
    icon: '/icon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
