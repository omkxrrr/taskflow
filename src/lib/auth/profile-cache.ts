'use client';

let currentProfilePromise: Promise<{ session: any; profile: any }> | null = null;

export function getCurrentProfile(supabase: any): Promise<{ session: any; profile: any }> {
  if (!currentProfilePromise) {
    currentProfilePromise = supabase.auth.getSession().then(async ({ data: { session } }: any) => {
      if (!session) return { session: null, profile: null };

      const { data: profile } = await supabase
        .from('profiles')
        .select('*, department:departments!profiles_department_id_fkey(name)')
        .eq('id', session.user.id)
        .single();

      return {
        session,
        profile: profile || {
          id: session.user.id,
          email: session.user.email,
          full_name: session.user.user_metadata?.full_name || session.user.email || 'User',
          role: session.user.user_metadata?.role || 'intern',
          is_active: true,
          department: null,
        },
      };
    });
  }

  return currentProfilePromise as Promise<{ session: any; profile: any }>;
}

export function clearCurrentProfileCache() {
  currentProfilePromise = null;
}
