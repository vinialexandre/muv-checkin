import AppShell from '@/components/AppShell';
import AdminGuard from '@/components/AdminGuard';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <AdminGuard>
        {children}
      </AdminGuard>
    </AppShell>
  );
}
