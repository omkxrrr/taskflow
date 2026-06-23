export const INACTIVE_ACCOUNT_MESSAGE =
  'Your account is deactivated. Please contact your admin.';

export async function signOutInactiveUser(supabase: any, profile: any) {
  if (profile?.is_active === false) {
    await supabase.auth.signOut();
    window.location.href = `/auth/login?error=${encodeURIComponent(INACTIVE_ACCOUNT_MESSAGE)}`;
    return true;
  }

  return false;
}
