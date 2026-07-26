import type { Metadata } from 'next';
import { AllyMark } from '@/components/AllyMark';
import { SkipLink } from '@/components/SkipLink';
import { AllyChatPanel } from '@/components/AllyChatPanel';
import { Sidebar } from '@/components/Sidebar';
import { ThemeToggle, THEME_INIT_SCRIPT } from '@/components/ThemeToggle';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ally Dashboard',
  description: 'Accessibility scanning dashboard',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
              <form action="/auth/signout" method="post">
                <button type="submit" className="btn-ghost">
                  Sign out
                </button>
              </form>
            </div>
          </header>

          <div className="app__body">
            <Sidebar />

            <main id="main" className="content">
              {children}
              <footer className="site-footer">
                © 2026{' '}
                <a href="https://easyas.company/" target="_blank" rel="noreferrer">
                  Easy Alliance
                </a>
                . All rights reserved.
              </footer>
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
