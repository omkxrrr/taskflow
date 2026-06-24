'use client';
import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editDept, setEditDept] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const form = useForm<any>();
  const supabase = createClient();

  const fetchData = useCallback(async () => {
    setLoading(true);

    const { data: depts } = await supabase
      .from('departments')
      .select('*, head:profiles!departments_head_id_fkey(full_name, email)')
      .order('created_at', { ascending: true });
    setDepartments(depts || []);

    const { data: adminList } = await supabase
      .from('profiles')
      .select('*')
      .in('role', ['admin', 'super_admin']);
    setAdmins(adminList || []);

    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreateModal = () => {
    setEditDept(null);
    form.reset({ name: '', description: '', head_id: '' });
    setShowModal(true);
  };

  const openEditModal = (dept: any) => {
    setEditDept(dept);
    form.reset({
      name: dept.name,
      description: dept.description || '',
      head_id: dept.head_id || '',
    });
    setShowModal(true);
  };

  const saveDepartment = async (data: any) => {
    setSaving(true);
    const payload = {
      name: data.name,
      description: data.description || null,
      head_id: data.head_id || null,
    };

    let error;
    if (editDept) {
      const res = await supabase.from('departments').update(payload).eq('id', editDept.id);
      error = res.error;
    } else {
      const res = await supabase.from('departments').insert(payload);
      error = res.error;
    }

    if (error) {
      toast.error('Failed: ' + error.message);
    } else {
      toast.success(editDept ? 'Department updated!' : 'Department created!');
      setShowModal(false);
      fetchData();
    }
    setSaving(false);
  };

  const toggleActive = async (dept: any) => {
    const { error } = await supabase
      .from('departments')
      .update({ is_active: !dept.is_active })
      .eq('id', dept.id);
    if (error) {
      toast.error('Failed to update');
    } else {
      toast.success(dept.is_active ? 'Department deactivated' : 'Department activated');
      fetchData();
    }
  };

  return (
    <>
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{editDept ? 'Edit Department' : 'Create Department'}</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={form.handleSubmit(saveDepartment)}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Department Name *</label>
                  <input className="form-input" placeholder="e.g. Marketing"
                    {...form.register('name', { required: true })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-textarea" placeholder="What does this department do?"
                    {...form.register('description')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Department Head</label>
                  <select className="form-select" {...form.register('head_id')}>
                    <option value="">No head assigned</option>
                    {admins.map((a: any) => (
                      <option key={a.id} value={a.id}>{a.full_name || a.email || 'Admin'} ({(a.role || 'admin').replace('_', ' ')})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editDept ? 'Save Changes' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div className="page-title">Departments</div>
          <div className="page-subtitle">Organize your team into departments</div>
        </div>
        <button className="btn btn-primary" onClick={openCreateModal}>
          + Add Department
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <span className="spinner" />
        </div>
      ) : departments.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">🏢</div>
            <div className="empty-state-text">No departments yet</div>
            <div className="empty-state-sub">Create your first department to organize your team</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {departments.map((dept: any) => (
            <div key={dept.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{dept.name}</div>
                <span className={`badge ${dept.is_active ? 'badge-approved' : 'badge-rejected'}`}>
                  {dept.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              {dept.description && (
                <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>
                  {dept.description}
                </p>
              )}
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16 }}>
                👤 Head: {dept.head?.full_name || 'Not assigned'}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => openEditModal(dept)}>
                  Edit
                </button>
                <button
                  className={`btn btn-sm ${dept.is_active ? 'btn-danger' : 'btn-success'}`}
                  onClick={() => toggleActive(dept)}>
                  {dept.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
