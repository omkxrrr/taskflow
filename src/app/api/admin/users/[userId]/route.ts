import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: authData, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !authData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: actor } = await adminClient
      .from('profiles')
      .select('role, is_active')
      .eq('id', authData.user.id)
      .single();

    if (!actor?.is_active || !['admin', 'super_admin'].includes(actor.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const superAdminFields = ['role', 'department_id', 'full_name'];
    const allowedFields = ['is_active', 'position', 'mentor_id', ...superAdminFields];
    const updates = Object.fromEntries(
      Object.entries(body).filter(([key]) => allowedFields.includes(key))
    );

    const includesSuperAdminOnlyField = Object.keys(updates).some(key => superAdminFields.includes(key));
    if (includesSuperAdminOnlyField && actor.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only super admin can edit role, department, or name' }, { status: 403 });
    }

    if (updates.role === 'super_admin') {
      return NextResponse.json({ error: 'Cannot assign super admin role from here' }, { status: 403 });
    }

    if (updates.role === 'admin') {
      updates.position = null;
      updates.mentor_id = null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const query = adminClient
      .from('profiles')
      .update(updates)
      .eq('id', params.userId)
      .neq('role', 'super_admin');

    const { error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Update user error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: authData, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !authData.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: actor } = await adminClient
      .from('profiles')
      .select('role, is_active')
      .eq('id', authData.user.id)
      .single();

    if (!actor?.is_active || actor.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only super admin can delete team members' }, { status: 403 });
    }

    if (params.userId === authData.user.id) {
      return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 403 });
    }

    const { data: target } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', params.userId)
      .single();

    if (!target || target.role === 'super_admin') {
      return NextResponse.json({ error: 'Cannot delete this account' }, { status: 403 });
    }

    const { error } = await adminClient.auth.admin.deleteUser(params.userId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete user error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
