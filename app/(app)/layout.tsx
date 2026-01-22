import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import Layout from '@/components/Layout';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  return <Layout user={user}>{children}</Layout>;
}
