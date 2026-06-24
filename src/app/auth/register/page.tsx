'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import type { UserRole } from '@/types';

type RegistrationType = 'admin' | 'team_member';
type RegisterMethod = 'email' | 'phone';

interface RegisterForm {
  full_name: string;
  email: string;
  phone: string;
  otp: string;
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
  const [method, setMethod] = useState<RegisterMethod>('email');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const { register, handleSubmit, getValues, formState: { errors } } = useForm<RegisterForm>();

  const selectedRole = registrationOptions.find(option => option.value === registrationType)?.role ?? 'intern';

  const updateProfileAfterAuth = async (fullName: string, phone?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        role: selectedRole,
        ...(phone ? { phone } : {}),
      })
      .eq('id', user.id);
  };

  const handleGoogleRegister = async () => {
    setLoading(true);
    setStatusMessage(null);
    const role = selectedRole;
    const redirectTo = `${window.location.origin}/auth/callback?next=/dashboard&role=${role}`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      toast.error(error.message);
      setStatusMessage(error.message);
      setLoading(false);
    }
  };

  const onInvalidSubmit = () => {
    const message = 'Please fill all required fields correctly.';
    toast.error(message);
    setStatusMessage(message);
  };

  const switchMethod = (nextMethod: RegisterMethod) => {
    setMethod(nextMethod);
    setOtpSent(false);
    setStatusMessage(null);
  };

  const sendEmailOtp = async () => {
    const fullName = getValues('full_name')?.trim();
    const email = getValues('email')?.trim();

    if (!fullName) {
      toast.error('Full name is required');
      setStatusMessage('Full name is required');
      return;
    }

    if (!email) {
      toast.error('Email address is required');
      setStatusMessage('Email address is required');
      return;
    }

    setLoading(true);
    setStatusMessage('Sending email OTP...');

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard&role=${selectedRole}`,
          data: {
            full_name: fullName,
            role: selectedRole,
          },
        },
      });

      if (error) {
        toast.error(error.message);
        setStatusMessage(error.message);
        return;
      }

      setOtpSent(true);
      toast.success('OTP sent to your email address');
      setStatusMessage('OTP sent to your email address');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send email OTP.';
      toast.error(message);
      setStatusMessage(message);
    } finally {
      setLoading(false);
    }
  };

  const verifyEmailOtp = async () => {
    const fullName = getValues('full_name')?.trim();
    const email = getValues('email')?.trim();
    const otp = getValues('otp')?.trim();

    if (!email || !otp) {
      toast.error('Email address and OTP are required');
      setStatusMessage('Email address and OTP are required');
      return;
    }

    setLoading(true);
    setStatusMessage('Verifying email OTP...');

    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email',
      });

      if (error) {
        toast.error(error.message);
        setStatusMessage(error.message);
        return;
      }

      await updateProfileAfterAuth(fullName);
      toast.success('Registration complete');
      setStatusMessage('Registration complete');
      router.push('/dashboard');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Email OTP verification failed.';
      toast.error(message);
      setStatusMessage(message);
    } finally {
      setLoading(false);
    }
  };

  const sendPhoneOtp = async () => {
    const fullName = getValues('full_name')?.trim();
    const phone = getValues('phone')?.trim();

    if (!fullName) {
      toast.error('Full name is required');
      setStatusMessage('Full name is required');
      return;
    }

    if (!phone) {
      toast.error('Phone number is required');
      setStatusMessage('Phone number is required');
      return;
    }

    setLoading(true);
    setStatusMessage('Sending OTP...');

    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone,
        options: {
          data: {
            full_name: fullName,
            role: selectedRole,
            phone,
          },
        },
      });

      if (error) {
        toast.error(error.message);
        setStatusMessage(error.message);
        return;
      }

      setOtpSent(true);
      toast.success('OTP sent to your phone number');
      setStatusMessage('OTP sent to your phone number');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send OTP.';
      toast.error(message);
      setStatusMessage(message);
    } finally {
      setLoading(false);
    }
  };

  const verifyPhoneOtp = async () => {
    const fullName = getValues('full_name')?.trim();
    const phone = getValues('phone')?.trim();
    const otp = getValues('otp')?.trim();

    if (!phone || !otp) {
      toast.error('Phone number and OTP are required');
      setStatusMessage('Phone number and OTP are required');
      return;
    }

    setLoading(true);
    setStatusMessage('Verifying OTP...');

    try {
      const { error } = await supabase.auth.verifyOtp({
        phone,
        token: otp,
        type: 'sms',
      });

      if (error) {
        toast.error(error.message);
        setStatusMessage(error.message);
        return;
      }

      await updateProfileAfterAuth(fullName, phone);
      toast.success('Registration complete');
      setStatusMessage('Registration complete');
      router.push('/dashboard');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'OTP verification failed.';
      toast.error(message);
      setStatusMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card auth-card-wide">
        <div className="auth-logo">
          <div className="auth-logo-text">Task<em>Flow</em></div>
        </div>

        <div className="auth-title">Create your TaskFlow account</div>
        <div className="auth-subtitle">Choose your access type and register with email or phone OTP.</div>

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

        <button
          type="button"
          className="auth-google-button"
          onClick={handleGoogleRegister}
          disabled={loading}
        >
          <span className="auth-google-icon">G</span>
          Continue with Google
        </button>

        <div className="auth-divider"><span>or use OTP</span></div>

        <div className="auth-method-tabs" role="tablist" aria-label="Registration method">
          <button
            type="button"
            className={method === 'email' ? 'active' : ''}
            onClick={() => switchMethod('email')}
          >
            Email OTP
          </button>
          <button
            type="button"
            className={method === 'phone' ? 'active' : ''}
            onClick={() => switchMethod('phone')}
          >
            Phone OTP
          </button>
        </div>

        <form
          className="auth-form"
          onSubmit={handleSubmit(() => {
            if (method === 'email') return otpSent ? verifyEmailOtp() : sendEmailOtp();
            return otpSent ? verifyPhoneOtp() : sendPhoneOtp();
          }, onInvalidSubmit)}
          noValidate
        >
          <div className="form-group">
            <label className="form-label">Full name</label>
            <input
              className="form-input"
              placeholder="Jane Doe"
              {...register('full_name', { required: 'Full name is required' })}
            />
            {errors.full_name && <span className="form-error">{errors.full_name.message}</span>}
          </div>

          {method === 'email' ? (
            <div className="form-group">
              <label className="form-label">Email address</label>
              <input
                type="email"
                className="form-input"
                placeholder="you@example.com"
                {...register('email', { required: method === 'email' ? 'Email address is required' : false })}
              />
              {errors.email && <span className="form-error">{errors.email.message}</span>}
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">Phone number</label>
              <input
                type="tel"
                className="form-input"
                placeholder="+91 9876543210"
                {...register('phone', { required: method === 'phone' ? 'Phone number is required' : false })}
              />
              {errors.phone && <span className="form-error">{errors.phone.message}</span>}
            </div>
          )}

          {otpSent && (
            <div className="form-group">
              <label className="form-label">Enter OTP</label>
              <input
                className="form-input"
                inputMode="numeric"
                placeholder="6 digit OTP"
                {...register('otp', { required: otpSent ? 'OTP is required' : false })}
              />
              {errors.otp && <span className="form-error">{errors.otp.message}</span>}
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}>
            {loading ? (
              <><span className="spinner" /> {otpSent ? 'Verifying...' : 'Sending OTP...'}</>
            ) : otpSent ? (
              'Verify and register'
            ) : (
              method === 'email' ? 'Send Email OTP' : 'Send Phone OTP'
            )}
          </button>
        </form>

        {statusMessage && <div className="auth-status-message">{statusMessage}</div>}

        <div className="auth-footer">
          Already have an account? <Link href="/auth/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
