import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
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

    const { data: profile } = await adminClient
      .from('profiles')
      .select('role, is_active')
      .eq('id', authData.user.id)
      .single();

    if (!profile?.is_active || !['admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
const { full_name, email, password, role, department_id, position, mentor_id } = body;

    if (role === 'admin' && profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only super admin can create admins' }, { status: 403 });
    }

    // Create auth user
    const { data: newUser, error: createAuthError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role },
    });

    if (createAuthError || !newUser.user) {
      return NextResponse.json({ error: createAuthError?.message || 'Failed to create user' }, { status: 400 });
    }

    // Manually create profile
    // Manually create profile
const { error: profileError } = await adminClient
  .from('profiles')
  .insert({
    id: newUser.user.id,
    email: email,
    full_name: full_name,
    role: role || 'intern',
    department_id: department_id || null,
    position: role === 'intern' ? position || null : null,
    mentor_id: role === 'intern' ? mentor_id || null : null,
    is_active: true,
  });

    if (profileError) {
      console.error('Profile error:', profileError);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
