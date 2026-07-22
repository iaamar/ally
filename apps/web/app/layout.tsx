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
        <header>
          <strong>Ally</strong>
          <nav aria-label="Main navigation">
            <a href="/">Projects</a>
            <a href="/keys">API Keys</a>
            <form action="/auth/signout" method="post" style={{ display: 'inline' }}>
              <button type="submit">Sign out</button>
            </form>
          </nav>
        </header>
        <main id="main">{children}</main>
      </body>
    </html>
  );
}
