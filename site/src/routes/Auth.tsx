import { Link } from 'react-router-dom';
import { ArrowLeft } from '@/components/icons';
import { Button } from '@/components/ui/button';

const APP_URL = (import.meta.env.VITE_POOLSTATIS_APP_URL as string | undefined) ?? 'https://app.poolstatis.com';

function AuthShell({ mode }: { mode: 'login' | 'signup' }) {
  const title = mode === 'signup' ? 'Create your agent workspace' : 'Open your workspace';
  const copy = mode === 'signup'
    ? 'Hosted auth opens the admin, then onboarding creates your first project and MCP token.'
    : 'Continue to the hosted admin and sign in with your workspace identity.';
  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col">
      <header className="px-6 py-5">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="size-4" /> Back to home
        </Link>
      </header>
      <main className="flex-1 grid place-items-center px-6 py-8">
        <div className="w-full max-w-md">
          <div className="mb-7 flex items-center gap-2.5">
            <img className="size-8" src="/poolstatis-logo.svg" alt="" />
            <span className="text-lg font-bold tracking-tight">Poolstatis</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{copy}</p>
          <div className="mt-7 rounded-md border bg-card p-5">
            <div className="text-sm font-medium">Connect your MCP client after sign-in</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Start with Claude, Codex, Cursor, Warp, Windsurf, VS Code/Copilot, or another MCP host. Product and MCP access still use scoped Poolstatis keys, created after sign-in.
            </p>
            <Button asChild className="mt-5 h-10 w-full">
              <a href={APP_URL}>{mode === 'signup' ? 'Continue to onboarding' : 'Continue to app'}</a>
            </Button>
          </div>
          <p className="mt-5 text-center text-xs text-muted-foreground">
            Current price is $0. Future hosted billing will be usage-based and visible before enforcement.
          </p>
        </div>
      </main>
    </div>
  );
}

export function Login() {
  return <AuthShell mode="login" />;
}

export function Signup() {
  return <AuthShell mode="signup" />;
}
