import type { Metadata } from 'next';
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
              <span className="brand__mark" aria-hidden="true">
                A
              </span>
              <span className="brand__name">Ally</span>
            </a>
            <div className="topbar__actions">
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
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
