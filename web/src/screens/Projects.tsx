import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from '@/components/icons';
import { useStore } from '../store';
import { Panel, EmptyState, ErrorNote, fmtNum } from '../components/ui';
import { Onboarding } from './Onboarding';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function Projects() {
  const { projects, project, setProject, tokenKind, client, refreshProjects } = useStore();
  const nav = useNavigate();
  const canCreate = tokenKind === 'personal' || tokenKind === 'secret';
  const open = (slug: string) => { setProject(slug); nav('/registry'); };

  if (tokenKind === 'user' && projects.length === 0) return <Onboarding />;

  return (
    <div className="space-y-4">
      <Panel
        title={<>Projects <span className="font-sans text-muted-foreground text-sm font-normal ml-2">{projects.length} in this {tokenKind === 'secret' ? 'key scope' : 'org'}</span></>}
        right={tokenKind === 'secret' ? <span className="text-xs text-muted-foreground">secret key — scoped to one project</span> : null}
      >
        {projects.length === 0 ? <EmptyState headline="No projects" lead="create one below, or bootstrap via the CLI" /> : (
          <Table>
            <TableHeader>
              <TableRow><TableHead>Project</TableHead><TableHead>Timezone</TableHead><TableHead className="text-right">Active metrics</TableHead><TableHead className="text-right">Funnels</TableHead><TableHead className="text-right">Events · 30d</TableHead><TableHead /></TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((p) => (
                <TableRow key={p.slug} className="cursor-pointer" onClick={() => open(p.slug)}>
                  <TableCell><div className="font-medium flex items-center gap-2">{p.name}{p.slug === project && <Badge className="text-xs">selected</Badge>}</div><div className="text-xs text-muted-foreground">{p.slug}</div></TableCell>
                  <TableCell className="text-muted-foreground">{p.timezone}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.active_metrics}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.funnels}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtNum(p.events_30d)}</TableCell>
                  <TableCell className="text-right text-muted-foreground text-xs">manage →</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
      {canCreate && <CreateProject onCreated={refreshProjects} create={(b) => client!.createProject(b)} />}
    </div>
  );
}

function CreateProject({ create, onCreated }: { create: (b: { slug: string; name: string }) => Promise<unknown>; onCreated: () => void }) {
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true); setErr(null);
    try { await create({ slug: slug.trim(), name: name.trim() || slug.trim() }); setSlug(''); setName(''); onCreated(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Panel title="New project">
      <div className="flex items-end gap-3.5">
        <div className="flex-1 space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Slug</Label><Input placeholder="my-app" value={slug} onChange={(e) => setSlug(e.target.value)} /></div>
        <div className="flex-1 space-y-1.5"><Label className="text-xs font-medium text-muted-foreground">Name</Label><Input placeholder="My App" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <Button onClick={submit} disabled={busy || !slug.trim()}>{busy ? <Loader2 className="size-4 animate-spin" /> : 'Create'}</Button>
      </div>
      {err && <div className="mt-3"><ErrorNote>{err}</ErrorNote></div>}
    </Panel>
  );
}
