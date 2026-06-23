'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { getCurrentProfile } from '@/lib/auth/profile-cache';
import AppLoader from '@/components/layout/AppLoader';

type OverviewTone = 'accent' | 'warning' | 'info' | 'success' | 'neutral';

export default function DashboardPage() {
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({ total: 0, pending: 0, submitted: 0, approved: 0 });
  const [urgentTasks, setUrgentTasks] = useState<any[]>([]);
  const [recentTasks, setRecentTasks] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementMessage, setAnnouncementMessage] = useState('');
  const [announcementSaving, setAnnouncementSaving] = useState(false);
  const [teamCount, setTeamCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    getCurrentProfile(supabase).then(async ({ session, profile: prof }) => {
      if (!session) {
        window.location.href = '/auth/login';
        return;
      }
      setProfile(prof);

      const isAdmin = prof && ['admin', 'super_admin'].includes(prof.role);

      const countTasks = (status?: string) => {
        let query = supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true });
        if (status) query = query.eq('status', status);
        if (!isAdmin) query = query.eq('assigned_to', session.user.id);
        return query;
      };

      const soon = new Date();
      soon.setDate(soon.getDate() + 3);
      const soonDate = soon.toISOString().slice(0, 10);

      let urgentQuery = supabase
        .from('tasks')
        .select('id, title, due_date, assigned_profile:profiles!tasks_assigned_to_fkey(full_name)')
        .eq('status', 'pending')
        .not('due_date', 'is', null)
        .lte('due_date', soonDate)
        .order('due_date', { ascending: true })
        .limit(5);
      if (!isAdmin) urgentQuery = urgentQuery.eq('assigned_to', session.user.id);

      let recentQuery = supabase
        .from('tasks')
        .select('*, assigned_profile:profiles!tasks_assigned_to_fkey(full_name)')
        .order('created_at', { ascending: false })
        .limit(5);
      if (!isAdmin) recentQuery = recentQuery.eq('assigned_to', session.user.id);

      const [
        totalResult,
        pendingResult,
        submittedResult,
        approvedResult,
        urgentResult,
        recentResult,
        teamResult,
        announcementsResult,
      ] = await Promise.all([
        countTasks(),
        countTasks('pending'),
        countTasks('submitted'),
        countTasks('approved'),
        urgentQuery,
        recentQuery,
        isAdmin
          ? supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'intern')
          : Promise.resolve({ count: 0 }),
        supabase
          .from('announcements')
          .select('id, title, message, author_name, created_at')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      setStats({
        total: totalResult.count ?? 0,
        pending: pendingResult.count ?? 0,
        submitted: submittedResult.count ?? 0,
        approved: approvedResult.count ?? 0,
      });
      setUrgentTasks(urgentResult.data || []);
      setRecentTasks(recentResult.data || []);
      setAnnouncements(announcementsResult.data || []);
      setTeamCount(teamResult.count ?? 0);

      setLoading(false);
    });
  }, []);

  const createAnnouncement = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!announcementMessage.trim()) {
      toast.error('Announcement message is required');
      return;
    }

    const supabase = createClient();
    setAnnouncementSaving(true);
    const { data, error } = await supabase
      .from('announcements')
      .insert({
        title: announcementTitle.trim() || 'Announcement',
        message: announcementMessage.trim(),
        author_name: profile?.full_name || 'Admin',
        created_by: profile?.id,
      })
      .select('id, title, message, author_name, created_at')
      .single();

    if (error) {
      toast.error('Failed to post announcement: ' + error.message);
    } else {
      setAnnouncements(current => [data, ...current].slice(0, 5));
      setAnnouncementTitle('');
      setAnnouncementMessage('');
      toast.success('Announcement posted');
    }
    setAnnouncementSaving(false);
  };

  const getDueDateStatus = (task: any) => {
    if (!task.due_date) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(task.due_date);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { label: `Overdue by ${Math.abs(diffDays)}d`, color: 'var(--danger)', bg: 'var(--danger-bg)' };
    if (diffDays === 0) return { label: 'Due Today', color: 'var(--warning)', bg: 'var(--warning-bg)' };
    if (diffDays === 1) return { label: 'Due Tomorrow', color: 'var(--warning)', bg: 'var(--warning-bg)' };
    return { label: `Due in ${diffDays}d`, color: 'var(--accent-h)', bg: 'var(--accent-bg)' };
  };

  if (loading) {
    return <AppLoader message="Loading dashboard" />;
  }

  const isAdmin = profile && ['admin', 'super_admin'].includes(profile.role);
  const completionRate = stats.total ? Math.round((stats.approved / stats.total) * 100) : 0;
  const pendingRate = stats.total ? Math.round((stats.pending / stats.total) * 100) : 0;
  const submittedRate = stats.total ? Math.round((stats.submitted / stats.total) * 100) : 0;
  const firstName = profile?.full_name?.split(' ')[0] ?? 'there';

  const overviewStats: { label: string; value: number; sub: string; tone: OverviewTone; meta: string }[] = [
    {
      label: 'Total Tasks',
      value: stats.total,
      sub: isAdmin ? 'across all interns' : 'assigned to you',
      tone: 'accent',
      meta: `${completionRate}% complete`,
    },
    {
      label: 'Pending',
      value: stats.pending,
      sub: 'waiting for action',
      tone: 'warning',
      meta: `${pendingRate}% workload`,
    },
    {
      label: 'Submitted',
      value: stats.submitted,
      sub: isAdmin ? 'awaiting your review' : 'awaiting review',
      tone: 'info',
      meta: `${submittedRate}% in review`,
    },
    {
      label: 'Approved',
      value: stats.approved,
      sub: 'completed tasks',
      tone: 'success',
      meta: `${completionRate}% done`,
    },
  ];

  if (isAdmin) {
    overviewStats.push({
      label: 'Team Size',
      value: teamCount,
      sub: 'active interns',
      tone: 'neutral',
      meta: `${urgentTasks.length} urgent`,
    });
  }

  const statusBadge = (status: string) => (
    <span className={`badge badge-${status}`}>{status}</span>
  );

  return (
    <>
      <div className="dashboard-hero">
        <div>
          <div className="dashboard-kicker">{format(new Date(), 'EEEE, MMMM d, yyyy')}</div>
          <div className="dashboard-title">{isAdmin ? 'Admin Dashboard' : 'My Dashboard'}</div>
          <div className="dashboard-subtitle">
            Welcome back, {firstName}. {isAdmin ? 'Here is the team workload at a glance.' : 'Here is your task progress.'}
          </div>
          <div className="dashboard-pills">
            {profile?.department?.name && (
              <span className="dashboard-pill">{profile.department.name}</span>
            )}
            <span className="dashboard-pill">{isAdmin ? 'Admin view' : 'Personal view'}</span>
          </div>
        </div>
        <div className="dashboard-score">
          <div className="dashboard-score-label">Completion</div>
          <div className="dashboard-score-value">{completionRate}%</div>
          <div className="dashboard-progress">
            <span style={{ width: `${completionRate}%` }} />
          </div>
        </div>
      </div>

      <div className="dashboard-stats">
        {overviewStats.map((item) => (
          <div key={item.label} className={`dashboard-stat dashboard-stat-${item.tone}`}>
            <div className="dashboard-stat-top">
              <div className="stat-label">{item.label}</div>
              <span>{item.meta}</span>
            </div>
            <div className="stat-value">{item.value}</div>
            <div className="stat-sub">{item.sub}</div>
          </div>
        ))}
      </div>

      <div className="card dashboard-panel dashboard-announcements">
        <div className="card-header">
          <div>
            <div className="card-title">Announcements</div>
            <div className="dashboard-panel-sub">
              {isAdmin ? 'Post updates for all interns' : 'Latest updates from your admins'}
            </div>
          </div>
          <span className="badge badge-admin">{announcements.length} latest</span>
        </div>

        {isAdmin && (
          <form className="announcement-compose" onSubmit={createAnnouncement}>
            <input
              className="form-input"
              placeholder="Announcement title"
              value={announcementTitle}
              onChange={event => setAnnouncementTitle(event.target.value)}
            />
            <textarea
              className="form-textarea"
              placeholder="Write announcement for all interns..."
              value={announcementMessage}
              onChange={event => setAnnouncementMessage(event.target.value)}
            />
            <div className="announcement-compose-footer">
              <span>Visible to all interns on their dashboard</span>
              <button className="btn btn-primary" type="submit" disabled={announcementSaving}>
                {announcementSaving ? 'Posting...' : 'Post Announcement'}
              </button>
            </div>
          </form>
        )}

        {announcements.length === 0 ? (
          <div className="dashboard-empty-compact">
            <div className="empty-state-text">No announcements yet</div>
            <div className="empty-state-sub">
              {isAdmin ? 'Write the first update for your interns.' : 'Important updates will appear here.'}
            </div>
          </div>
        ) : (
          <div className="announcement-list">
            {announcements.map((announcement: any) => (
              <article key={announcement.id} className="announcement-item">
                <div className="announcement-marker">A</div>
                <div className="announcement-body">
                  <div className="announcement-top">
                    <strong>{announcement.title}</strong>
                    <span>{format(new Date(announcement.created_at), 'MMM d, h:mm a')}</span>
                  </div>
                  <p>{announcement.message}</p>
                  <em>{announcement.author_name || 'Admin'}</em>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <div className="dashboard-grid">
        <div className="card dashboard-panel">
          <div className="card-header">
            <div>
              <div className="card-title">Deadline Reminders</div>
              <div className="dashboard-panel-sub">Pending tasks due soon or already overdue</div>
            </div>
            <span className="badge badge-pending">{urgentTasks.length} urgent</span>
          </div>
          {urgentTasks.length === 0 ? (
            <div className="dashboard-empty-compact">
              <div className="empty-state-text">No urgent deadlines</div>
              <div className="empty-state-sub">Everything due soon is under control.</div>
            </div>
          ) : (
            <div className="dashboard-deadlines">
              {urgentTasks.slice(0, 5).map((task: any) => {
                const status = getDueDateStatus(task);
                return (
                  <div key={task.id} className="dashboard-deadline" style={{ background: status?.bg }}>
                    <div>
                      <div className="dashboard-deadline-title">{task.title}</div>
                      {isAdmin && task.assigned_profile?.full_name && (
                        <div className="dashboard-deadline-meta">{task.assigned_profile.full_name}</div>
                      )}
                    </div>
                    <span style={{ color: status?.color }}>{status?.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card dashboard-panel">
          <div className="card-header">
            <div>
              <div className="card-title">Workload Snapshot</div>
              <div className="dashboard-panel-sub">Current task mix by status</div>
            </div>
          </div>
          <div className="dashboard-bars">
            <div>
              <div className="dashboard-bar-label"><span>Pending</span><span>{stats.pending}</span></div>
              <div className="dashboard-bar"><span className="bar-warning" style={{ width: `${pendingRate}%` }} /></div>
            </div>
            <div>
              <div className="dashboard-bar-label"><span>Submitted</span><span>{stats.submitted}</span></div>
              <div className="dashboard-bar"><span className="bar-info" style={{ width: `${submittedRate}%` }} /></div>
            </div>
            <div>
              <div className="dashboard-bar-label"><span>Approved</span><span>{stats.approved}</span></div>
              <div className="dashboard-bar"><span className="bar-success" style={{ width: `${completionRate}%` }} /></div>
            </div>
          </div>
        </div>
      </div>

      <div className="card dashboard-panel">
        <div className="card-header">
          <div>
            <div className="card-title">Recent Tasks</div>
            <div className="dashboard-panel-sub">Latest assignments and review activity</div>
          </div>
        </div>
        {recentTasks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">Tasks</div>
            <div className="empty-state-text">No tasks yet</div>
            <div className="empty-state-sub">
              {isAdmin ? 'Create tasks for your interns to get started' : 'Tasks assigned to you will appear here'}
            </div>
          </div>
        ) : (
          <div className="table-wrap dashboard-table">
            <table>
              <thead>
                <tr>
                  <th>Task</th>
                  {isAdmin && <th>Assigned to</th>}
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Due date</th>
                </tr>
              </thead>
              <tbody>
                {recentTasks.map((task: any) => (
                  <tr key={task.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{task.title}</div>
                      {task.description && (
                        <div className="text-sm" style={{ marginTop: 2 }}>
                          {task.description.slice(0, 60)}{task.description.length > 60 ? '...' : ''}
                        </div>
                      )}
                    </td>
                    {isAdmin && (
                      <td style={{ color: 'var(--text-2)' }}>
                        {task.assigned_profile?.full_name ?? '-'}
                      </td>
                    )}
                    <td>{statusBadge(task.priority)}</td>
                    <td>{statusBadge(task.status)}</td>
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
    </>
  );
}
