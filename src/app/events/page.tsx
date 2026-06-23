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

export default function EventsPage() {
  const [profile, setProfile] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [interns, setInterns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [viewEvent, setViewEvent] = useState<any>(null);
  const [editEvent, setEditEvent] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

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
        .from('events')
        .select('*, assignees:event_assignees(user_id, role, profile:profiles(full_name))')
        .order('event_date', { ascending: true });
      setEvents(data || []);

      const { data: internList } = await supabase
        .from('profiles')
        .select('*, department:departments!profiles_department_id_fkey(name)')
        .eq('role', 'intern')
        .eq('is_active', true);
      setInterns(internList || []);
    } else {
      // Intern sees events they are assigned to
      const { data: assigneeRows } = await supabase
        .from('event_assignees')
        .select('event_id')
        .eq('user_id', session.user.id);
      const eventIds = (assigneeRows || []).map((r: any) => r.event_id);

      if (eventIds.length > 0) {
        const { data } = await supabase
          .from('events')
          .select('*')
          .in('id', eventIds)
          .order('event_date', { ascending: true });
        setEvents(data || []);
      } else {
        setEvents([]);
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreateModal = () => {
    setEditEvent(null);
    form.reset({
      status: 'upcoming',
      category: 'general',
    });
    setShowModal(true);
  };

  const openEditModal = (event: any) => {
    setEditEvent(event);
    form.reset({
      name: event.name,
      description: event.description || '',
      category: event.category || 'general',
      status: event.status || 'upcoming',
      state: event.state || '',
      city: event.city || '',
      area: event.area || '',
      full_address: event.full_address || '',
      event_date: event.event_date,
      event_time: event.event_time || '',
      end_date: event.end_date || '',
      end_time: event.end_time || '',
      poc_name: event.poc_name || '',
      poc_phone: event.poc_phone || '',
      poc_email: event.poc_email || '',
      poc_role: event.poc_role || '',
      budget: event.budget || '',
      expected_attendance: event.expected_attendance || '',
      actual_attendance: event.actual_attendance || '',
      notes: event.notes || '',
    });
    setShowModal(true);
  };

  const saveEvent = async (data: any) => {
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();

    const payload = {
      name: data.name,
      description: data.description || null,
      category: data.category || 'general',
      status: data.status || 'upcoming',
      state: data.state || null,
      city: data.city || null,
      area: data.area || null,
      full_address: data.full_address || null,
      event_date: data.event_date,
      event_time: data.event_time || null,
      end_date: data.end_date || null,
      end_time: data.end_time || null,
      poc_name: data.poc_name || null,
      poc_phone: data.poc_phone || null,
      poc_email: data.poc_email || null,
      poc_role: data.poc_role || null,
      budget: data.budget || null,
      expected_attendance: data.expected_attendance || null,
      actual_attendance: data.actual_attendance || null,
      notes: data.notes || null,
      created_by: session?.user.id,
    };

    let eventId;
    if (editEvent) {
      const { data: updated, error } = await supabase
        .from('events')
        .update(payload)
        .eq('id', editEvent.id)
        .select()
        .single();
      if (error) { toast.error('Failed: ' + error.message); setSaving(false); return; }
      eventId = updated.id;
    } else {
      const { data: created, error } = await supabase
        .from('events')
        .insert(payload)
        .select()
        .single();
      if (error) { toast.error('Failed: ' + error.message); setSaving(false); return; }
      eventId = created.id;
    }

    // Handle assignees
    if (data.assignees && data.assignees.length > 0) {
      if (editEvent) {
        await supabase.from('event_assignees').delete().eq('event_id', eventId);
      }
      const assigneeRows = data.assignees.map((userId: string) => ({
        event_id: eventId,
        user_id: userId,
        role: 'volunteer',
      }));
      await supabase.from('event_assignees').insert(assigneeRows);
      await createNotifications(supabase, data.assignees.map((userId: string) => ({
        user_id: userId,
        type: 'event' as const,
        title: 'Event assigned',
        message: `You were assigned to event: ${data.name}`,
        redirect_url: '/events',
        entity_type: 'event',
        entity_id: eventId,
      })));
    }

    toast.success(editEvent ? 'Event updated!' : 'Event created!');
    setShowModal(false);
    form.reset();
    setEditEvent(null);
    fetchData();
    setSaving(false);
  };

  const deleteEvent = async (eventId: string) => {
    const { error } = await supabase.from('events').delete().eq('id', eventId);
    if (error) { toast.error('Failed to delete'); }
    else { toast.success('Event deleted'); fetchData(); }
  };

  const getStatusColor = (status: string) => {
    if (status === 'upcoming') return 'var(--accent-h)';
    if (status === 'ongoing') return 'var(--success)';
    if (status === 'completed') return 'var(--text-2)';
    return 'var(--danger)';
  };

  const getStatusBg = (status: string) => {
    if (status === 'upcoming') return 'var(--accent-bg)';
    if (status === 'ongoing') return 'var(--success-bg)';
    if (status === 'completed') return 'var(--surface-2)';
    return 'var(--danger-bg)';
  };

  const isAdmin = profile && ['admin', 'super_admin'].includes(profile.role);
  const departmentNames = Array.from(new Set(
    interns.map((intern: any) => intern.department?.name).filter(Boolean)
  ));

  const setSelectedInterns = (ids: string[]) => {
    form.setValue('assignees', ids, { shouldDirty: true, shouldValidate: true });
  };

  const selectDepartmentInterns = (departmentName: string) => {
    const ids = interns
      .filter((intern: any) => intern.department?.name === departmentName)
      .map((intern: any) => intern.id);
    setSelectedInterns(ids);
  };

  const filtered = events.filter(e => {
    const matchStatus = statusFilter === 'all' || e.status === statusFilter;
    const matchSearch = searchQuery === '' ||
      e.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.state?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.poc_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchSearch;
  });

  if (loading || !profile) {
    return <AppLoader message="Loading events" />;
  }

  return (
    <div className="layout">
      <Sidebar profile={profile} />
      <main className="main-content">

        {/* View Event Modal */}
        {viewEvent && (
          <div className="modal-overlay" onClick={() => setViewEvent(null)}>
            <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-title">{viewEvent.name}</div>
                <button className="btn btn-ghost btn-sm" onClick={() => setViewEvent(null)}>✕</button>
              </div>
              <div className="modal-body">
                {/* Status & Category */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                    color: getStatusColor(viewEvent.status), background: getStatusBg(viewEvent.status)
                  }}>{viewEvent.status?.toUpperCase()}</span>
                  <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'var(--surface-2)', color: 'var(--text-2)' }}>
                    {viewEvent.category}
                  </span>
                </div>

                {viewEvent.description && (
                  <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.6 }}>
                    {viewEvent.description}
                  </p>
                )}

                {/* Date & Time */}
                <div className="card" style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Date & Time
                  </div>
                  <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span>📅 Start: {format(new Date(viewEvent.event_date), 'EEEE, MMM d, yyyy')} {viewEvent.event_time ? `at ${viewEvent.event_time.slice(0, 5)}` : ''}</span>
                    {viewEvent.end_date && <span>📅 End: {format(new Date(viewEvent.end_date), 'EEEE, MMM d, yyyy')} {viewEvent.end_time ? `at ${viewEvent.end_time.slice(0, 5)}` : ''}</span>}
                  </div>
                </div>

                {/* Location */}
                {(viewEvent.state || viewEvent.city || viewEvent.area || viewEvent.full_address) && (
                  <div className="card" style={{ marginBottom: 12 }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Location
                    </div>
                    <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4, color: 'var(--text-1)' }}>
                      {viewEvent.area && <span>📍 Area: {viewEvent.area}</span>}
                      {viewEvent.city && <span>🏙️ City: {viewEvent.city}</span>}
                      {viewEvent.state && <span>🗺️ State: {viewEvent.state}</span>}
                      {viewEvent.full_address && <span>📋 Address: {viewEvent.full_address}</span>}
                    </div>
                  </div>
                )}

                {/* POC */}
                {(viewEvent.poc_name || viewEvent.poc_phone || viewEvent.poc_email) && (
                  <div className="card" style={{ marginBottom: 12 }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Point of Contact
                    </div>
                    <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4, color: 'var(--text-1)' }}>
                      {viewEvent.poc_name && <span>👤 {viewEvent.poc_name} {viewEvent.poc_role ? `(${viewEvent.poc_role})` : ''}</span>}
                      {viewEvent.poc_phone && <span>📞 {viewEvent.poc_phone}</span>}
                      {viewEvent.poc_email && <span>📧 {viewEvent.poc_email}</span>}
                    </div>
                  </div>
                )}

                {/* Extra Details */}
                {(viewEvent.budget || viewEvent.expected_attendance || viewEvent.actual_attendance) && (
                  <div className="card" style={{ marginBottom: 12 }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Event Details
                    </div>
                    <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4, color: 'var(--text-1)' }}>
                      {viewEvent.budget && <span>💰 Budget: ₹{Number(viewEvent.budget).toLocaleString()}</span>}
                      {viewEvent.expected_attendance && <span>👥 Expected: {viewEvent.expected_attendance} people</span>}
                      {viewEvent.actual_attendance && <span>✅ Actual: {viewEvent.actual_attendance} people</span>}
                    </div>
                  </div>
                )}

                {/* Assigned Interns */}
                {viewEvent.assignees && viewEvent.assignees.length > 0 && (
                  <div className="card" style={{ marginBottom: 12 }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Assigned Team
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {viewEvent.assignees.map((a: any) => (
                        <span key={a.user_id} style={{
                          fontSize: 12, padding: '3px 10px', borderRadius: 20,
                          background: 'var(--accent-bg)', color: 'var(--accent-h)'
                        }}>
                          {a.profile?.full_name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {viewEvent.notes && (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Notes</div>
                    <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>{viewEvent.notes}</p>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                {isAdmin && (
                  <button className="btn btn-secondary" onClick={() => { setViewEvent(null); openEditModal(viewEvent); }}>
                    Edit Event
                  </button>
                )}
                <button className="btn btn-primary" onClick={() => setViewEvent(null)}>Close</button>
              </div>
            </div>
          </div>
        )}

        {/* Create/Edit Event Modal */}
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-title">{editEvent ? 'Edit Event' : 'Create Event'}</div>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
              </div>
              <form onSubmit={form.handleSubmit(saveEvent)}>
                <div className="modal-body">

                  {/* Basic Info */}
                  <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                    Basic Info
                  </div>
                  <div className="form-group">
                    <label className="form-label">Event Name *</label>
                    <input className="form-input" placeholder="e.g. Tech Summit 2026"
                      {...form.register('name', { required: true })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Description (optional)</label>
                    <textarea className="form-textarea" placeholder="What is this event about?"
                      {...form.register('description')} />
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Category</label>
                      <select className="form-select" {...form.register('category')}>
                        <option value="general">General</option>
                        <option value="conference">Conference</option>
                        <option value="workshop">Workshop</option>
                        <option value="exhibition">Exhibition</option>
                        <option value="seminar">Seminar</option>
                        <option value="networking">Networking</option>
                        <option value="competition">Competition</option>
                        <option value="cultural">Cultural</option>
                        <option value="sports">Sports</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Status</label>
                      <select className="form-select" {...form.register('status')}>
                        <option value="upcoming">Upcoming</option>
                        <option value="ongoing">Ongoing</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>
                  </div>

                  {/* Date & Time */}
                  <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '16px 0 8px' }}>
                    Date & Time
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Start Date *</label>
                      <input type="date" className="form-input"
                        {...form.register('event_date', { required: true })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Start Time (optional)</label>
                      <input type="time" className="form-input"
                        {...form.register('event_time')} />
                    </div>
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">End Date (optional)</label>
                      <input type="date" className="form-input"
                        {...form.register('end_date')} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">End Time (optional)</label>
                      <input type="time" className="form-input"
                        {...form.register('end_time')} />
                    </div>
                  </div>

                  {/* Location */}
                  <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '16px 0 8px' }}>
                    Location (optional)
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">State</label>
                      <input className="form-input" placeholder="e.g. Maharashtra"
                        {...form.register('state')} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">City</label>
                      <input className="form-input" placeholder="e.g. Pune"
                        {...form.register('city')} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Area</label>
                    <input className="form-input" placeholder="e.g. Koregaon Park"
                      {...form.register('area')} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Full Address</label>
                    <textarea className="form-textarea" placeholder="Complete address..."
                      {...form.register('full_address')} />
                  </div>

                  {/* POC */}
                  <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '16px 0 8px' }}>
                    Point of Contact (optional)
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">POC Name</label>
                      <input className="form-input" placeholder="Contact person name"
                        {...form.register('poc_name')} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">POC Role</label>
                      <input className="form-input" placeholder="e.g. Event Manager"
                        {...form.register('poc_role')} />
                    </div>
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">POC Phone</label>
                      <input className="form-input" placeholder="+91 98765 43210"
                        {...form.register('poc_phone')} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">POC Email</label>
                      <input type="email" className="form-input" placeholder="poc@example.com"
                        {...form.register('poc_email')} />
                    </div>
                  </div>

                  {/* Extra Details */}
                  <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '16px 0 8px' }}>
                    Extra Details (optional)
                  </div>
                  <div className="grid-2">
                    <div className="form-group">
                      <label className="form-label">Budget (₹)</label>
                      <input type="number" className="form-input" placeholder="0"
                        {...form.register('budget')} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Expected Attendance</label>
                      <input type="number" className="form-input" placeholder="0"
                        {...form.register('expected_attendance')} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Actual Attendance (after event)</label>
                    <input type="number" className="form-input" placeholder="0"
                      {...form.register('actual_attendance')} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Notes</label>
                    <textarea className="form-textarea" placeholder="Any additional notes..."
                      {...form.register('notes')} />
                  </div>

                  {/* Assign Interns */}
                  {interns.length > 0 && (
                    <>
                      <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '16px 0 8px' }}>
                        Assign Interns (optional)
                      </div>
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
                        maxHeight: 150, overflowY: 'auto',
                        border: '1px solid var(--border)', borderRadius: 8, padding: 10
                      }}>
                        {interns.map((i: any) => (
                          <label key={i.id} style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '6px 4px', fontSize: 13, cursor: 'pointer'
                          }}>
                            <input type="checkbox" value={i.id} {...form.register('assignees')} />
                            {i.full_name} ({i.email})
                            {i.department?.name && (
                              <span style={{ color: 'var(--text-3)', fontSize: 12 }}>- {i.department.name}</span>
                            )}
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Saving...' : editEvent ? 'Save Changes' : 'Create Event'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Page Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <div className="page-title">Events</div>
            <div className="page-subtitle">
              {isAdmin ? 'Create and manage events' : 'Events you are assigned to'}
            </div>
          </div>
          {isAdmin && (
            <button className="btn btn-primary" onClick={openCreateModal}>
              + Create Event
            </button>
          )}
        </div>

        {/* Search + Filter */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="form-input"
            placeholder="🔍 Search by name, city, state, POC..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ maxWidth: 320 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            {['all', 'upcoming', 'ongoing', 'completed', 'cancelled'].map(s => (
              <button key={s}
                onClick={() => setStatusFilter(s)}
                className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}>
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="stats-grid" style={{ marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-label">Total Events</div>
            <div className="stat-value">{events.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Upcoming</div>
            <div className="stat-value" style={{ color: 'var(--accent-h)' }}>
              {events.filter(e => e.status === 'upcoming').length}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Ongoing</div>
            <div className="stat-value" style={{ color: 'var(--success)' }}>
              {events.filter(e => e.status === 'ongoing').length}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Completed</div>
            <div className="stat-value" style={{ color: 'var(--text-2)' }}>
              {events.filter(e => e.status === 'completed').length}
            </div>
          </div>
        </div>

        {/* Events List */}
        {filtered.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon">🎪</div>
              <div className="empty-state-text">No events found</div>
              <div className="empty-state-sub">
                {isAdmin ? 'Create your first event!' : 'You have not been assigned to any events yet'}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map((event: any) => (
              <div key={event.id} className="card" style={{ cursor: 'pointer' }}
                onClick={() => setViewEvent(event)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{event.name}</span>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                        color: getStatusColor(event.status), background: getStatusBg(event.status)
                      }}>
                        {event.status?.toUpperCase()}
                      </span>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--surface-2)', color: 'var(--text-2)' }}>
                        {event.category}
                      </span>
                    </div>

                    {event.description && (
                      <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8 }}>
                        {event.description.slice(0, 80)}{event.description.length > 80 ? '...' : ''}
                      </p>
                    )}

                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: 'var(--text-2)' }}>
                      <span>📅 {format(new Date(event.event_date), 'MMM d, yyyy')}</span>
                      {event.city && <span>📍 {event.area ? `${event.area}, ` : ''}{event.city}{event.state ? `, ${event.state}` : ''}</span>}
                      {event.poc_name && <span>👤 POC: {event.poc_name}</span>}
                      {event.assignees && event.assignees.length > 0 && (
                        <span>👥 {event.assignees.length} intern{event.assignees.length > 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>

                  {isAdmin && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} onClick={e => e.stopPropagation()}>
                      <button className="btn btn-secondary btn-sm"
                        onClick={() => openEditModal(event)}>
                        Edit
                      </button>
                      <button className="btn btn-danger btn-sm"
                        onClick={() => deleteEvent(event.id)}>
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
