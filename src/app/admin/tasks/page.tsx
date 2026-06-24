'use client';
import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { createNotification } from '@/lib/notifications';

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [interns, setInterns] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [reviewTask, setReviewTask] = useState<any>(null);
  const [viewTask, setViewTask] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [creating, setCreating] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  const createForm = useForm<any>();
  const reviewForm = useForm<any>();
  const selectedDepartment = createForm.watch('department_id');

  const supabase = createClient();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: tasksData } = await supabase
      .from('tasks')
      .select('*, assigned_profile:profiles!tasks_assigned_to_fkey(full_name, email)')
      .order('created_at', { ascending: false });
    setTasks(tasksData || []);

    const { data: internsData } = await supabase
      .from('profiles')
      .select('*, department:departments!profiles_department_id_fkey(name)')
      .eq('role', 'intern')
      .eq('is_active', true);
    setInterns(internsData || []);

    const { data: deptData } = await supabase
      .from('departments')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });
    setDepartments(deptData || []);

    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const createTask = async (data: any) => {
    setCreating(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { data: task, error } = await supabase.from('tasks').insert({
      title: data.title,
      description: data.description || null,
      priority: data.priority,
      category: data.category || 'general',
      due_date: data.due_date || null,
      assigned_to: data.assigned_to,
      created_by: session?.user.id,
      status: 'pending',
    }).select().single();

    if (error) {
      toast.error('Failed to create task: ' + error.message);
    } else {
      toast.success('Task created!');
      await createNotification(supabase, {
        user_id: data.assigned_to,
        type: 'task',
        title: 'New task assigned',
        message: `New task assigned: ${data.title}`,
        redirect_url: '/tasks',
        entity_type: 'task',
        entity_id: task?.id,
      });
      setShowCreate(false);
      createForm.reset();
      fetchData();
    }
    setCreating(false);
  };

  const reviewTask_ = async (data: any) => {
    setReviewing(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase
      .from('tasks')
      .update({
        status: data.action,
        reviewed_by: session?.user.id,
        reviewed_at: new Date().toISOString(),
        review_note: data.review_note || null,
      })
      .eq('id', reviewTask.id);
    if (error) {
      toast.error('Failed: ' + error.message);
    } else {
      toast.success(data.action === 'approved' ? 'Task Approved! ✅' : 'Task Rejected');
      await createNotification(supabase, {
        user_id: reviewTask.assigned_to,
        type: 'task',
        title: `Task ${data.action}`,
        message: `Your task "${reviewTask.title}" was ${data.action}`,
        redirect_url: '/tasks',
        entity_type: 'task',
        entity_id: reviewTask.id,
      });
      setReviewTask(null);
      reviewForm.reset();
      fetchData();
    }
    setReviewing(false);
  };

  const deleteTask = async (task: any) => {
    if (!window.confirm(`Delete task "${task.title}"?`)) return;

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', task.id);

    if (error) {
      toast.error('Failed to delete task: ' + error.message);
    } else {
      toast.success('Task deleted');
      fetchData();
    }
  };

  const filtered = statusFilter === 'all' ? tasks : tasks.filter(t => t.status === statusFilter);
  const filteredInterns = selectedDepartment
    ? interns.filter((intern: any) => intern.department_id === selectedDepartment)
    : interns;

  const statusBadge = (s: string) => (
    <span className={`badge badge-${s}`}>{s}</span>
  );

  return (
    <>
      {/* Create Task Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Create New Task</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>✕</button>
            </div>
            <form onSubmit={createForm.handleSubmit(createTask)}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Title *</label>
                  <input className="form-input" placeholder="Task title"
                    {...createForm.register('title', { required: true })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-textarea" placeholder="Describe the task..."
                    {...createForm.register('description')} />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Priority</label>
                    <select className="form-select" {...createForm.register('priority')}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Due Date</label>
                    <input type="date" className="form-input"
                      {...createForm.register('due_date')} />
                  </div>
                </div>

                <div className="form-group">
  <label className="form-label">Category</label>
  <select className="form-select" {...createForm.register('category')}>
    <option value="general">General</option>
    <option value="design">Design</option>
    <option value="development">Development</option>
    <option value="marketing">Marketing</option>
    <option value="research">Research</option>
    <option value="content">Content</option>
  </select>
</div>

                <div className="form-group">
                  <label className="form-label">Department</label>
                  <select
                    className="form-select"
                    {...createForm.register('department_id')}
                    onChange={e => {
                      createForm.setValue('department_id', e.target.value);
                      createForm.setValue('assigned_to', '');
                    }}>
                    <option value="">All departments</option>
                    {departments.map((department: any) => (
                      <option key={department.id} value={department.id}>{department.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Assign To *</label>
                  <select className="form-select"
                    {...createForm.register('assigned_to', { required: true })}>
                    <option value="">
                      {selectedDepartment ? 'Select intern from department...' : 'Select intern...'}
                    </option>
                    {filteredInterns.map((i: any) => (
                      <option key={i.id} value={i.id}>
                        {i.full_name} ({i.email}){i.department?.name ? ` - ${i.department.name}` : ''}
                      </option>
                    ))}
                  </select>
                  {selectedDepartment && filteredInterns.length === 0 && (
                    <div className="text-sm" style={{ marginTop: 4 }}>
                      No active interns found in this department.
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary"
                  onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewTask && (
        <div className="modal-overlay" onClick={() => setReviewTask(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Review Submission</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setReviewTask(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="card" style={{ marginBottom: 0 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{reviewTask.title}</div>
                {reviewTask.description && (
                  <div className="text-sm" style={{ marginBottom: 10 }}>{reviewTask.description}</div>
                )}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-2)', marginBottom: 4 }}>
                    INTERN SUBMISSION NOTE:
                  </div>
                  <div style={{ fontSize: 13 }}>
                    {reviewTask.submission_note || '(no note)'}
                  </div>
                  {reviewTask.submission_url && (
                    <a href={reviewTask.submission_url} target="_blank" rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm" style={{ marginTop: 8, display: 'inline-flex' }}>
                      View Link ↗
                    </a>
                  )}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Your Feedback (optional)</label>
                <textarea className="form-textarea" placeholder="Add feedback for intern..."
                  {...reviewForm.register('review_note')} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setReviewTask(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={reviewing}
                onClick={() => { reviewForm.setValue('action', 'rejected'); reviewForm.handleSubmit(reviewTask_)(); }}>
                Reject
              </button>
              <button className="btn btn-success" disabled={reviewing}
                onClick={() => { reviewForm.setValue('action', 'approved'); reviewForm.handleSubmit(reviewTask_)(); }}>
                {reviewing ? 'Saving...' : 'Approve ✓'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Task Modal */}
      {viewTask && (
        <div className="modal-overlay" onClick={() => setViewTask(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Task Details</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setViewTask(null)}>x</button>
            </div>
            <div className="modal-body">
              <div className="card" style={{ marginBottom: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                  <div style={{ fontWeight: 700 }}>{viewTask.title}</div>
                  {statusBadge(viewTask.status)}
                  {statusBadge(viewTask.priority)}
                </div>
                {viewTask.description && (
                  <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 10 }}>
                    {viewTask.description}
                  </div>
                )}
                <div style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span>Assigned to: {viewTask.assigned_profile?.full_name || '-'}</span>
                  <span>Category: {viewTask.category || 'general'}</span>
                  <span>Due date: {viewTask.due_date ? format(new Date(viewTask.due_date), 'MMM d, yyyy') : '-'}</span>
                  {viewTask.submitted_at && (
                    <span>Submitted: {format(new Date(viewTask.submitted_at), 'MMM d, yyyy h:mm a')}</span>
                  )}
                  {viewTask.reviewed_at && (
                    <span>Reviewed: {format(new Date(viewTask.reviewed_at), 'MMM d, yyyy h:mm a')}</span>
                  )}
                </div>
              </div>

              <div className="card" style={{ marginBottom: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-3)', marginBottom: 6 }}>
                  INTERN SUBMISSION
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                  {viewTask.submission_note || '(no submission note)'}
                </div>
                {viewTask.submission_url && (
                  <a href={viewTask.submission_url} target="_blank" rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm" style={{ marginTop: 10, display: 'inline-flex' }}>
                    View Submission
                  </a>
                )}
              </div>

              {viewTask.review_note && (
                <div className="card" style={{ marginBottom: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-3)', marginBottom: 6 }}>
                    ADMIN FEEDBACK
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.6 }}>{viewTask.review_note}</div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setViewTask(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Main Page */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div className="page-title">All Tasks</div>
          <div className="page-subtitle">Create and manage intern tasks</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + Create Task
        </button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['all', 'pending', 'submitted', 'approved', 'rejected'].map(s => (
          <button key={s}
            onClick={() => setStatusFilter(s)}
            className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}>
            {s === 'all' ? 'All' : s}
            {s !== 'all' && (
              <span style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '0 5px', fontSize: 10, marginLeft: 4 }}>
                {tasks.filter(t => t.status === s).length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <span className="spinner" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-text">No tasks found</div>
            <div className="empty-state-sub">Create a task and assign it to an intern</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Assigned To</th>
                  <th>Category</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Due Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((task: any) => (
                  <tr key={task.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{task.title}</div>
                      {task.description && (
                        <div className="text-sm" style={{ marginTop: 2 }}>
                          {(task.description || '').slice(0, 50)}{(task.description || '').length > 50 ? '...' : ''}
                        </div>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-2)' }}>
                      {task.assigned_profile?.full_name || '—'}
                    </td>
<td>
  <span style={{
    fontSize: 11, fontWeight: 600, padding: '2px 8px',
    borderRadius: 20, background: 'var(--surface-2)', color: 'var(--text-2)'
  }}>
    {task.category || 'general'}
  </span>
</td>

                    <td>{statusBadge(task.priority)}</td>
                    <td>{statusBadge(task.status)}</td>
                    <td style={{ color: 'var(--text-2)' }}>
                      {task.due_date ? format(new Date(task.due_date), 'MMM d, yyyy') : '—'}
                    </td>
                    <td>
                      {task.status === 'submitted' && (
                        <button className="btn btn-sm btn-primary"
                          onClick={() => setReviewTask(task)}>
                          Review
                        </button>
                      )}
                      {task.status !== 'pending' && (
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ marginLeft: task.status === 'submitted' ? 6 : 0 }}
                          onClick={() => setViewTask(task)}>
                          View
                        </button>
                      )}
                      <button
                        className="btn btn-danger btn-sm"
                        style={{ marginLeft: task.status !== 'pending' || task.status === 'submitted' ? 6 : 0 }}
                        onClick={() => deleteTask(task)}>
                        Delete
                      </button>
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
