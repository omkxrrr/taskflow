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

    const body = await request.json();
    const { submission_note, submission_url } = body;

    if (!submission_note) {
      return NextResponse.json({ error: 'Submission note is required' }, { status: 400 });
    }

    // Verify the task belongs to this user and is still pending
    const { data: task } = await supabase
      .from('tasks')
      .select('id, status, assigned_to')
      .eq('id', params.taskId)
      .single();

    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    if (task.assigned_to !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (task.status !== 'pending') {
      return NextResponse.json({ error: 'Only pending tasks can be submitted' }, { status: 400 });
    }

    const { data: updated, error } = await supabase
      .from('tasks')
      .update({
        status: 'submitted',
        submission_note,
        submission_url: submission_url || null,
        submitted_at: new Date().toISOString(),
      })
      .eq('id', params.taskId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ task: updated });
  } catch (err) {
    console.error('Submit task error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
