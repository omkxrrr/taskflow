import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: 'TaskFlow - Team Task Manager',
  description: 'Manage intern tasks with role-based workflows',
  applicationName: 'TaskFlow',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1e2336',
              color: '#f0f2f8',
              border: '1px solid #2a3044',
              fontSize: '13px',
            },
            success: { iconTheme: { primary: '#22c55e', secondary: '#1e2336' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#1e2336' } },
          }}
        />
      </body>
    </html>
  );
}
