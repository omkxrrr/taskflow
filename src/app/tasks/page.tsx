'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { createNotification } from '@/lib/notifications';

export default function MyTasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitTask, setSubmitTask] = useState<any>(null);
  const [filter, setFilter] = useState('all');
  const [submitting, setSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<any>();
  const supabase = createClient();

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('assigned_to', session.user.id)
      .order('created_at', { ascending: false });
    setTasks(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large. Max 10MB allowed.');
      return;
    }
    setSelectedFile(file);
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const submitTaskFn = async (data: any) => {
    setSubmitting(true);
    let fileUrl = null;
    let fileName = null;

    if (selectedFile) {
      setUploadProgress(true);
      const { data: { session } } = await supabase.auth.getSession();
      const fileExt = selectedFile.name.split('.').pop();
      const filePath = `${session?.user.id}/${submitTask.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('task-submissions')
        .upload(filePath, selectedFile);

      if (uploadError) {
        toast.error('File upload failed: ' + uploadError.message);
        setSubmitting(false);
        setUploadProgress(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('task-submissions')
        .getPublicUrl(filePath);

      fileUrl = urlData.publicUrl;
      fileName = selectedFile.name;
      setUploadProgress(false);
    }

    const { error } = await supabase
      .from('tasks')
      .update({
        status: 'submitted',
        submission_note: data.submission_note,
        submission_url: data.submission_url || fileUrl || null,
        submission_file_name: fileName,
        submitted_at: new Date().toISOString(),
      })
      .eq('id', submitTask.id);

    if (error) {
      toast.error('Failed: ' + error.message);
    } else {
      toast.success('Task submitted! ✅');
      if (submitTask.created_by) {
        await createNotification(supabase, {
          user_id: submitTask.created_by,
          type: 'task',
          title: 'Task submitted',
          message: `Task submitted for review: ${submitTask.title}`,
          redirect_url: '/admin/tasks',
          entity_type: 'task',
          entity_id: submitTask.id,
        });
      }
      setSubmitTask(null);
      form.reset();
      setSelectedFile(null);
      fetchTasks();
    }
    setSubmitting(false);
  };
const getDueDateStatus = (task: any) => {
  if (!task.due_date || task.status !== 'pending') return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(task.due_date);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { label: `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) > 1 ? 's' : ''}`, color: 'var(--danger)', bg: 'var(--danger-bg)' };
  if (diffDays === 0) return { label: 'Due Today', color: 'var(--warning)', bg: 'var(--warning-bg)' };
  if (diffDays === 1) return { label: 'Due Tomorrow', color: 'var(--warning)', bg: 'var(--warning-bg)' };
  if (diffDays <= 3) return { label: `Due in ${diffDays} days`, color: 'var(--accent-h)', bg: 'var(--accent-bg)' };
  return null;
};
  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);

  return (
    <>
      {submitTask && (
        <div className="modal-overlay" onClick={() => !submitting && setSubmitTask(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Submit Task</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSubmitTask(null)}>✕</button>
            </div>
            <form onSubmit={form.handleSubmit(submitTaskFn)}>
              <div className="modal-body">
                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ fontWeight: 600 }}>{submitTask.title}</div>
                  {submitTask.description && (
                    <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>{submitTask.description}</div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">What did you complete? *</label>
                  <textarea className="form-textarea" placeholder="Describe your work..."
                    style={{ minHeight: 100 }}
                    {...form.register('submission_note', { required: true })} />
                </div>

                <div className="form-group">
                  <label className="form-label">Upload File (optional, max 10MB)</label>
                  {!selectedFile ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        border: '2px dashed var(--border-2)',
                        borderRadius: 8,
                        padding: '20px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        color: 'var(--text-2)',
                        fontSize: 13,
                      }}
                    >
                      📎 Click to choose a file
                      <input
                        ref={fileInputRef}
                        type="file"
                        onChange={handleFileSelect}
                        style={{ display: 'none' }}
                      />
                    </div>
                  ) : (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--surface-2)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      padding: '10px 14px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                        <span>📄</span>
                        <span style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {selectedFile.name}
                        </span>
                        <span style={{ color: 'var(--text-3)' }}>
                          ({(selectedFile.size / 1024).toFixed(0)} KB)
                        </span>
                      </div>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={removeFile}>✕</button>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Or paste a link (optional)</label>
                  <input type="url" className="form-input" placeholder="https://github.com/... or Google Doc link"
                    {...form.register('submission_url')} />
                  <span className="text-sm">GitHub, Google Drive, Figma, etc.</span>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setSubmitTask(null)} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {uploadProgress ? 'Uploading file...' : submitting ? 'Submitting...' : 'Submit for Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="page-header">
        <div className="page-title">My Tasks</div>
        <div className="page-subtitle">Tasks assigned to you</div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['all', 'pending', 'submitted', 'approved', 'rejected'].map(s => (
          <button key={s}
            onClick={() => setFilter(s)}
            className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-secondary'}`}>
            {s === 'all' ? 'All' : s}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <span className="spinner" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">✅</div>
          <div className="empty-state-text">No tasks found</div>
        </div>
      ) : (
        filtered.map((task: any) => (
          <div key={task.id} className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600 }}>{task.title}</span>
                  <span className={`badge badge-${task.status}`}>{task.status}</span>
                  <span className={`badge badge-${task.priority}`}>{task.priority}</span>
                </div>
                {task.description && (
                  <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8 }}>{task.description}</p>
                )}
                {task.due_date && (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
    <span className="text-sm">Due {format(new Date(task.due_date), 'MMM d, yyyy')}</span>
    {getDueDateStatus(task) && (
      <span style={{
        fontSize: 11,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 20,
        color: getDueDateStatus(task)!.color,
        background: getDueDateStatus(task)!.bg,
      }}>
        ⏰ {getDueDateStatus(task)!.label}
      </span>
    )}
  </div>
)}
                {task.submission_url && task.status !== 'pending' && (
                  <div style={{ marginTop: 8 }}>
                    <a href={task.submission_url} target="_blank" rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm" style={{ display: 'inline-flex' }}>
                      📎 {task.submission_file_name || 'View submission'} ↗
                    </a>
                  </div>
                )}
                {task.review_note && (
                  <div style={{
                    marginTop: 10, padding: '10px 12px',
                    background: task.status === 'approved' ? 'var(--success-bg)' : 'var(--danger-bg)',
                    borderRadius: 6, fontSize: 13
                  }}>
                    <strong>Admin feedback:</strong> {task.review_note}
                  </div>
                )}
              </div>
              {task.status === 'pending' && (
                <button className="btn btn-primary btn-sm" onClick={() => setSubmitTask(task)}>
                  Submit
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </>
  );
}
