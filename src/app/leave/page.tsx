'use client';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import Sidebar from '@/components/layout/Sidebar';
import { createClient } from '@/lib/supabase/client';
import { signOutInactiveUser } from '@/lib/auth/inactive-user';
import { createNotification, createNotifications } from '@/lib/notifications';
import AppLoader from '@/components/layout/AppLoader';

type LeaveForm = {
  mentor_id: string;
  start_date: string;
  end_date: string;
  leave_type: 'casual' | 'sick' | 'personal' | 'emergency' | 'other';
  reason: string;
};

export default function LeavePage() {
  const [profile, setProfile] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [mentors, setMentors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');

  const form = useForm<LeaveForm>({
    defaultValues: { leave_type: 'casual', mentor_id: '' },
  });
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
    const isSuperAdmin = prof?.role === 'super_admin';
    let query = supabase
      .from('leave_requests')
      .select('*, intern:profiles!leave_requests_user_id_fkey(full_name, email), mentor:profiles!leave_requests_mentor_id_fkey(full_name, email), reviewer:profiles!leave_requests_reviewed_by_fkey(full_name)')
      .order('created_at', { ascending: false });

    if (!isAdmin) {
      query = query.eq('user_id', session.user.id);
    } else if (!isSuperAdmin) {
      query = query.eq('mentor_id', session.user.id);
    }

    const { data, error } = await query;
    if (error) toast.error('Failed to load leave requests: ' + error.message);
    setRequests(data || []);

    if (!isAdmin) {
      const { data: mentorList } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .in('role', ['admin', 'super_admin'])
        .eq('is_active', true)
        .order('full_name', { ascending: true });
      setMentors(mentorList || []);
    }

    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const isAdmin = profile && ['admin', 'super_admin'].includes(profile.role);

  const submitLeaveRequest = async (data: LeaveForm) => {
    if (new Date(data.end_date) < new Date(data.start_date)) {
      toast.error('End date cannot be before start date');
      return;
    }

    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();

    const { data: request, error } = await supabase
      .from('leave_requests')
      .insert({
        user_id: session?.user.id,
        start_date: data.start_date,
        end_date: data.end_date,
        mentor_id: data.mentor_id || null,
        leave_type: data.leave_type,
        reason: data.reason,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed: ' + error.message);
    } else {
      toast.success('Leave request submitted');
      const { data: superAdmins } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'super_admin')
        .eq('is_active', true);
      await createNotifications(supabase, [
        ...(data.mentor_id ? [{
          user_id: data.mentor_id,
          type: 'leave' as const,
          title: 'Leave request submitted',
          message: `${profile.full_name} submitted a leave request`,
          redirect_url: '/leave',
          entity_type: 'leave_request',
          entity_id: request?.id,
        }] : []),
        ...((superAdmins || []).map((admin: any) => ({
          user_id: admin.id,
          type: 'leave' as const,
          title: 'Leave request submitted',
          message: `${profile.full_name} submitted a leave request`,
          redirect_url: '/leave',
          entity_type: 'leave_request',
          entity_id: request?.id,
        }))),
      ]);
      form.reset({ leave_type: 'casual', mentor_id: '', start_date: '', end_date: '', reason: '' });
      setShowForm(false);
      fetchData();
    }
    setSaving(false);
  };

  const reviewRequest = async (requestId: string, status: 'approved' | 'rejected') => {
    const note = window.prompt(status === 'approved' ? 'Approval note (optional)' : 'Reason for rejection (optional)') || null;
    const { data: { session } } = await supabase.auth.getSession();

    const { error } = await supabase
      .from('leave_requests')
      .update({
        status,
        reviewed_by: session?.user.id,
        reviewed_at: new Date().toISOString(),
        review_note: note,
      })
      .eq('id', requestId);

    if (error) {
      toast.error('Failed: ' + error.message);
    } else {
      toast.success(`Request ${status}`);
      const request = requests.find(r => r.id === requestId);
      if (request?.user_id) {
        await createNotification(supabase, {
          user_id: request.user_id,
          type: 'leave',
          title: `Leave ${status}`,
          message: `Your leave request was ${status}`,
          redirect_url: '/leave',
          entity_type: 'leave_request',
          entity_id: requestId,
        });
      }
      fetchData();
    }
  };

  const deleteRequest = async (requestId: string) => {
    if (!window.confirm('Delete this leave request?')) return;

    const { error } = await supabase
      .from('leave_requests')
      .delete()
      .eq('id', requestId);

    if (error) {
      toast.error('Failed: ' + error.message);
    } else {
      toast.success('Leave request deleted');
      fetchData();
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'approved') return 'var(--success)';
    if (status === 'rejected') return 'var(--danger)';
    return 'var(--warning)';
  };

  const getStatusBg = (status: string) => {
    if (status === 'approved') return 'var(--success-bg)';
    if (status === 'rejected') return 'var(--danger-bg)';
    return 'var(--warning-bg)';
  };

  const getLeaveDays = (request: any) => {
    const start = new Date(request.start_date);
    const end = new Date(request.end_date);
    return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };

  const filteredRequests = statusFilter === 'all'
    ? requests
    : requests.filter(r => r.status === statusFilter);

  const pending = requests.filter(r => r.status === 'pending').length;
  const approved = requests.filter(r => r.status === 'approved').length;
  const rejected = requests.filter(r => r.status === 'rejected').length;

  if (loading || !profile) {
    return <AppLoader message="Loading leave requests" />;
  }

  return (
    <div className="layout">
      <Sidebar profile={profile} />
      <main className="main-content">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 28 }}>
          <div>
            <div className="page-title">Leave Requests</div>
            <div className="page-subtitle">
              {isAdmin ? 'Review and manage intern time-off requests' : 'Request time off and track approvals'}
            </div>
          </div>
          {!isAdmin && (
            <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Cancel' : '+ Request Leave'}
            </button>
          )}
        </div>

        <div className="stats-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-label">Total Requests</div>
            <div className="stat-value">{requests.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pending</div>
            <div className="stat-value" style={{ color: 'var(--warning)' }}>{pending}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Approved</div>
            <div className="stat-value" style={{ color: 'var(--success)' }}>{approved}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Rejected</div>
            <div className="stat-value" style={{ color: 'var(--danger)' }}>{rejected}</div>
          </div>
        </div>

        {!isAdmin && showForm && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <div className="card-title">New Leave Request</div>
            </div>
            <form onSubmit={form.handleSubmit(submitLeaveRequest)}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Mentor / Admin *</label>
                <select className="form-select" {...form.register('mentor_id', { required: true })}>
                  <option value="">Select who you are sending this request to...</option>
                  {mentors.map((mentor: any) => (
                    <option key={mentor.id} value={mentor.id}>
                      {mentor.full_name || mentor.email || 'Mentor'} ({(mentor.role || 'admin').replace('_', ' ')})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Start Date *</label>
                  <input type="date" className="form-input" {...form.register('start_date', { required: true })} />
                </div>
                <div className="form-group">
                  <label className="form-label">End Date *</label>
                  <input type="date" className="form-input" {...form.register('end_date', { required: true })} />
                </div>
              </div>
              <div className="form-group" style={{ marginTop: 16 }}>
                <label className="form-label">Leave Type *</label>
                <select className="form-select" {...form.register('leave_type', { required: true })}>
                  <option value="casual">Casual</option>
                  <option value="sick">Sick</option>
                  <option value="personal">Personal</option>
                  <option value="emergency">Emergency</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-group" style={{ marginTop: 16 }}>
                <label className="form-label">Reason *</label>
                <textarea
                  className="form-textarea"
                  placeholder="Explain why you need leave..."
                  style={{ minHeight: 100 }}
                  {...form.register('reason', { required: true })}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {['all', 'pending', 'approved', 'rejected'].map(status => (
            <button
              key={status}
              className={`btn btn-sm ${statusFilter === status ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setStatusFilter(status)}>
              {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {filteredRequests.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-text">No leave requests found</div>
              <div className="empty-state-sub">
                {isAdmin ? 'Intern requests will appear here.' : 'Click "+ Request Leave" to create one.'}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredRequests.map((request: any) => (
              <div key={request.id} className="card" style={{
                borderLeft: `3px solid ${getStatusColor(request.status)}`,
                background: request.status === 'pending' ? 'var(--surface)' : getStatusBg(request.status),
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>
                        {(request.leave_type || 'leave').replace('_', ' ').toUpperCase()} Leave
                      </span>
                      <span className="badge" style={{
                        color: getStatusColor(request.status),
                        background: getStatusBg(request.status),
                      }}>
                        {(request.status || 'pending').toUpperCase()}
                      </span>
                      <span className="badge badge-submitted">{getLeaveDays(request)} day(s)</span>
                    </div>

                    {isAdmin && (
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 6 }}>
                        {request.intern?.full_name} · {request.intern?.email}
                      </div>
                    )}

                    {request.mentor?.full_name && (
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 6 }}>
                        Mentor: {request.mentor.full_name}
                      </div>
                    )}

                    <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8 }}>
                      {format(new Date(request.start_date), 'MMM d, yyyy')} - {format(new Date(request.end_date), 'MMM d, yyyy')}
                    </div>

                    <p style={{ fontSize: 13, color: 'var(--text-1)', lineHeight: 1.6, marginBottom: 8 }}>
                      {request.reason}
                    </p>

                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      Requested {format(new Date(request.created_at), 'MMM d, yyyy')}
                      {request.reviewed_at && (
                        <span style={{ marginLeft: 12 }}>
                          Reviewed {format(new Date(request.reviewed_at), 'MMM d, yyyy')}
                          {request.reviewer?.full_name ? ` by ${request.reviewer.full_name}` : ''}
                        </span>
                      )}
                    </div>

                    {request.review_note && (
                      <div style={{
                        marginTop: 10,
                        padding: '8px 10px',
                        borderRadius: 8,
                        background: 'var(--surface-2)',
                        color: 'var(--text-2)',
                        fontSize: 12,
                      }}>
                        {request.review_note}
                      </div>
                    )}
                  </div>

                  {isAdmin && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {request.status === 'pending' && (
                        <>
                          <button className="btn btn-success btn-sm" onClick={() => reviewRequest(request.id, 'approved')}>
                            Approve
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => reviewRequest(request.id, 'rejected')}>
                            Reject
                          </button>
                        </>
                      )}
                      <button className="btn btn-danger btn-sm" onClick={() => deleteRequest(request.id)}>
                        Delete
                      </button>
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
