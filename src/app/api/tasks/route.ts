import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/tasks — fetch tasks
// ?all=true fetches all tasks (admin only), otherwise just the current user's
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const allTasks = request.nextUrl.searchParams.get('all') === 'true';
    const isAdmin = ['admin', 'super_admin'].includes(profile.role);

    // Build query with join for assigned user name
    let query = supabase
      .from('tasks')
      .select(`
        *,
        assigned_profile:profiles!tasks_assigned_to_fkey(full_name, email),
        created_profile:profiles!tasks_created_by_fkey(full_name),
        reviewed_profile:profiles!tasks_reviewed_by_fkey(full_name)
      `)
      .order('created_at', { ascending: false });

    if (!isAdmin || !allTasks) {
      query = query.eq('assigned_to', user.id);
    }

    const { data: tasks, error } = await query;
    if (error) throw error;

    // Flatten join fields
    const flat = (tasks || []).map((t: any) => ({
      ...t,
      assigned_to_name: t.assigned_profile?.full_name ?? null,
      assigned_to_email: t.assigned_profile?.email ?? null,
      created_by_name: t.created_profile?.full_name ?? null,
      reviewed_by_name: t.reviewed_profile?.full_name ?? null,
      assigned_profile: undefined,
      created_profile: undefined,
      reviewed_profile: undefined,
    }));

    return NextResponse.json({ tasks: flat });
  } catch (err) {
    console.error('GET tasks error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/tasks — create task (admin only)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Only admins can create tasks' }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, priority, due_date, assigned_to } = body;

    if (!title || !assigned_to) {
      return NextResponse.json({ error: 'Title and assigned_to are required' }, { status: 400 });
    }

    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        title,
        description: description || null,
        priority: priority || 'medium',
        due_date: due_date || null,
        assigned_to,
        created_by: user.id,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ task });
  } catch (err) {
    console.error('POST task error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
