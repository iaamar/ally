import type { Metadata } from 'next';
import { SkipLink } from '@/components/SkipLink';
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
    <html lang="en">
      <body>
        <SkipLink />
        <div className="app">
          <header className="topbar">
            <a className="brand" href="/">
              <span className="brand__mark" aria-hidden="true">
                A
              </span>
              <span className="brand__name">Ally</span>
              <span className="brand__tag">Accessibility</span>
            </a>
            <div className="topbar__actions">
              <form action="/auth/signout" method="post">
                <button type="submit" className="btn-ghost">
                  Sign out
                </button>
              </form>
            </div>
          </header>

          <div className="app__body">
            <aside className="sidebar">
              <nav aria-label="Primary" className="sidebar__nav">
                <p className="nav-eyebrow" id="nav-eyebrow">
                  Workspace
                </p>
                <a className="nav-link" href="/">
                  Projects
                </a>
                <a className="nav-link" href="/settings/keys">
                  API Keys
                </a>
              </nav>
              <p className="sidebar__note">
                Ally scans your app for WCAG 2.2 issues on every push.
              </p>
            </aside>

            <main id="main" className="content">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
