'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import AppLoader from '@/components/layout/AppLoader';

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [interns, setInterns] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [updates, setUpdates] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState('30');

  const supabase = createClient();

  const fetchData = useCallback(async () => {
    setLoading(true);

    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(dateRange));
    const fromDate = format(daysAgo, 'yyyy-MM-dd');

    const { data: internList } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'intern');
    setInterns(internList || []);

    const { data: taskList } = await supabase
      .from('tasks')
      .select('*')
      .gte('created_at', daysAgo.toISOString());
    setTasks(taskList || []);

    const { data: updateList } = await supabase
      .from('daily_updates')
      .select('*')
      .gte('update_date', fromDate);
    setUpdates(updateList || []);

    const { data: meetingList } = await supabase
      .from('meeting_attendees')
      .select('*, meeting:meetings(title, meeting_date)')
      .gte('created_at', daysAgo.toISOString());
    setMeetings(meetingList || []);

    setLoading(false);
  }, [dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getInternStats = (internId: string) => {
    const internTasks = tasks.filter(t => t.assigned_to === internId);
    const internUpdates = updates.filter(u => u.user_id === internId);
    const internMeetings = meetings.filter(m => m.user_id === internId);

    const total = internTasks.length;
    const approved = internTasks.filter(t => t.status === 'approved').length;
    const rejected = internTasks.filter(t => t.status === 'rejected').length;
    const pending = internTasks.filter(t => t.status === 'pending').length;
    const submitted = internTasks.filter(t => t.status === 'submitted').length;
    const completionRate = total > 0 ? Math.round((approved / total) * 100) : 0;

    return {
      total, approved, rejected, pending, submitted,
      completionRate,
      updateCount: internUpdates.length,
      meetingCount: internMeetings.length,
    };
  };

  const exportCSV = () => {
    const headers = [
      'Name', 'Email', 'Total Tasks', 'Approved', 'Rejected',
      'Pending', 'Submitted', 'Completion %', 'Daily Updates', 'Meetings'
    ];

    const rows = interns.map(intern => {
      const stats = getInternStats(intern.id);
      return [
        intern.full_name,
        intern.email,
        stats.total,
        stats.approved,
        stats.rejected,
        stats.pending,
        stats.submitted,
        stats.completionRate + '%',
        stats.updateCount,
        stats.meetingCount,
      ];
    });

    const csvContent = [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `internflow-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getPerformanceColor = (rate: number) => {
    if (rate >= 80) return 'var(--success)';
    if (rate >= 50) return 'var(--warning)';
    return 'var(--danger)';
  };

  if (loading) {
    return <AppLoader message="Loading admin reports" />;
  }

  // Overall stats
  const totalTasks = tasks.length;
  const totalApproved = tasks.filter(t => t.status === 'approved').length;
  const totalPending = tasks.filter(t => t.status === 'pending').length;
  const totalUpdates = updates.length;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div className="page-title">Reports</div>
          <div className="page-subtitle">Team performance overview and export</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
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
          <button className="btn btn-success" onClick={exportCSV}>
            ⬇ Export CSV
          </button>
        </div>
      </div>

      {/* Overall Stats */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Total Interns</div>
          <div className="stat-value">{interns.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Tasks</div>
          <div className="stat-value">{totalTasks}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Approved Tasks</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{totalApproved}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending Tasks</div>
          <div className="stat-value" style={{ color: 'var(--warning)' }}>{totalPending}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Daily Updates</div>
          <div className="stat-value" style={{ color: 'var(--accent-h)' }}>{totalUpdates}</div>
        </div>
      </div>

      {/* Per Intern Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Intern-wise Breakdown</div>
          <div className="text-sm">Last {dateRange} days</div>
        </div>
        {interns.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <div className="empty-state-text">No interns found</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Intern</th>
                  <th>Tasks Total</th>
                  <th>Approved</th>
                  <th>Rejected</th>
                  <th>Pending</th>
                  <th>Completion %</th>
                  <th>Daily Updates</th>
                  <th>Meetings</th>
                </tr>
              </thead>
              <tbody>
                {interns.map(intern => {
                  const stats = getInternStats(intern.id);
                  return (
                    <tr key={intern.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{intern.full_name}</div>
                        <div className="text-sm">{intern.email}</div>
                      </td>
                      <td>{stats.total}</td>
                      <td style={{ color: 'var(--success)', fontWeight: 600 }}>{stats.approved}</td>
                      <td style={{ color: 'var(--danger)', fontWeight: 600 }}>{stats.rejected}</td>
                      <td style={{ color: 'var(--warning)', fontWeight: 600 }}>{stats.pending}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 60, height: 6,
                            background: 'var(--surface-2)',
                            borderRadius: 3, overflow: 'hidden'
                          }}>
                            <div style={{
                              height: '100%',
                              width: `${stats.completionRate}%`,
                              background: getPerformanceColor(stats.completionRate)
                            }} />
                          </div>
                          <span style={{
                            fontWeight: 600,
                            color: getPerformanceColor(stats.completionRate)
                          }}>
                            {stats.completionRate}%
                          </span>
                        </div>
                      </td>
                      <td style={{ color: 'var(--accent-h)', fontWeight: 600 }}>{stats.updateCount}</td>
                      <td>{stats.meetingCount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
