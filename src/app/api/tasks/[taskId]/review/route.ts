import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
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
      return NextResponse.json({ error: 'Only admins can review tasks' }, { status: 403 });
    }

    const body = await request.json();
    const { action, review_note } = body;

    if (!['approved', 'rejected'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be approved or rejected' }, { status: 400 });
    }

    // Verify task exists and is submitted
    const { data: task } = await supabase
      .from('tasks')
      .select('id, status')
      .eq('id', params.taskId)
      .single();

    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    if (task.status !== 'submitted') {
      return NextResponse.json({ error: 'Only submitted tasks can be reviewed' }, { status: 400 });
    }

    const { data: updated, error } = await supabase
      .from('tasks')
      .update({
        status: action,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_note: review_note || null,
      })
      .eq('id', params.taskId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ task: updated });
  } catch (err) {
    console.error('Review task error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
