'use client';
import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from 'date-fns';
import Sidebar from '@/components/layout/Sidebar';
import { signOutInactiveUser } from '@/lib/auth/inactive-user';
import AppLoader from '@/components/layout/AppLoader';

export default function AttendancePage() {
  const [profile, setProfile] = useState<any>(null);
  const [interns, setInterns] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [marking, setMarking] = useState<string | null>(null);

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

    const monthStart = format(startOfMonth(new Date(selectedMonth + '-01')), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(new Date(selectedMonth + '-01')), 'yyyy-MM-dd');

    if (isAdmin) {
      const { data: internList } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'intern')
        .eq('is_active', true);
      setInterns(internList || []);

      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('*')
        .gte('attendance_date', monthStart)
        .lte('attendance_date', monthEnd);
      setAttendance(attendanceData || []);
    } else {
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', session.user.id)
        .gte('attendance_date', monthStart)
        .lte('attendance_date', monthEnd);
      setAttendance(attendanceData || []);
    }

    setLoading(false);
  }, [selectedMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const markAttendance = async (userId: string, date: string, status: string) => {
    setMarking(`${userId}-${date}`);
    const { data: { session } } = await supabase.auth.getSession();

    const existing = attendance.find(a => a.user_id === userId && a.attendance_date === date);

    if (existing) {
      const { error } = await supabase
        .from('attendance')
        .update({ status, marked_by: session?.user.id, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (error) { toast.error('Failed: ' + error.message); }
      else { toast.success('Updated!'); fetchData(); }
    } else {
      const { error } = await supabase
        .from('attendance')
        .insert({ user_id: userId, attendance_date: date, status, marked_by: session?.user.id });
      if (error) { toast.error('Failed: ' + error.message); }
      else { toast.success('Marked!'); fetchData(); }
    }
    setMarking(null);
  };

  const getAttendance = (userId: string, date: string) => {
    return attendance.find(a => a.user_id === userId && a.attendance_date === date);
  };

  const getStatusColor = (status: string) => {
    if (status === 'present') return 'var(--success)';
    if (status === 'late') return 'var(--warning)';
    if (status === 'half_day') return 'var(--accent-h)';
    return 'var(--danger)';
  };

  const getStatusBg = (status: string) => {
    if (status === 'present') return 'var(--success-bg)';
    if (status === 'late') return 'var(--warning-bg)';
    if (status === 'half_day') return 'var(--accent-bg)';
    return 'var(--danger-bg)';
  };

  const getStatusEmoji = (status: string) => {
    if (status === 'present') return '✅';
    if (status === 'late') return '🕐';
    if (status === 'half_day') return '½';
    return '❌';
  };

  const getInternStats = (userId: string) => {
    const internAttendance = attendance.filter(a => a.user_id === userId);
    const present = internAttendance.filter(a => a.status === 'present').length;
    const late = internAttendance.filter(a => a.status === 'late').length;
    const halfDay = internAttendance.filter(a => a.status === 'half_day').length;
    const absent = internAttendance.filter(a => a.status === 'absent').length;
    const total = internAttendance.length;
    const rate = total > 0 ? Math.round(((present + late + halfDay) / total) * 100) : 0;
    return { present, late, halfDay, absent, total, rate };
  };

  const isAdmin = profile && ['admin', 'super_admin'].includes(profile.role);

  const monthDays = eachDayOfInterval({
    start: startOfMonth(new Date(selectedMonth + '-01')),
    end: endOfMonth(new Date(selectedMonth + '-01')),
  }).filter(d => !isWeekend(d));

  const today = format(new Date(), 'yyyy-MM-dd');

  if (loading || !profile) {
    return <AppLoader message="Loading attendance" />;
  }

  return (
    <div className="layout">
      <Sidebar profile={profile} />
      <main className="main-content">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <div className="page-title">Attendance</div>
            <div className="page-subtitle">
              {isAdmin ? 'Mark and track intern attendance' : 'Your monthly attendance record'}
            </div>
          </div>
          <input
            type="month"
            className="form-input"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            style={{ width: 180 }}
          />
        </div>

        {isAdmin ? (
          /* Admin View — Table with all interns */
          <div className="card">
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ minWidth: 140, position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 1 }}>
                      Intern
                    </th>
                    {monthDays.map(day => (
                      <th key={day.toISOString()} style={{
                        minWidth: 44,
                        textAlign: 'center',
                        fontSize: 10,
                        color: format(day, 'yyyy-MM-dd') === today ? 'var(--accent-h)' : undefined,
                        fontWeight: format(day, 'yyyy-MM-dd') === today ? 700 : undefined,
                      }}>
                        {format(day, 'd')}
                        <div style={{ fontWeight: 400, color: 'var(--text-3)' }}>{format(day, 'EEE')}</div>
                      </th>
                    ))}
                    <th style={{ minWidth: 80, textAlign: 'center' }}>Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {interns.map(intern => {
                    const stats = getInternStats(intern.id);
                    return (
                      <tr key={intern.id}>
                        <td style={{ position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 1 }}>
                          <div style={{ fontWeight: 500, fontSize: 13 }}>{intern.full_name}</div>
                          <div className="text-sm">{stats.present}P {stats.late}L {stats.absent}A</div>
                        </td>
                        {monthDays.map(day => {
                          const dateStr = format(day, 'yyyy-MM-dd');
                          const record = getAttendance(intern.id, dateStr);
                          const isFuture = dateStr > today;
                          const isMarkingThis = marking === `${intern.id}-${dateStr}`;

                          return (
                            <td key={dateStr} style={{ textAlign: 'center', padding: '4px 2px' }}>
                              {isFuture ? (
                                <span style={{ color: 'var(--text-3)', fontSize: 12 }}>—</span>
                              ) : (
                                <select
                                  value={record?.status || ''}
                                  disabled={isMarkingThis}
                                  onChange={e => e.target.value && markAttendance(intern.id, dateStr, e.target.value)}
                                  style={{
                                    background: record ? getStatusBg(record.status) : 'var(--surface-2)',
                                    color: record ? getStatusColor(record.status) : 'var(--text-3)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 4,
                                    padding: '2px 2px',
                                    fontSize: 11,
                                    cursor: 'pointer',
                                    width: 36,
                                    textAlign: 'center',
                                  }}>
                                  <option value="">—</option>
                                  <option value="present">✅</option>
                                  <option value="late">🕐</option>
                                  <option value="half_day">½</option>
                                  <option value="absent">❌</option>
                                </select>
                              )}
                            </td>
                          );
                        })}
                        <td style={{ textAlign: 'center' }}>
                          <span style={{
                            fontWeight: 700,
                            color: stats.rate >= 80 ? 'var(--success)' : stats.rate >= 60 ? 'var(--warning)' : 'var(--danger)'
                          }}>
                            {stats.rate}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-2)' }}>
              <span>✅ Present</span>
              <span>🕐 Late</span>
              <span>½ Half Day</span>
              <span>❌ Absent</span>
              <span style={{ color: 'var(--text-3)' }}>P=Present L=Late A=Absent</span>
            </div>
          </div>
        ) : (
          /* Intern View — Their own attendance */
          <>
            {/* Stats */}
            {(() => {
              const stats = getInternStats(profile.id);
              return (
                <div className="stats-grid" style={{ marginBottom: 20 }}>
                  <div className="stat-card">
                    <div className="stat-label">Present</div>
                    <div className="stat-value" style={{ color: 'var(--success)' }}>{stats.present}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Late</div>
                    <div className="stat-value" style={{ color: 'var(--warning)' }}>{stats.late}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Absent</div>
                    <div className="stat-value" style={{ color: 'var(--danger)' }}>{stats.absent}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Attendance Rate</div>
                    <div className="stat-value" style={{
                      color: stats.rate >= 80 ? 'var(--success)' : stats.rate >= 60 ? 'var(--warning)' : 'var(--danger)'
                    }}>{stats.rate}%</div>
                  </div>
                </div>
              );
            })()}

            {/* Calendar Grid */}
            <div className="card">
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: 8,
              }}>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                  <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-3)', padding: '4px 0' }}>
                    {d}
                  </div>
                ))}
                {eachDayOfInterval({
                  start: startOfMonth(new Date(selectedMonth + '-01')),
                  end: endOfMonth(new Date(selectedMonth + '-01')),
                }).map(day => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const record = getAttendance(profile.id, dateStr);
                  const isToday = dateStr === today;
                  const isFuture = dateStr > today;
                  const weekend = isWeekend(day);

                  return (
                    <div key={dateStr} style={{
                      textAlign: 'center',
                      padding: '8px 4px',
                      borderRadius: 8,
                      background: record ? getStatusBg(record.status) : weekend ? 'transparent' : 'var(--surface-2)',
                      border: isToday ? '2px solid var(--accent)' : '1px solid var(--border)',
                      opacity: isFuture || weekend ? 0.4 : 1,
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: isToday ? 'var(--accent-h)' : 'var(--text-1)' }}>
                        {format(day, 'd')}
                      </div>
                      <div style={{ fontSize: 14, marginTop: 2 }}>
                        {record ? getStatusEmoji(record.status) : weekend ? '' : '·'}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-2)' }}>
                <span>✅ Present</span>
                <span>🕐 Late</span>
                <span>½ Half Day</span>
                <span>❌ Absent</span>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
