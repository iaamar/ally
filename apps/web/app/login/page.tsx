import { createClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  async function signIn(formData: FormData) {
    'use server';
    const email = formData.get('email') as string;
    const headersList = await headers();
    const origin = headersList.get('origin') ?? '';

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: origin + '/auth/callback',
      },
    });

    if (error) {
      redirect('/login?error=' + encodeURIComponent(error.message));
    }

    redirect('/login?sent=1');
  }

  return (
    <section>
      <h1>Sign in to Ally</h1>
      <LoginForm action={signIn} searchParams={searchParams} />
    </section>
  );
}

async function LoginForm({
  action,
  searchParams,
}: {
  action: (formData: FormData) => Promise<void>;
  searchParams: Promise<{ sent?: string }>;
}) {
  const params = await searchParams;
  return (
    <>
      {params.sent && (
        <p role="status">Check your email for a sign-in link.</p>
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
        <button type="submit">Send magic link</button>
      </form>
    </>
  );
}
