'use client';
import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import Sidebar from '@/components/layout/Sidebar';
import { signOutInactiveUser } from '@/lib/auth/inactive-user';
import { createNotifications } from '@/lib/notifications';
import AppLoader from '@/components/layout/AppLoader';

export default function MeetingsPage() {
  const [profile, setProfile] = useState<any>(null);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [interns, setInterns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'upcoming' | 'past'>('upcoming');

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

    let meetingsData;
    if (isAdmin) {
      const { data } = await supabase
        .from('meetings')
        .select('*, department:departments(name), attendees:meeting_attendees(user_id, attended, profile:profiles(full_name))')
        .order('meeting_date', { ascending: true })
        .order('meeting_time', { ascending: true });
      meetingsData = data;
    } else {
      const { data: attendeeRows } = await supabase
        .from('meeting_attendees')
        .select('meeting_id, meeting:meetings(*, department:departments(name))')
        .eq('user_id', session.user.id);
      meetingsData = (attendeeRows || [])
        .map((row: any) => row.meeting)
        .filter(Boolean)
        .sort((a: any, b: any) => `${a.meeting_date}T${a.meeting_time}`.localeCompare(`${b.meeting_date}T${b.meeting_time}`));
    }
    setMeetings(meetingsData || []);

    if (isAdmin) {
      const { data: internList } = await supabase
        .from('profiles')
        .select('*, department:departments!profiles_department_id_fkey(name)')
        .eq('role', 'intern')
        .eq('is_active', true);
      setInterns(internList || []);
    }

    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const createMeeting = async (data: any) => {
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();

    const { data: meeting, error } = await supabase
      .from('meetings')
      .insert({
        title: data.title,
        description: data.description || null,
        meeting_date: data.meeting_date,
        meeting_time: data.meeting_time,
        meeting_link: data.meeting_link || null,
        location: data.location || null,
        department_id: data.department_id || null,
        created_by: session?.user.id,
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed: ' + error.message);
      setSaving(false);
      return;
    }

    const selectedInterns = data.attendees || [];
    if (selectedInterns.length > 0) {
      const attendeeRows = selectedInterns.map((internId: string) => ({
        meeting_id: meeting.id,
        user_id: internId,
      }));
      const { error: attendeeError } = await supabase.from('meeting_attendees').insert(attendeeRows);
      if (attendeeError) {
        toast.error('Meeting created, but interns were not invited: ' + attendeeError.message);
        setSaving(false);
        return;
      }
      await createNotifications(supabase, selectedInterns.map((internId: string) => ({
        user_id: internId,
        type: 'meeting' as const,
        title: 'Meeting scheduled',
        message: `Meeting scheduled: ${data.title}`,
        redirect_url: '/meetings',
        entity_type: 'meeting',
        entity_id: meeting.id,
      })));
    }

    toast.success('Meeting scheduled!');
    setShowModal(false);
    form.reset();
    fetchData();
    setSaving(false);
  };

  const deleteMeeting = async (meetingId: string) => {
    if (!window.confirm('Delete this meeting?')) return;

    const { error: attendeeError } = await supabase
      .from('meeting_attendees')
      .delete()
      .eq('meeting_id', meetingId);

    if (attendeeError) {
      toast.error('Failed to remove attendees: ' + attendeeError.message);
      return;
    }

    const { error } = await supabase.from('meetings').delete().eq('id', meetingId);
    if (error) {
      toast.error('Failed to delete meeting: ' + error.message);
    } else {
      toast.success('Meeting deleted');
      fetchData();
    }
  };

  const isAdmin = profile && ['admin', 'super_admin'].includes(profile.role);
  const departmentNames = Array.from(new Set(
    interns.map((intern: any) => intern.department?.name).filter(Boolean)
  ));

  const setSelectedInterns = (ids: string[]) => {
    form.setValue('attendees', ids, { shouldDirty: true, shouldValidate: true });
  };

  const selectDepartmentInterns = (departmentName: string) => {
    const ids = interns
      .filter((intern: any) => intern.department?.name === departmentName)
      .map((intern: any) => intern.id);
    setSelectedInterns(ids);
  };

  const now = new Date();
  const filteredMeetings = meetings.filter((m: any) => {
    const meetingDateTime = new Date(`${m.meeting_date}T${m.meeting_time}`);
    return filter === 'upcoming' ? meetingDateTime >= now : meetingDateTime < now;
  });

  if (loading || !profile) {
    return <AppLoader message="Loading meetings" />;
  }

  return (
    <div className="layout">
      <Sidebar profile={profile} />
      <main className="main-content">
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-title">Schedule Meeting</div>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
              </div>
              <form onSubmit={form.handleSubmit(createMeeting)}>
                <div className="modal-body">
                  <div className="form-group">
                    <label className="form-label">Title *</label>
                    <input className="form-input" placeholder="e.g. Weekly Sync"
                      {...form.register('title', { required: true })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <textarea className="form-textarea" placeholder="Agenda or notes..."
                      {...form.register('description')} />
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Date *</label>
                      <input type="date" className="form-input"
                        {...form.register('meeting_date', { required: true })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Time *</label>
                      <input type="time" className="form-input"
                        {...form.register('meeting_time', { required: true })} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Meeting Link (optional)</label>
                    <input type="url" className="form-input" placeholder="https://meet.google.com/..."
                      {...form.register('meeting_link')} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Location (optional)</label>
                    <input className="form-input" placeholder="e.g. Conference Room A"
                      {...form.register('location')} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Invite Interns *</label>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                      <button type="button" className="btn btn-secondary btn-sm"
                        onClick={() => setSelectedInterns(interns.map((i: any) => i.id))}>
                        Select All
                      </button>
                      <button type="button" className="btn btn-secondary btn-sm"
                        onClick={() => setSelectedInterns([])}>
                        Clear
                      </button>
                      <select
                        className="form-select"
                        defaultValue=""
                        onChange={e => e.target.value && selectDepartmentInterns(e.target.value)}
                        style={{ width: 220 }}>
                        <option value="">Select department...</option>
                        {departmentNames.map((name: string) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{
                      maxHeight: 160, overflowY: 'auto',
                      border: '1px solid var(--border)', borderRadius: 8, padding: 10
                    }}>
                      {interns.length === 0 ? (
                        <div className="text-sm">No interns available</div>
                      ) : (
                        interns.map((i: any) => (
                          <label key={i.id} style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '6px 4px', fontSize: 13, cursor: 'pointer'
                          }}>
                            <input type="checkbox" value={i.id} {...form.register('attendees')} />
                            {i.full_name} ({i.email})
                            {i.department?.name && (
                              <span style={{ color: 'var(--text-3)', fontSize: 12 }}>- {i.department.name}</span>
                            )}
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Scheduling...' : 'Schedule Meeting'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <div className="page-title">Meetings</div>
            <div className="page-subtitle">
              {isAdmin ? 'Schedule and manage team meetings' : 'Your upcoming and past meetings'}
            </div>
          </div>
          {isAdmin && (
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              + Schedule Meeting
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button onClick={() => setFilter('upcoming')}
            className={`btn btn-sm ${filter === 'upcoming' ? 'btn-primary' : 'btn-secondary'}`}>
            Upcoming
          </button>
          <button onClick={() => setFilter('past')}
            className={`btn btn-sm ${filter === 'past' ? 'btn-primary' : 'btn-secondary'}`}>
            Past
          </button>
        </div>

        {filteredMeetings.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon">📅</div>
              <div className="empty-state-text">No {filter} meetings</div>
              <div className="empty-state-sub">
                {isAdmin ? 'Schedule a meeting to get started' : 'Meetings you are invited to will appear here'}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredMeetings.map((m: any) => (
              <div key={m.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{m.title}</span>
                      {m.department?.name && (
                        <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>
                          {m.department.name}
                        </span>
                      )}
                    </div>
                    {m.description && (
                      <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 10 }}>{m.description}</p>
                    )}
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: 'var(--text-2)' }}>
                      <span>📅 {format(new Date(m.meeting_date), 'MMM d, yyyy')}</span>
                      <span>🕐 {m.meeting_time?.slice(0, 5)}</span>
                      {m.location && <span>📍 {m.location}</span>}
                    </div>
                    {m.meeting_link && (
                      <a href={m.meeting_link} target="_blank" rel="noopener noreferrer"
                        className="btn btn-secondary btn-sm" style={{ marginTop: 10, display: 'inline-flex' }}>
                        🔗 Join Meeting
                      </a>
                    )}
                    {isAdmin && m.attendees && m.attendees.length > 0 && (
                      <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-3)' }}>
                        👥 {m.attendees.map((a: any) => a.profile?.full_name).join(', ')}
                      </div>
                    )}
                  </div>
                  {isAdmin && (
                    <button className="btn btn-danger btn-sm" onClick={() => deleteMeeting(m.id)}>
                      Delete
                    </button>
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
