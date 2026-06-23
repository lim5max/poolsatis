import { useState } from 'react';
import { motion } from 'motion/react';
import { Loader2 } from '@/components/icons';
import { useStore } from '../store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function Connect() {
  const { connect } = useStore();
  const [baseUrl, setBaseUrl] = useState('');
  const [token, setToken] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try { await connect({ baseUrl: baseUrl.replace(/\/$/, ''), token: token.trim() }); }
    catch (ex) { setErr((ex as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: 'easeOut' }} className="w-full max-w-md">
        <Card>
          <CardContent className="p-8">
            <div className="flex items-center gap-2.5 mb-4">
              <img className="size-6" src="/poolstatis-logo.svg" alt="" />
              <span className="text-xs font-medium text-muted-foreground">Poolstatis · Admin</span>
            </div>
            <h1 className="serif text-3xl">Connect the instrument.</h1>
            <p className="text-muted-foreground mt-2 mb-6 text-sm">Admin console for the headless platform. Paste a personal token (<code>pt_</code>, all projects) or a project secret key (<code>sk_</code>).</p>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Server base URL <span className="opacity-60">(blank = dev proxy)</span></Label>
                <Input placeholder="http://127.0.0.1:3300" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Token</Label>
                <Input type="password" placeholder="sk_… or pt_…" value={token} onChange={(e) => setToken(e.target.value)} autoFocus />
              </div>
              <Button type="submit" className="w-full" disabled={busy || !token}>{busy ? <Loader2 className="size-4 animate-spin" /> : 'Connect'}</Button>
              {err && <div className="text-destructive text-xs">⚠ {err}</div>}
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
