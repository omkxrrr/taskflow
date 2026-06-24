'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import type { UserRole } from '@/types';

type RegistrationType = 'admin' | 'team_member';

interface RegisterForm {
  full_name: string;
  email: string;
  password: string;
  confirm_password: string;
}

const registrationOptions: Array<{
  value: RegistrationType;
  title: string;
  description: string;
  role: UserRole;
}> = [
  {
    value: 'team_member',
    title: 'Team Member Registration',
    description: 'For employees, associates, and team contributors',
    role: 'intern',
  },
  {
    value: 'admin',
    title: 'Admin Registration',
    description: 'For managers, mentors, and operations leads',
    role: 'admin',
  },
];

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();
  const [registrationType, setRegistrationType] = useState<RegistrationType>('team_member');
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, watch, formState: { errors } } = useForm<RegisterForm>();

  const selectedRole = registrationOptions.find(option => option.value === registrationType)?.role ?? 'intern';

  const onSubmit = async (data: RegisterForm) => {
    setLoading(true);

    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email.trim(),
      password: data.password,
      options: {
        data: {
          full_name: data.full_name.trim(),
          role: selectedRole,
        },
      },
    });

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success('Account created successfully!');

    if (authData.session) {
      router.push('/dashboard');
      return;
    }

    router.push('/auth/login');
  };

  return (
    <div className="auth-page">
      <div className="auth-card auth-card-wide">
        <div className="auth-logo">
          <div className="auth-logo-text">Task<em>Flow</em></div>
        </div>

        <div className="auth-title">Create your TaskFlow account</div>
        <div className="auth-subtitle">Choose your access type and enter your details.</div>

        <div className="auth-choice-grid">
          {registrationOptions.map(option => (
            <button
              key={option.value}
              type="button"
              className={`auth-choice ${registrationType === option.value ? 'active' : ''}`}
              onClick={() => setRegistrationType(option.value)}
            >
              <span>{option.title}</span>
              <small>{option.description}</small>
            </button>
          ))}
        </div>

        <form className="auth-form" onSubmit={handleSubmit(onSubmit)}>
          <div className="form-group">
            <label className="form-label">Full name</label>
            <input
              className="form-input"
              placeholder="Jane Doe"
              {...register('full_name', { required: 'Full name is required' })}
            />
            {errors.full_name && <span className="form-error">{errors.full_name.message}</span>}
          </div>

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
              placeholder="********"
              {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Min 6 characters' } })}
            />
            {errors.password && <span className="form-error">{errors.password.message}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Confirm password</label>
            <input
              type="password"
              className="form-input"
              placeholder="********"
              {...register('confirm_password', {
                required: 'Please confirm your password',
                validate: val => val === watch('password') || 'Passwords do not match',
              })}
            />
            {errors.confirm_password && <span className="form-error">{errors.confirm_password.message}</span>}
          </div>

          <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}>
            {loading ? <><span className="spinner" /> Creating account...</> : 'Create account'}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account? <Link href="/auth/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
