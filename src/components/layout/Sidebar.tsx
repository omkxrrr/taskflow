'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/types';
import { useState as useThemeState, useEffect as useThemeEffect } from 'react';
import NotificationBell from '@/components/notifications/NotificationBell';

interface SidebarProps {
  profile: Profile;
}

const IconDashboard = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
);
const IconTasks = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
  </svg>
);
const IconPerformance = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
);

const IconUsers = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
  </svg>
);
const IconDepartments = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>
  </svg>
);
const IconMeetings = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
);
const IconUpdates = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const IconReports = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
);
const IconAttendance = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 00-3-3.87"/>
    <path d="M16 3.13a4 4 0 010 7.75"/>
    <polyline points="9 11 11 13 15 9" stroke="var(--success)"/>
  </svg>
);
const IconWarnings = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const IconEvents = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);
const IconLeave = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
    <path d="M8 15h4"/>
    <path d="M8 18h8"/>
  </svg>
);
const IconChat = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a4 4 0 01-4 4H8l-5 3V7a4 4 0 014-4h10a4 4 0 014 4z"/>
    <path d="M8 9h8"/>
    <path d="M8 13h5"/>
  </svg>
);
const IconOnboarding = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l2 2 4-4"/>
    <path d="M21 12a9 9 0 11-9-9"/>
    <path d="M21 3v6h-6"/>
  </svg>
);

const IconLogout = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);
const IconSun = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);
const IconMoon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
  </svg>
);
const IconAllTasks = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
    <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
);


export default function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const saved = localStorage.getItem('taskflow-theme') as 'dark' | 'light' | null;
    const initial = saved || 'dark';
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('taskflow-theme', newTheme);
  };

  const isAdmin = ['admin', 'super_admin'].includes(profile.role);
  const reportsHref = isAdmin ? '/admin/reports' : '/reports';

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Signed out');
    router.push('/auth/login');
    router.refresh();
  };

  const initials = profile.full_name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span>Task<em>Flow</em></span>
        <NotificationBell userId={profile.id} />
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">
          <div className="nav-label">General</div>
          <Link href="/dashboard" className={`nav-link ${pathname === '/dashboard' ? 'active' : ''}`}>
            <IconDashboard /> Dashboard
          </Link>
          {profile.role !== 'super_admin' && (
            <Link href="/tasks" className={`nav-link ${pathname.startsWith('/tasks') ? 'active' : ''}`}>
              <IconTasks /> My Tasks
            </Link>
          )}
          <Link href="/meetings" className={`nav-link ${pathname.startsWith('/meetings') ? 'active' : ''}`}>
          <IconMeetings /> Meetings
          </Link>
          <Link href="/chat" className={`nav-link ${pathname.startsWith('/chat') ? 'active' : ''}`}>
            <IconChat /> Chat
          </Link>
          <Link href="/onboarding" className={`nav-link ${pathname.startsWith('/onboarding') ? 'active' : ''}`}>
            <IconOnboarding /> Onboarding
          </Link>
          <Link href="/updates" className={`nav-link ${pathname.startsWith('/updates') ? 'active' : ''}`}>
          <IconUpdates /> Daily Updates
          </Link>
        </div>

        {isAdmin && (
          <div className="nav-section">
            <div className="nav-label">Admin</div>
            <Link href="/admin/tasks" className={`nav-link ${pathname.startsWith('/admin/tasks') ? 'active' : ''}`}>
              <IconAllTasks /> All Tasks
            </Link>
            <Link href="/admin/departments" className={`nav-link ${pathname.startsWith('/admin/departments') ? 'active' : ''}`}>
  <IconDepartments /> Departments
</Link>
            <Link href="/admin/users" className={`nav-link ${pathname.startsWith('/admin/users') ? 'active' : ''}`}>
              <IconUsers /> Team Members
            </Link>
            <Link href="/admin/performance" className={`nav-link ${pathname.startsWith('/admin/performance') ? 'active' : ''}`}>
  <IconPerformance /> Performance
</Link>
          </div>
        )}
        <Link href={reportsHref} className={`nav-link ${pathname.startsWith(reportsHref) ? 'active' : ''}`}>
  <IconReports /> Reports
</Link>

<Link href="/attendance" className={`nav-link ${pathname.startsWith('/attendance') ? 'active' : ''}`}>
  <IconAttendance /> Attendance
</Link>

<Link href="/leave" className={`nav-link ${pathname.startsWith('/leave') ? 'active' : ''}`}>
  <IconLeave /> Leave Requests
</Link>

<Link href="/warnings" className={`nav-link ${pathname.startsWith('/warnings') ? 'active' : ''}`}>
  <IconWarnings /> Warnings
</Link>

<Link href="/events" className={`nav-link ${pathname.startsWith('/events') ? 'active' : ''}`}>
  <IconEvents /> Events
</Link>


      </nav>

      <div className="sidebar-footer">
        <div className="user-card">
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <div className="user-name">{profile.full_name}</div>
            <div className="user-role">{profile.role.replace('_', ' ')}</div>
          </div>
        </div>
        <button onClick={toggleTheme} className="nav-link" style={{ marginBottom: 4 }}>
  {theme === 'dark' ? <IconSun /> : <IconMoon />}
  {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
</button>
        <button onClick={handleLogout} className="nav-link" style={{ marginTop: 4 }}>
          <IconLogout /> Sign out
        </button>
      </div>
    </aside>
  );
}
