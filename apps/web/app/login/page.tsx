import { createClient } from '@/lib/supabase/server';
import { resolveSiteUrl } from '@/lib/site-url';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

function safeNextPath(value: string | undefined): string {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/';
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = safeNextPath(params.next);

  async function signIn(formData: FormData) {
    'use server';
    const email = formData.get('email') as string;
    const headersList = await headers();
    const forwardedHost = headersList.get('x-forwarded-host');
    const host = forwardedHost ?? headersList.get('host');
    const protocol = headersList.get('x-forwarded-proto') ?? 'http';
    const requestOrigin =
      headersList.get('origin') ?? (host ? `${protocol}://${host}` : undefined);
    const siteUrl = resolveSiteUrl(requestOrigin);

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      },
    });

    if (error) {
      redirect('/login?error=' + encodeURIComponent(error.message));
    }

    redirect(`/login?sent=1&next=${encodeURIComponent(nextPath)}`);
  }

  return (
    <section className="login-page">
      <div className="login-card">
        <div className="login-card__intro">
          <p className="page-kicker">Developer accessibility workspace</p>
          <h1>Build accessible software with a closed feedback loop.</h1>
          <p>Scan code, understand WCAG requirements, plan repairs, and verify every fix from the tools you already use.</p>
          <div className="login-card__signal" aria-hidden="true">
            <span>Scan</span><i /><span>Plan</span><i /><span>Verify</span>
          </div>
        </div>
        <div className="login-card__form">
          <span className="login-card__mark" aria-hidden="true">A</span>
          <h2>Sign in to Ally</h2>
          <p className="text-muted">
            We&rsquo;ll email you a secure magic link. No password required.
          </p>
        <LoginForm action={signIn} params={params} />
        </div>
      </div>
    </section>
  );
}

async function LoginForm({
  action,
  params,
}: {
  action: (formData: FormData) => Promise<void>;
  params: { sent?: string; error?: string };
}) {
  return (
    <>
      {params.sent && (
        <p role="status" className="notice" style={{ marginTop: 0 }}>
          Check your email for a sign-in link.
        </p>
      )}
      {params.error && (
        <p
          role="alert"
          className="notice"
          style={{ marginTop: 0, borderLeftColor: 'var(--bad)', color: 'var(--bad)' }}
        >
          {params.error}
        </p>
      )}
      <form action={action}>
        <div className="form-group">
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
          />
        </div>
        <button type="submit" className="btn-primary" style={{ width: '100%' }}>
          Send magic link
        </button>
      </form>
    </>
  );
}
