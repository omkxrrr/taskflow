'use client';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { INACTIVE_ACCOUNT_MESSAGE } from '@/lib/auth/inactive-user';

interface LoginForm {
  email: string;
  password: string;
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();
  const supabase = createClient();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    if (error) toast.error(error);
  }, []);

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_active')
      .eq('id', authData.user.id)
      .single();

    if (profile?.is_active === false) {
      await supabase.auth.signOut();
      toast.error(INACTIVE_ACCOUNT_MESSAGE);
      setLoading(false);
      return;
    }

    console.log('Session:', authData.session);
    toast.success('Welcome back!');
    
    // Force hard redirect
    setTimeout(() => {
      window.location.replace('/dashboard');
    }, 1000);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-text">Task<em>Flow</em></div>
        </div>

        <div className="auth-title">Sign in to your account</div>
        <div className="auth-subtitle">Enter your credentials to continue</div>

        <form className="auth-form" onSubmit={handleSubmit(onSubmit)}>
          <div className="form-group">
            <label className="form-label">Email address</label>
            <input
              type="email"
              className="form-input"
              placeholder="you@example.com"
              {...register('email', { required: 'Email is required' })}
            />
            {errors.email && <span className="form-error">{errors.email.message}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              {...register('password', { required: 'Password is required' })}
            />
            {errors.password && <span className="form-error">{errors.password.message}</span>}
          </div>

          <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
