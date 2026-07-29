import type { Metadata } from 'next';
import { AllyMark } from '@/components/AllyMark';
import { SkipLink } from '@/components/SkipLink';
import { AllyChatPanel } from '@/components/AllyChatPanel';
import { Sidebar } from '@/components/Sidebar';
import { ThemeToggle, THEME_INIT_SCRIPT } from '@/components/ThemeToggle';
import { createClient } from '@/lib/supabase/server';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ally Dashboard',
  description: 'Accessibility scanning dashboard',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      {
        url: '/ally-mcp-icon.png',
        type: 'image/png',
        sizes: '256x256',
      },
    ],
    shortcut: '/favicon.ico',
    apple: {
      url: '/ally-mcp-icon.png',
      type: 'image/png',
      sizes: '256x256',
    },
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <SkipLink />
        <div className="app">
          <header className="topbar">
            <a className="brand" href="/">
              <AllyMark />
              <span className="brand__name">Ally</span>
            </a>
            <div className="topbar__actions">
              <a className="header-docs-link" href="/docs">
                Docs
              </a>
              <ThemeToggle />
              <AllyChatPanel />
              {user ? (
                <form action="/auth/signout" method="post">
                  <button type="submit" className="btn-ghost">
                    Sign out
                  </button>
                </form>
              ) : (
                <a className="btn-ghost header-auth-link" href="/login">
                  Sign in
                </a>
              )}
            </div>
          </header>

          <div className="app__body">
            <Sidebar />

            <main id="main" className="content">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
