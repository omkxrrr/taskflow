'use client';
import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import Sidebar from '@/components/layout/Sidebar';
import { signOutInactiveUser } from '@/lib/auth/inactive-user';
import AppLoader from '@/components/layout/AppLoader';
import { completeOnboardingTrigger } from '@/lib/onboarding';

export default function UpdatesPage() {
  const [profile, setProfile] = useState<any>(null);
  const [updates, setUpdates] = useState<any[]>([]);
  const [todayUpdate, setTodayUpdate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedIntern, setSelectedIntern] = useState<string>('all');
  const [interns, setInterns] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const form = useForm<any>();
  const supabase = createClient();
  const today = format(new Date(), 'yyyy-MM-dd');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = '/auth/login'; return; }

    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    if (await signOutInactiveUser(supabase, prof)) return;
    setProfile(prof);

    const isAdmin = prof && ['admin', 'super_admin'].includes(prof.role);

    if (isAdmin) {
      // Admin sees all updates with intern info
      const { data } = await supabase
        .from('daily_updates')
        .select('*, profile:profiles(full_name, email)')
        .order('update_date', { ascending: false })
        .order('created_at', { ascending: false });
      setUpdates(data || []);

      const { data: internList } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'intern');
      setInterns(internList || []);
    } else {
      // Intern sees only their own updates
      const { data } = await supabase
        .from('daily_updates')
        .select('*')
        .eq('user_id', session.user.id)
        .order('update_date', { ascending: false });
      setUpdates(data || []);

      // Check if today's update exists
      const todayData = (data || []).find((u: any) => u.update_date === today);
      setTodayUpdate(todayData || null);

      if (todayData) {
        form.reset({
          what_i_did: todayData.what_i_did,
          blockers: todayData.blockers || '',
          plan_for_tomorrow: todayData.plan_for_tomorrow || '',
        });
      }
    }

    setLoading(false);
  }, [today]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const saveUpdate = async (data: any) => {
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();

    if (todayUpdate) {
      // Update existing
      const { error } = await supabase
        .from('daily_updates')
        .update({
          what_i_did: data.what_i_did,
          blockers: data.blockers || null,
          plan_for_tomorrow: data.plan_for_tomorrow || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', todayUpdate.id);

      if (error) {
        toast.error('Failed: ' + error.message);
      } else {
        toast.success('Update saved!');
        setShowForm(false);
        fetchData();
      }
    } else {
      // Create new
      const { error } = await supabase
        .from('daily_updates')
        .insert({
          user_id: session?.user.id,
          update_date: today,
          what_i_did: data.what_i_did,
          blockers: data.blockers || null,
          plan_for_tomorrow: data.plan_for_tomorrow || null,
        });

      if (error) {
        toast.error('Failed: ' + error.message);
      } else {
        toast.success('Daily update submitted! ✅');
        if (session?.user.id) {
          await completeOnboardingTrigger(supabase, session.user.id, 'first_daily_update');
        }
        setShowForm(false);
        fetchData();
      }
    }
    setSaving(false);
  };

  const isAdmin = profile && ['admin', 'super_admin'].includes(profile.role);

 const filteredUpdates = updates.filter((u: any) => {
  if (searchQuery === '') return true;
  const name = (u.profile?.full_name || '').toLowerCase();
  const work = (u.what_i_did || '').toLowerCase();
  const blockers = (u.blockers || '').toLowerCase();
  const plan = (u.plan_for_tomorrow || '').toLowerCase();
  const q = searchQuery.toLowerCase();
  return name.includes(q) || work.includes(q) || blockers.includes(q) || plan.includes(q);
});
  if (loading || !profile) {
    return <AppLoader message="Loading updates" />;
  }

  return (
    <div className="layout">
      <Sidebar profile={profile} />
      <main className="main-content">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <div className="page-title">Daily Updates</div>
            <div className="page-subtitle">
              {isAdmin ? 'View all intern daily updates' : 'Log your daily work progress'}
            </div>
          </div>
          {!isAdmin && (
            <button
              className="btn btn-primary"
              onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Cancel' : todayUpdate ? '✏️ Edit Today' : '+ Add Today\'s Update'}
            </button>
          )}
        </div>

        {/* Intern Update Form */}
        {!isAdmin && showForm && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <div className="card-title">
                {todayUpdate ? 'Edit Today\'s Update' : 'Today\'s Update'} — {format(new Date(), 'MMM d, yyyy')}
              </div>
            </div>
            <form onSubmit={form.handleSubmit(saveUpdate)}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">What did I do today? *</label>
                  <textarea
                    className="form-textarea"
                    placeholder="Describe your work today in detail..."
                    style={{ minHeight: 100 }}
                    {...form.register('what_i_did', { required: true })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Blockers / Challenges (optional)</label>
                  <textarea
                    className="form-textarea"
                    placeholder="Any issues or blockers you faced..."
                    {...form.register('blockers')}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Plan for Tomorrow (optional)</label>
                  <textarea
                    className="form-textarea"
                    placeholder="What do you plan to do tomorrow..."
                    {...form.register('plan_for_tomorrow')}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Saving...' : todayUpdate ? 'Save Changes' : 'Submit Update'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Today's status for intern */}
        {!isAdmin && !showForm && (
          <div className="card" style={{ marginBottom: 20, borderColor: todayUpdate ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>{todayUpdate ? '✅' : '⚠️'}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>
                  {todayUpdate ? 'Today\'s update submitted!' : 'Today\'s update pending'}
                </div>
                <div className="text-sm">
                  {todayUpdate
                    ? `Last updated ${format(new Date(todayUpdate.updated_at), 'h:mm a')}`
                    : 'Don\'t forget to log your daily update'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Admin filter */}
       {isAdmin && (
  <div style={{ marginBottom: 20 }}>
    {/* Search Bar */}
    
    {/* Filter Buttons */}
    {isAdmin && (
  <div style={{ marginBottom: 20 }}>
    <input
      className="form-input"
      placeholder="🔍 Search by intern name or update content..."
      value={searchQuery}
      onChange={e => setSearchQuery(e.target.value)}
      style={{ maxWidth: 400 }}
    />
  </div>
)}
  </div>
)}

        {/* Updates List */}
        {filteredUpdates.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon">📝</div>
              <div className="empty-state-text">No updates yet</div>
              <div className="empty-state-sub">
                {isAdmin ? 'Interns haven\'t submitted any updates yet' : 'Click "+ Add Today\'s Update" to get started'}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredUpdates.map((update: any) => (
              <div key={update.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    {isAdmin && (
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>
                        {update.profile?.full_name}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      📅 {format(new Date(update.update_date), 'EEEE, MMM d, yyyy')}
                    </div>
                  </div>
                  {update.update_date === today && (
                    <span className="badge badge-approved">Today</span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                      What I did
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-1)', lineHeight: 1.6 }}>
                      {update.what_i_did}
                    </div>
                  </div>

                  {update.blockers && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                        Blockers
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-1)', lineHeight: 1.6 }}>
                        {update.blockers}
                      </div>
                    </div>
                  )}

                  {update.plan_for_tomorrow && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-h)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                        Plan for tomorrow
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-1)', lineHeight: 1.6 }}>
                        {update.plan_for_tomorrow}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
