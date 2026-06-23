import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, GithubIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** Dark, brand-consistent shell for the auth pages. No DB yet — forms are UI-only. */
function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col">
      <header className="px-6 py-5">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="size-4" /> Back to home
        </Link>
      </header>
      <main className="flex-1 grid place-items-center px-6 py-8">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2.5 mb-7">
            <img className="size-8" src="/poolstatis-logo.svg" alt="" />
            <span className="text-lg font-bold tracking-tight">Poolstatis</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-7">{children}</div>
        </div>
      </main>
    </div>
  );
}

const GLOW =
  'pointer-events-none fixed left-1/2 top-0 -z-10 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(205,250,79,0.10),transparent_70%)]';

function OAuthRow() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Button variant="outline" type="button" className="h-10" disabled>
        <GithubIcon className="size-4" /> GitHub
      </Button>
      <Button variant="outline" type="button" className="h-10" disabled>
        <span className="font-display font-bold">G</span> Google
      </Button>
    </div>
  );
}

function Divider() {
  return (
    <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
    </div>
  );
}

/** Shown after submit — accounts aren't wired to a backend yet. */
function Notice() {
  return (
    <div className="mt-4 rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
      Accounts aren’t live yet — Poolstatis is in early access. We saved your interest; meanwhile you
      can <Link to="/docs" className="text-primary hover:underline">read the docs</Link> and self-host today.
    </div>
  );
}

export function Login() {
  const [done, setDone] = useState(false);
  const onSubmit = (e: FormEvent) => { e.preventDefault(); setDone(true); };
  return (
    <>
      <div className={GLOW} />
      <AuthShell title="Welcome back" subtitle="Log in to your Poolstatis workspace.">
        <OAuthRow />
        <Divider />
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@company.com" autoComplete="email" required />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <span className="text-xs text-muted-foreground">Forgot?</span>
            </div>
            <Input id="password" type="password" placeholder="••••••••" autoComplete="current-password" required />
          </div>
          <Button type="submit" className="h-10 w-full">Log in</Button>
        </form>
        {done && <Notice />}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          New here? <Link to="/signup" className="text-primary hover:underline">Create an account</Link>
        </p>
      </AuthShell>
    </>
  );
}

export function Signup() {
  const [done, setDone] = useState(false);
  const onSubmit = (e: FormEvent) => { e.preventDefault(); setDone(true); };
  return (
    <>
      <div className={GLOW} />
      <AuthShell title="Connect your agent" subtitle="Create a workspace and point your coding agent at it.">
        <OAuthRow />
        <Divider />
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" type="text" placeholder="Ada Lovelace" autoComplete="name" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Work email</Label>
            <Input id="email" type="email" placeholder="you@company.com" autoComplete="email" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" placeholder="At least 8 characters" autoComplete="new-password" minLength={8} required />
          </div>
          <Button type="submit" className="h-10 w-full">Create workspace</Button>
        </form>
        {done && <Notice />}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account? <Link to="/login" className="text-primary hover:underline">Log in</Link>
        </p>
        <p className="mt-4 text-center text-xs text-muted-foreground/70">
          By continuing you agree to the Terms and Privacy Policy.
        </p>
      </AuthShell>
    </>
  );
}
