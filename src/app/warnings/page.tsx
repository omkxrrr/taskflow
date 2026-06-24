'use client';
import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import Sidebar from '@/components/layout/Sidebar';
import { signOutInactiveUser } from '@/lib/auth/inactive-user';
import { createNotification } from '@/lib/notifications';
import AppLoader from '@/components/layout/AppLoader';

export default function WarningsPage() {
  const [profile, setProfile] = useState<any>(null);
  const [warnings, setWarnings] = useState<any[]>([]);
  const [interns, setInterns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');

  const form = useForm<any>();
  const supabase = createClient();

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
      const { data } = await supabase
        .from('warnings')
        .select('*, intern:profiles!warnings_user_id_fkey(full_name, email), issuer:profiles!warnings_issued_by_fkey(full_name)')
        .order('created_at', { ascending: false });
      setWarnings(data || []);

      const { data: internList } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'intern');
      setInterns(internList || []);
    } else {
      const { data } = await supabase
        .from('warnings')
        .select('*, issuer:profiles!warnings_issued_by_fkey(full_name)')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });
      setWarnings(data || []);
    }

    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const issueWarning = async (data: any) => {
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();

    const { data: warning, error } = await supabase
      .from('warnings')
      .insert({
        user_id: data.user_id,
        issued_by: session?.user.id,
        title: data.title,
        description: data.description,
        severity: data.severity,
        category: data.category,
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed: ' + error.message);
    } else {
      toast.success('Warning issued!');
      await createNotification(supabase, {
        user_id: data.user_id,
        type: 'warning',
        title: 'Warning issued',
        message: `Warning issued: ${data.title}`,
        redirect_url: '/warnings',
        entity_type: 'warning',
        entity_id: warning?.id,
      });
      setShowModal(false);
      form.reset();
      fetchData();
    }
    setSaving(false);
  };

  const acknowledgeWarning = async (warningId: string) => {
    const { error } = await supabase
      .from('warnings')
      .update({
        is_acknowledged: true,
        acknowledged_at: new Date().toISOString(),
      })
      .eq('id', warningId);

    if (error) {
      toast.error('Failed to acknowledge');
    } else {
      toast.success('Warning acknowledged');
      fetchData();
    }
  };

  const deleteWarning = async (warningId: string) => {
    const { error } = await supabase
      .from('warnings')
      .delete()
      .eq('id', warningId);

    if (error) {
      toast.error('Failed to delete');
    } else {
      toast.success('Warning deleted');
      fetchData();
    }
  };

  const isAdmin = profile && ['admin', 'super_admin'].includes(profile.role);

  const getSeverityColor = (severity: string) => {
    if (severity === 'critical') return 'var(--danger)';
    if (severity === 'major') return 'var(--warning)';
    return 'var(--accent-h)';
  };

  const getSeverityBg = (severity: string) => {
    if (severity === 'critical') return 'var(--danger-bg)';
    if (severity === 'major') return 'var(--warning-bg)';
    return 'var(--accent-bg)';
  };

  const getWarningCardStyle = (warning: any) => ({
    borderLeft: `3px solid ${getSeverityColor(warning.severity)}`,
    borderColor: warning.severity === 'critical' ? 'rgba(239,68,68,0.45)' : undefined,
    background: warning.severity === 'critical' ? 'var(--danger-bg)' : undefined,
    opacity: warning.is_acknowledged ? 0.7 : 1,
  });

  const filtered = filter === 'all'
    ? warnings
    : warnings.filter(w => w.severity === filter);

  if (loading || !profile) {
    return <AppLoader message="Loading warnings" />;
  }

  // Stats
  const minor = warnings.filter(w => w.severity === 'minor').length;
  const major = warnings.filter(w => w.severity === 'major').length;
  const critical = warnings.filter(w => w.severity === 'critical').length;
  const unacknowledged = warnings.filter(w => !w.is_acknowledged).length;

  return (
    <div className="layout">
      <Sidebar profile={profile} />
      <main className="main-content">
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-title">Issue Warning</div>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
              </div>
              <form onSubmit={form.handleSubmit(issueWarning)}>
                <div className="modal-body">
                  <div className="form-group">
                    <label className="form-label">Intern *</label>
                    <select className="form-select"
                      {...form.register('user_id', { required: true })}>
                      <option value="">Select intern...</option>
                      {interns.map((i: any) => (
                        <option key={i.id} value={i.id}>{i.full_name} ({i.email})</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Warning Title *</label>
                    <input className="form-input"
                      placeholder="e.g. Late Submission of Task"
                      {...form.register('title', { required: true })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select className="form-select" {...form.register('category')}>
                      <option value="general">General</option>
                      <option value="late_submission">Late Submission</option>
                      <option value="absenteeism">Absenteeism</option>
                      <option value="misconduct">Misconduct</option>
                      <option value="poor_performance">Poor Performance</option>
                      <option value="insubordination">Insubordination</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Severity *</label>
                    <select className="form-select"
                      {...form.register('severity', { required: true })}>
                      <option value="minor">Minor</option>
                      <option value="major">Major</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description *</label>
                    <textarea className="form-textarea"
                      placeholder="Explain the reason for this warning in detail..."
                      style={{ minHeight: 100 }}
                      {...form.register('description', { required: true })} />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary"
                    onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-danger" disabled={saving}>
                    {saving ? 'Issuing...' : '⚠️ Issue Warning'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <div className="page-title">Warnings</div>
            <div className="page-subtitle">
              {isAdmin ? 'Issue and manage intern warnings' : 'Your warnings and notices'}
            </div>
          </div>
          {isAdmin && (
            <button className="btn btn-danger" onClick={() => setShowModal(true)}>
              ⚠️ Issue Warning
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="stats-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-label">Total Warnings</div>
            <div className="stat-value">{warnings.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Minor</div>
            <div className="stat-value" style={{ color: 'var(--accent-h)' }}>{minor}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Major</div>
            <div className="stat-value" style={{ color: 'var(--warning)' }}>{major}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Critical</div>
            <div className="stat-value" style={{ color: 'var(--danger)' }}>{critical}</div>
          </div>
          {!isAdmin && (
            <div className="stat-card">
              <div className="stat-label">Unacknowledged</div>
              <div className="stat-value" style={{ color: 'var(--warning)' }}>{unacknowledged}</div>
            </div>
          )}
        </div>

        {/* Filter */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {['all', 'minor', 'major', 'critical'].map(f => (
            <button key={f}
              onClick={() => setFilter(f)}
              className={`btn btn-sm ${filter === f ? (f === 'critical' ? 'btn-danger' : 'btn-primary') : 'btn-secondary'}`}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Warnings List */}
        {filtered.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon">✅</div>
              <div className="empty-state-text">No warnings found</div>
              <div className="empty-state-sub">
                {isAdmin ? 'No warnings have been issued yet' : 'You have no warnings — keep it up!'}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map((w: any) => (
              <div key={w.id} className="card" style={getWarningCardStyle(w)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{w.title}</span>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                        color: getSeverityColor(w.severity),
                        background: getSeverityBg(w.severity),
                      }}>
                        {(w.severity || 'minor').toUpperCase()}
                      </span>
                      <span style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 20,
                        background: 'var(--surface-2)', color: 'var(--text-2)'
                      }}>
                        {(w.category || 'general').replace(/_/g, ' ')}
                      </span>
                      {w.is_acknowledged && (
                        <span className="badge badge-approved">Acknowledged</span>
                      )}
                    </div>

                    {isAdmin && (
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 6 }}>
                        👤 {w.intern?.full_name} · Issued by {w.issuer?.full_name}
                      </div>
                    )}

                    <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 8 }}>
                      {w.description}
                    </p>

                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      📅 {w.created_at ? format(new Date(w.created_at), 'MMM d, yyyy · h:mm a') : '-'}
                      {w.is_acknowledged && w.acknowledged_at && (
                        <span style={{ marginLeft: 12 }}>
                          ✅ Acknowledged {format(new Date(w.acknowledged_at), 'MMM d, yyyy')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {!isAdmin && !w.is_acknowledged && (
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => acknowledgeWarning(w.id)}>
                        Acknowledge
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => deleteWarning(w.id)}>
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
