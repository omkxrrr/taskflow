'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Sidebar from '@/components/layout/Sidebar';
import { signOutInactiveUser } from '@/lib/auth/inactive-user';
import AppLoader from '@/components/layout/AppLoader';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }: any) => {
      if (!session) { window.location.href = '/auth/login'; return; }
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      if (await signOutInactiveUser(supabase, data)) return;
      if (!data || !['admin', 'super_admin'].includes(data.role)) {
        window.location.href = '/dashboard';
        return;
      }
      setProfile(data);
    });
  }, []);

  if (!profile) return <AppLoader message="Opening admin workspace" />;

  return (
    <div className="layout">
      <Sidebar profile={profile} />
      <main className="main-content">{children}</main>
    </div>
  );
}
