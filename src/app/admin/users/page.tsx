'use client';
import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';

const INTERN_POSITIONS = [
  { value: 'jr_volunteer', label: 'Jr Volunteer' },
  { value: 'sr_volunteer', label: 'Sr Volunteer' },
  { value: 'executive', label: 'Executive' },
  { value: 'manager', label: 'Manager' },
  { value: 'assistant_director', label: 'Assistant Director' },
  { value: 'director', label: 'Director' },
  { value: 'co_founder', label: 'Co Founder' },
  { value: 'founder', label: 'Founder' },
];

const getPositionLabel = (value?: string | null) => {
  return INTERN_POSITIONS.find(position => position.value === value)?.label || 'Not assigned';
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState('admin');
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [departments, setDepartments] = useState<any[]>([]);

  const form = useForm<any>({ defaultValues: { role: 'intern' } });
  const supabase = createClient();
  const selectedRole = form.watch('role');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: myProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();
    if (myProfile) setCurrentUserRole(myProfile.role);

    const { data: deptData } = await supabase.from('departments').select('*').eq('is_active', true);
setDepartments(deptData || []);

    const res = await fetch('/api/admin/users', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const result = await res.json();
    if (!res.ok) {
      toast.error(result.error || 'Failed to load users');
      setUsers([]);
      setLoading(false);
      return;
    }
    setUsers(result.users || []);
    setLoading(false);
  }, []);

  const mentors = users.filter((u: any) => ['admin', 'super_admin'].includes(u.role) && u.is_active);
  const getMentorName = (mentorId?: string | null) => {
    return mentors.find((mentor: any) => mentor.id === mentorId)?.full_name || 'No mentor';
  };

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const createUser = async (data: any) => {
    setCreating(true);
    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
      },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) {
      toast.error(result.error || 'Failed to create user');
    } else {
      toast.success(`${data.role === 'admin' ? 'Admin' : 'Intern'} created!`);
      setShowModal(false);
      form.reset({ role: 'intern', position: '', mentor_id: '' });
      fetchUsers();
    }
    setCreating(false);
  };

  const openEditUser = (user: any) => {
    setEditUser(user);
    form.reset({
      full_name: user.full_name || '',
      role: user.role || 'intern',
      department_id: user.department_id || '',
      position: user.position || '',
      mentor_id: user.mentor_id || '',
    });
  };

  const saveEditedUser = async (data: any) => {
    if (!editUser) return;
    await updateUser(editUser.id, {
      full_name: data.full_name,
      role: data.role,
      department_id: data.department_id || null,
      position: data.role === 'intern' ? data.position || null : null,
      mentor_id: data.role === 'intern' ? data.mentor_id || null : null,
    }, 'Team member updated');
    setEditUser(null);
    form.reset({ role: 'intern', position: '', mentor_id: '' });
  };

  const toggleActive = async (userId: string, currentStatus: boolean) => {
    await updateUser(userId, { is_active: !currentStatus }, currentStatus ? 'User deactivated' : 'User activated');
  };

  const changeRole = async (user: any, role: 'admin' | 'intern') => {
    const action = role === 'admin' ? 'make this user an admin' : 'remove admin access from this user';
    if (!window.confirm(`Are you sure you want to ${action}?`)) return;

    await updateUser(
      user.id,
      {
        role,
        position: role === 'intern' ? user.position || null : null,
        mentor_id: role === 'intern' ? user.mentor_id || null : null,
      },
      role === 'admin' ? 'User promoted to admin' : 'Admin access removed'
    );
  };

  const updateUser = async (userId: string, updates: any, successMessage: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify(updates),
    });
    const result = await res.json();

    if (!res.ok) {
      toast.error(result.error || 'Failed to update');
    } else {
      toast.success(successMessage);
      fetchUsers();
    }
  };

  const deleteUser = async (user: any) => {
    if (!window.confirm(`Delete ${user.full_name}? This will permanently remove their account.`)) return;

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    const result = await res.json();

    if (!res.ok) {
      toast.error(result.error || 'Failed to delete user');
    } else {
      toast.success('Team member deleted');
      fetchUsers();
    }
  };

 const filtered = users.filter(u => {
  const matchRole = filter === 'all' || u.role === filter;
  const matchSearch = searchQuery === '' ||
    u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase());
  return matchRole && matchSearch;
});

  return (
    <>
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Add Team Member</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={form.handleSubmit(createUser)}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input className="form-input" placeholder="Jane Doe"
                    {...form.register('full_name', { required: true })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input type="email" className="form-input" placeholder="jane@example.com"
                    {...form.register('email', { required: true })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Password *</label>
                  <input type="password" className="form-input" placeholder="Min 6 characters"
                    {...form.register('password', { required: true, minLength: 6 })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select className="form-select" {...form.register('role')}>
                    <option value="intern">Intern</option>
                    {currentUserRole === 'super_admin' && (
                      <option value="admin">Admin</option>
                    )}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <select className="form-select" {...form.register('department_id')}>
                    <option value="">No department</option>
                    {departments.map((d: any) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                {selectedRole === 'intern' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Position</label>
                      <select className="form-select" {...form.register('position')}>
                        <option value="">Select position...</option>
                        {INTERN_POSITIONS.map(position => (
                          <option key={position.value} value={position.value}>{position.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Mentor</label>
                      <select className="form-select" {...form.register('mentor_id')}>
                        <option value="">No mentor assigned</option>
                        {mentors.map((mentor: any) => (
                          <option key={mentor.id} value={mentor.id}>
                            {mentor.full_name || mentor.email || 'Mentor'} ({(mentor.role || 'admin').replace('_', ' ')})
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary"
                  onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editUser && currentUserRole === 'super_admin' && (
        <div className="modal-overlay" onClick={() => setEditUser(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Edit Team Member</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditUser(null)}>x</button>
            </div>
            <form onSubmit={form.handleSubmit(saveEditedUser)}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input className="form-input" {...form.register('full_name', { required: true })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select className="form-select" {...form.register('role')}>
                    <option value="intern">Intern</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <select className="form-select" {...form.register('department_id')}>
                    <option value="">No department</option>
                    {departments.map((d: any) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                {selectedRole === 'intern' && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Position</label>
                      <select className="form-select" {...form.register('position')}>
                        <option value="">Select position...</option>
                        {INTERN_POSITIONS.map(position => (
                          <option key={position.value} value={position.value}>{position.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Mentor</label>
                      <select className="form-select" {...form.register('mentor_id')}>
                        <option value="">No mentor assigned</option>
                        {mentors
                          .filter((mentor: any) => mentor.id !== editUser.id)
                          .map((mentor: any) => (
                            <option key={mentor.id} value={mentor.id}>
                              {mentor.full_name || mentor.email || 'Mentor'} ({(mentor.role || 'admin').replace('_', ' ')})
                            </option>
                          ))}
                      </select>
                    </div>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditUser(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div className="page-title">Team Members</div>
          <div className="page-subtitle">Manage admins and interns</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Add Member
        </button>
      </div>
<div style={{ marginBottom: 12 }}>
  <input
    className="form-input"
    placeholder="🔍 Search by name or email..."
    value={searchQuery}
    onChange={e => setSearchQuery(e.target.value)}
    style={{ maxWidth: 400 }}
  />
</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['all', 'intern', 'admin', 'super_admin'].map(f => (
          <button key={f}
            onClick={() => setFilter(f)}
            className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}>
            {f === 'all' ? 'All' : f.replace('_', ' ')}
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
            <div className="empty-state-icon">👥</div>
            <div className="empty-state-text">No team members found</div>
            <div className="empty-state-sub">Add your first team member!</div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
<th>Email</th>
<th>Department</th>
<th>Role</th>
<th>Position</th>
<th>Mentor</th>
<th>Status</th>
<th>Joined</th>
<th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user: any) => (
                  <tr key={user.id}>
                    <td style={{ fontWeight: 500 }}>{user.full_name}</td>
<td style={{ color: 'var(--text-2)' }}>{user.email}</td>
<td style={{ color: 'var(--text-2)' }}>
  {departments.find((d: any) => d.id === user.department_id)?.name || '—'}
</td>
<td>
  <span className={`badge badge-${user.role}`}>
                        {(user.role || 'intern').replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      {user.role === 'intern' ? (
                        currentUserRole === 'super_admin' ? (
                          <select
                            className="form-select"
                            value={user.position || ''}
                            onChange={e => updateUser(user.id, { position: e.target.value || null }, 'Position updated')}
                            style={{ minWidth: 150 }}>
                            <option value="">Not assigned</option>
                            {INTERN_POSITIONS.map(position => (
                              <option key={position.value} value={position.value}>{position.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span style={{ color: 'var(--text-2)' }}>{getPositionLabel(user.position)}</span>
                        )
                      ) : (
                        <span style={{ color: 'var(--text-3)' }}>-</span>
                      )}
                    </td>
                    <td>
                      {user.role === 'intern' ? (
                        currentUserRole === 'super_admin' ? (
                          <select
                            className="form-select"
                            value={user.mentor_id || ''}
                            onChange={e => updateUser(user.id, { mentor_id: e.target.value || null }, 'Mentor updated')}
                            style={{ minWidth: 170 }}>
                            <option value="">No mentor</option>
                            {mentors.map((mentor: any) => (
                              <option key={mentor.id} value={mentor.id}>{mentor.full_name}</option>
                            ))}
                          </select>
                        ) : (
                          <span style={{ color: 'var(--text-2)' }}>{getMentorName(user.mentor_id)}</span>
                        )
                      ) : (
                        <span style={{ color: 'var(--text-3)' }}>-</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${user.is_active ? 'badge-approved' : 'badge-rejected'}`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-2)' }}>
                      {format(new Date(user.created_at), 'MMM d, yyyy')}
                    </td>
                    <td>
                      {currentUserRole === 'super_admin' && user.role !== 'super_admin' && (
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ marginRight: 6 }}
                          onClick={() => openEditUser(user)}>
                          Edit
                        </button>
                      )}
                      {currentUserRole === 'super_admin' && user.role === 'intern' && (
                        <button
                          className="btn btn-success btn-sm"
                          style={{ marginRight: 6 }}
                          onClick={() => changeRole(user, 'admin')}>
                          Make Admin
                        </button>
                      )}
                      {currentUserRole === 'super_admin' && user.role === 'admin' && (
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ marginRight: 6 }}
                          onClick={() => changeRole(user, 'intern')}>
                          Remove Admin
                        </button>
                      )}
                      {user.role !== 'super_admin' && (
                        <button
                          className={`btn btn-sm ${user.is_active ? 'btn-danger' : 'btn-success'}`}
                          onClick={() => toggleActive(user.id, user.is_active)}>
                          {user.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                      {currentUserRole === 'super_admin' && user.role !== 'super_admin' && (
                        <button
                          className="btn btn-danger btn-sm"
                          style={{ marginLeft: 6 }}
                          onClick={() => deleteUser(user)}>
                          Delete
                        </button>
                      )}
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
