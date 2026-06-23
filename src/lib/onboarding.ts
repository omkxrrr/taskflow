export async function completeOnboardingTrigger(supabase: any, userId: string, triggerType: string) {
  if (!userId || !triggerType) return;

  const { data: templates } = await supabase
    .from('onboarding_templates')
    .select('id')
    .eq('is_active', true)
    .eq('trigger_type', triggerType);

  const rows = (templates || []).map((template: any) => ({
    intern_id: userId,
    template_id: template.id,
    completed_by: userId,
    completed_at: new Date().toISOString(),
  }));

  if (rows.length === 0) return;

  await supabase
    .from('onboarding_progress')
    .upsert(rows, { onConflict: 'intern_id,template_id' });
}
