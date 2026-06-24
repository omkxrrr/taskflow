'use client';
import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import Sidebar from '@/components/layout/Sidebar';
import { createClient } from '@/lib/supabase/client';
import { signOutInactiveUser } from '@/lib/auth/inactive-user';
import AppLoader from '@/components/layout/AppLoader';

export default function InternReportsPage() {
  const [profile, setProfile] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [updates, setUpdates] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState('30');
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = '/auth/login'; return; }

    const { data: prof } = await supabase
      .from('profiles')
      .select('*, department:departments!profiles_department_id_fkey(name)')
      .eq('id', session.user.id)
      .single();
    if (await signOutInactiveUser(supabase, prof)) return;

    if (prof && ['admin', 'super_admin'].includes(prof.role)) {
      window.location.href = '/admin/reports';
      return;
    }

    setProfile(prof);

    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(dateRange));
    const fromDate = format(daysAgo, 'yyyy-MM-dd');

    const { data: taskList } = await supabase
      .from('tasks')
      .select('*')
      .eq('assigned_to', session.user.id)
      .gte('created_at', daysAgo.toISOString())
      .order('created_at', { ascending: false });
    setTasks(taskList || []);

    const { data: updateList } = await supabase
      .from('daily_updates')
      .select('*')
      .eq('user_id', session.user.id)
      .gte('update_date', fromDate)
      .order('update_date', { ascending: false });
    setUpdates(updateList || []);

    const { data: meetingList } = await supabase
      .from('meeting_attendees')
      .select('*, meeting:meetings(title, meeting_date)')
      .eq('user_id', session.user.id)
      .gte('created_at', daysAgo.toISOString())
      .order('created_at', { ascending: false });
    setMeetings(meetingList || []);

    setLoading(false);
  }, [dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading || !profile) {
    return <AppLoader message="Loading reports" />;
  }

  const approved = tasks.filter(t => t.status === 'approved').length;
  const rejected = tasks.filter(t => t.status === 'rejected').length;
  const pending = tasks.filter(t => t.status === 'pending').length;
  const submitted = tasks.filter(t => t.status === 'submitted').length;
  const completionRate = tasks.length ? Math.round((approved / tasks.length) * 100) : 0;
  const firstName = profile.full_name?.split(' ')[0] ?? 'Intern';

  const getPerformanceColor = (rate: number) => {
    if (rate >= 80) return 'var(--success)';
    if (rate >= 50) return 'var(--warning)';
    return 'var(--danger)';
  };

  return (
    <div className="layout">
      <Sidebar profile={profile} />
      <main className="main-content">
        <div className="dashboard-hero">
          <div>
            <div className="dashboard-kicker">Personal Report</div>
            <div className="dashboard-title">{firstName}'s Reports</div>
            <div className="dashboard-subtitle">
              Track your task progress, daily updates, and meeting activity.
            </div>
            <div className="dashboard-pills">
              {profile?.department?.name && <span className="dashboard-pill">{profile.department.name}</span>}
              <span className="dashboard-pill">Last {dateRange} days</span>
            </div>
          </div>
          <div className="dashboard-score">
            <div className="dashboard-score-label">Completion</div>
            <div className="dashboard-score-value" style={{ color: getPerformanceColor(completionRate) }}>
              {completionRate}%
            </div>
            <div className="dashboard-progress">
              <span style={{ width: `${completionRate}%`, background: getPerformanceColor(completionRate) }} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <select
            className="form-select"
            value={dateRange}
            onChange={e => setDateRange(e.target.value)}
            style={{ width: 160 }}>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last 1 year</option>
          </select>
        </div>

        <div className="dashboard-stats">
          <div className="dashboard-stat dashboard-stat-accent">
            <div className="stat-label">Total Tasks</div>
            <div className="stat-value">{tasks.length}</div>
            <div className="stat-sub">assigned to you</div>
          </div>
          <div className="dashboard-stat dashboard-stat-success">
            <div className="stat-label">Approved</div>
            <div className="stat-value">{approved}</div>
            <div className="stat-sub">completed successfully</div>
          </div>
          <div className="dashboard-stat dashboard-stat-warning">
            <div className="stat-label">Pending</div>
            <div className="stat-value">{pending}</div>
            <div className="stat-sub">waiting for action</div>
          </div>
          <div className="dashboard-stat dashboard-stat-info">
            <div className="stat-label">Submitted</div>
            <div className="stat-value">{submitted}</div>
            <div className="stat-sub">awaiting review</div>
          </div>
          <div className="dashboard-stat dashboard-stat-neutral">
            <div className="stat-label">Updates</div>
            <div className="stat-value">{updates.length}</div>
            <div className="stat-sub">daily reports sent</div>
          </div>
        </div>

        <div className="dashboard-grid">
          <div className="card dashboard-panel">
            <div className="card-header">
              <div>
                <div className="card-title">Task Status</div>
                <div className="dashboard-panel-sub">Your work summary for the selected period</div>
              </div>
            </div>
            <div className="dashboard-bars">
              <div>
                <div className="dashboard-bar-label"><span>Approved</span><span>{approved}</span></div>
                <div className="dashboard-bar"><span className="bar-success" style={{ width: `${completionRate}%` }} /></div>
              </div>
              <div>
                <div className="dashboard-bar-label"><span>Pending</span><span>{pending}</span></div>
                <div className="dashboard-bar"><span className="bar-warning" style={{ width: `${tasks.length ? Math.round((pending / tasks.length) * 100) : 0}%` }} /></div>
              </div>
              <div>
                <div className="dashboard-bar-label"><span>Rejected</span><span>{rejected}</span></div>
                <div className="dashboard-bar"><span style={{ width: `${tasks.length ? Math.round((rejected / tasks.length) * 100) : 0}%`, background: 'var(--danger)' }} /></div>
              </div>
            </div>
          </div>

          <div className="card dashboard-panel">
            <div className="card-header">
              <div>
                <div className="card-title">Activity</div>
                <div className="dashboard-panel-sub">Updates and meetings</div>
              </div>
            </div>
            <div className="dashboard-deadlines">
              <div className="dashboard-deadline" style={{ background: 'var(--accent-bg)' }}>
                <div>
                  <div className="dashboard-deadline-title">Daily Updates</div>
                  <div className="dashboard-deadline-meta">submitted in this period</div>
                </div>
                <span style={{ color: 'var(--accent-h)' }}>{updates.length}</span>
              </div>
              <div className="dashboard-deadline" style={{ background: 'var(--success-bg)' }}>
                <div>
                  <div className="dashboard-deadline-title">Meetings</div>
                  <div className="dashboard-deadline-meta">attendance records</div>
                </div>
                <span style={{ color: 'var(--success)' }}>{meetings.length}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card dashboard-panel">
          <div className="card-header">
            <div>
              <div className="card-title">Recent Tasks</div>
              <div className="dashboard-panel-sub">Latest tasks included in this report</div>
            </div>
          </div>
          {tasks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-text">No tasks found</div>
              <div className="empty-state-sub">Try changing the date range.</div>
            </div>
          ) : (
            <div className="table-wrap dashboard-table">
              <table>
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Due date</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.slice(0, 8).map((task: any) => (
                    <tr key={task.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{task.title}</div>
                        {task.description && (
                          <div className="text-sm" style={{ marginTop: 2 }}>
                            {(task.description || '').slice(0, 70)}{(task.description || '').length > 70 ? '...' : ''}
                          </div>
                        )}
                      </td>
                      <td><span className={`badge badge-${task.priority}`}>{task.priority}</span></td>
                      <td><span className={`badge badge-${task.status}`}>{task.status}</span></td>
                      <td style={{ color: 'var(--text-2)' }}>
                        {task.due_date ? format(new Date(task.due_date), 'MMM d, yyyy') : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
