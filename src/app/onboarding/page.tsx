'use client';
import { useEffect, useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import AppLoader from '@/components/layout/AppLoader';
import { createClient } from '@/lib/supabase/client';
import { signOutInactiveUser } from '@/lib/auth/inactive-user';

export default function OnboardingPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/auth/login';
        return;
      }

      const { data: prof } = await supabase
        .from('profiles')
        .select('*, department:departments!profiles_department_id_fkey(name)')
        .eq('id', session.user.id)
        .single();

      if (await signOutInactiveUser(supabase, prof)) return;
      setProfile(prof);
      setLoading(false);
    };

    fetchProfile();
  }, [supabase]);

  if (loading || !profile) return <AppLoader message="Loading onboarding" />;

  return (
    <div className="layout">
      <Sidebar profile={profile} />
      <main className="main-content onboarding-coming-soon-wrap">
        <section className="onboarding-coming-soon">
          <div className="coming-soon-icon">
            <span>OK</span>
            <em className="coming-soon-spark">+</em>
          </div>
          <div className="coming-soon-kicker">Onboarding Module</div>
          <h1>Coming Soon</h1>
          <p>
            A guided intern onboarding form, approvals, documents, and progress tracking will launch here.
            This module is currently being prepared.
          </p>
          <a href="/dashboard" className="btn btn-primary coming-soon-action">
            Back to Dashboard
            <span>-&gt;</span>
          </a>
        </section>
      </main>
    </div>
  );
}
