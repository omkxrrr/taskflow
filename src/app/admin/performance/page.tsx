'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import AppLoader from '@/components/layout/AppLoader';

export default function PerformancePage() {
  const [loading, setLoading] = useState(true);
  const [performance, setPerformance] = useState<any[]>([]);
  const [sortBy, setSortBy] = useState<'completion' | 'total' | 'ontime'>('completion');

  const supabase = createClient();

  const fetchPerformance = useCallback(async () => {
    setLoading(true);

    const { data: interns } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'intern');

    if (!interns) { setLoading(false); return; }

    const { data: allTasks } = await supabase
      .from('tasks')
      .select('*');

    const stats = interns.map((intern: any) => {
      const internTasks = (allTasks || []).filter((t: any) => t.assigned_to === intern.id);
      const total = internTasks.length;
      const approved = internTasks.filter((t: any) => t.status === 'approved').length;
      const rejected = internTasks.filter((t: any) => t.status === 'rejected').length;
      const pending = internTasks.filter((t: any) => t.status === 'pending').length;
      const submitted = internTasks.filter((t: any) => t.status === 'submitted').length;

      const completedTasks = internTasks.filter((t: any) => t.status === 'approved' || t.status === 'rejected');
      const onTimeTasks = completedTasks.filter((t: any) => {
        if (!t.due_date || !t.submitted_at) return false;
        return new Date(t.submitted_at) <= new Date(t.due_date + 'T23:59:59');
      });
      const lateTasks = completedTasks.filter((t: any) => {
        if (!t.due_date || !t.submitted_at) return false;
        return new Date(t.submitted_at) > new Date(t.due_date + 'T23:59:59');
      });

      const completionRate = total > 0 ? Math.round((approved / total) * 100) : 0;
      const onTimeRate = completedTasks.length > 0 ? Math.round((onTimeTasks.length / completedTasks.length) * 100) : 0;

      return {
        intern, total, approved, rejected, pending, submitted,
        completionRate, onTimeRate,
        onTimeCount: onTimeTasks.length,
        lateCount: lateTasks.length,
      };
    });

    setPerformance(stats);
    setLoading(false);
  }, []);

  useEffect(() => { fetchPerformance(); }, [fetchPerformance]);

  const sorted = [...performance].sort((a, b) => {
    if (sortBy === 'completion') return b.completionRate - a.completionRate;
    if (sortBy === 'total') return b.total - a.total;
    return b.onTimeRate - a.onTimeRate;
  });

  const getRankBadge = (index: number) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `#${index + 1}`;
  };

  const getPerformanceColor = (rate: number) => {
    if (rate >= 80) return 'var(--success)';
    if (rate >= 50) return 'var(--warning)';
    return 'var(--danger)';
  };

  if (loading) {
    return <AppLoader message="Loading performance" />;
  }

  return (
    <>
      <div className="page-header">
        <div className="page-title">Intern Performance</div>
        <div className="page-subtitle">Track completion rates and on-time delivery</div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button onClick={() => setSortBy('completion')}
          className={`btn btn-sm ${sortBy === 'completion' ? 'btn-primary' : 'btn-secondary'}`}>
          Sort by Completion Rate
        </button>
        <button onClick={() => setSortBy('total')}
          className={`btn btn-sm ${sortBy === 'total' ? 'btn-primary' : 'btn-secondary'}`}>
          Sort by Total Tasks
        </button>
        <button onClick={() => setSortBy('ontime')}
          className={`btn btn-sm ${sortBy === 'ontime' ? 'btn-primary' : 'btn-secondary'}`}>
          Sort by On-Time Rate
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <div className="empty-state-text">No interns yet</div>
            <div className="empty-state-sub">Add interns to see performance tracking</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sorted.map((p, index) => (
            <div key={p.intern.id} className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                <div style={{
                  fontSize: 20, fontWeight: 700, width: 36, textAlign: 'center',
                  color: index < 3 ? undefined : 'var(--text-3)'
                }}>
                  {getRankBadge(index)}
                </div>
                <div className="user-avatar" style={{ width: 40, height: 40, fontSize: 13 }}>
                  {p.intern.full_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{p.intern.full_name}</div>
                  <div className="text-sm">{p.intern.email}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: getPerformanceColor(p.completionRate) }}>
                    {p.completionRate}%
                  </div>
                  <div className="text-sm">completion rate</div>
                </div>
              </div>

              <div style={{
                height: 8, background: 'var(--surface-2)', borderRadius: 4,
                overflow: 'hidden', marginBottom: 16
              }}>
                <div style={{
                  height: '100%', width: `${p.completionRate}%`,
                  background: getPerformanceColor(p.completionRate), transition: 'width 0.3s'
                }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{p.total}</div>
                  <div className="text-sm">Total</div>
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--success)' }}>{p.approved}</div>
                  <div className="text-sm">Approved</div>
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--danger)' }}>{p.rejected}</div>
                  <div className="text-sm">Rejected</div>
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--warning)' }}>{p.pending}</div>
                  <div className="text-sm">Pending</div>
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-h)' }}>{p.submitted}</div>
                  <div className="text-sm">Submitted</div>
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: getPerformanceColor(p.onTimeRate) }}>
                    {p.onTimeRate}%
                  </div>
                  <div className="text-sm">On-Time</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
