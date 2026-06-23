'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Sidebar from '@/components/layout/Sidebar';
import { signOutInactiveUser } from '@/lib/auth/inactive-user';
import { getCurrentProfile } from '@/lib/auth/profile-cache';
import AppLoader from '@/components/layout/AppLoader';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const supabase = createClient();
    getCurrentProfile(supabase).then(async ({ session, profile }) => {
      if (!session) {
        window.location.href = '/auth/login';
        return;
      }
      if (await signOutInactiveUser(supabase, profile)) return;
      setProfile(profile);
    });
  }, []);

  if (!profile) {
    return <AppLoader message="Preparing your dashboard" />;
  }

  return (
    <div className="layout">
      <Sidebar profile={profile} />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
