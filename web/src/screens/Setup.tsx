import { useState } from 'react';
import { Check, Copy } from '@/components/icons';
import { useStore, useAsync } from '../store';
import { MCP_CLIENTS, MCP_RUNNER, mcpClientById, mcpServerConfig, type McpClientId } from '../mcpClients';
import { Panel, Loading, DangerConfirm } from '../components/ui';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const TOOLS = [
  ['Context', ['list_projects', 'get_project_schema']],
  ['Registry', ['register_metric', 'update_metric', 'deprecate_metric', 'explain_metric_usage', 'list_metrics', 'delete_metric', 'register_entity_type', 'define_funnel', 'list_funnels', 'delete_funnel']],
  ['Queries', ['query_trend', 'query_funnel', 'query_entities', 'query_retention', 'query_lifecycle', 'query_stickiness', 'sample_events']],
  ['Diagnostics', ['list_ingest_warnings', 'list_data_quality_issues']],
  ['Insights', ['list_insights', 'create_insight', 'resolve_insight']],
];

export function Setup() {
  const { client, baseUrl, token, tokenKind, project, env } = useStore();
  const [clientId, setClientId] = useState<McpClientId>('claude-code');
  const publicUrl =
    (import.meta.env.VITE_POOLSTATIS_PUBLIC_URL as string | undefined) ||
    (import.meta.env.VITE_POOLSTATIS_API_URL as string | undefined) ||
    'https://api.poolstatis.com';
  const serverUrl = baseUrl || publicUrl;
  const slug = project ?? 'your-project';
  const std = useAsync(() => client!.standard(), []);
  const selectedClient = mcpClientById(clientId);

  const mcpToken = tokenKind === 'user' ? '<replace-with-pt-or-sk>' : token;
  const mcpConfig = mcpServerConfig(MCP_RUNNER.command, MCP_RUNNER.args, serverUrl.replace(/\/$/, ''), mcpToken);
  const ingestCurl = `curl -X POST ${serverUrl}/i/v1/events \\
  -H 'Authorization: Bearer pk_…' \\
  -H 'content-type: application/json' \\
  -d '{"events":[{"event":"signup.completed","distinct_id":"u_123","properties":{"plan":"pro"}}]}'`;

  return (
    <div className="space-y-4 max-w-4xl">
      <SectionLabel>Connection</SectionLabel>
      <Panel title="Key map">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          <KeyUse prefix="sk_" title="Admin console" body="Paste this on the connect screen. It reads and manages one project: registry, Data, Keys, purge." />
          <KeyUse prefix="pk_" title="Product runtime" body="Use this in the SDK or HTTP ingest. It only writes events/entities for one env." />
          <KeyUse prefix="pt_" title="MCP agents" body="Use this in agent config for org-wide project discovery. A project sk_ also works when you want a narrow scope." />
        </div>
        <p className="text-xs text-muted-foreground mt-3.5">After the product sends data, inspect it in <strong className="text-foreground font-normal">Data → Event stream</strong>. Data health shows registered coverage and entity/event consistency; ingest warnings have their own Warnings tab.</p>
      </Panel>
      <Panel title="Connect a coding agent over MCP">
        <p className="text-muted-foreground text-sm mb-3.5">Choose where Poolstatis should appear, then copy the stdio MCP template. The command, args, and env are standard MCP values; the paste location depends on the host.</p>
        {MCP_RUNNER.packageStatus !== 'published' && (
          <div className="mb-3.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
            MCP runner is not marked published for this deploy. Configure <code>VITE_POOLSTATIS_MCP_COMMAND</code>, <code>VITE_POOLSTATIS_MCP_ARGS</code>, and <code>VITE_POOLSTATIS_MCP_PACKAGE_PUBLISHED=true</code> only after the runner exists.
          </div>
        )}
        <div className="mb-3.5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {MCP_CLIENTS.map((profile) => (
            <button
              key={profile.id}
              type="button"
              onClick={() => setClientId(profile.id)}
              aria-pressed={clientId === profile.id}
              className={`rounded-md border p-3 text-left transition-colors ${clientId === profile.id ? 'border-primary bg-primary/10 text-foreground' : 'bg-muted/20 text-muted-foreground hover:bg-accent/50 hover:text-foreground'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{profile.name}</span>
                {profile.badge && <Badge variant="outline" className="text-xs">{profile.badge}</Badge>}
              </div>
              <div className="mt-1 text-xs leading-relaxed">{profile.pasteTarget}</div>
            </button>
          ))}
        </div>
        {tokenKind === 'user' && (
          <div className="mb-3.5 rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-xs text-muted-foreground">
            This is a config template. Replace <code>&lt;replace-with-pt-or-sk&gt;</code> with the one-time <code>pt_</code> from onboarding, a newly issued personal token from Keys, or a project <code>sk_</code>.
          </div>
        )}
        <CodeBlock code={mcpConfig} />
        <p className="text-xs text-muted-foreground mt-2.5">{selectedClient.pasteTarget} Use a personal token (<code>pt_</code>) for org-wide discovery, or a project secret key (<code>sk_</code>) for a narrower scope.</p>
      </Panel>
      <Panel title="Send events from your product (HTTP)">
        <p className="text-muted-foreground text-sm mb-3.5">Issue an ingest key (<code>pk_</code>) on the Keys tab — write-only, safe in client code. It encodes the project and env.</p>
        <CodeBlock code={ingestCurl} />
      </Panel>

      <SectionLabel>MCP tools the agent gets</SectionLabel>
      <Panel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {TOOLS.map(([group, tools]) => (
            <div key={group as string} className="min-w-0">
              <div className="text-xs font-medium text-muted-foreground mb-2">{group}</div>
              <div className="flex flex-wrap gap-1.5">{(tools as string[]).map((t) => <Badge key={t} variant="outline" className="max-w-full whitespace-normal break-all font-normal font-mono text-xs">{t}</Badge>)}</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3.5">Plus resources <code>poolstatis://standard/instrumentation</code> and <code>poolstatis://{slug}/schema</code>.</p>
      </Panel>

      <SectionLabel>The instrumentation standard</SectionLabel>
      <Panel>
        {std.loading ? <Loading /> : <pre className="rounded-md border bg-background p-4 text-xs leading-relaxed overflow-auto max-h-96 whitespace-pre-wrap">{std.error ? `could not load standard: ${std.error}` : std.data}</pre>}
      </Panel>

      <SectionLabel danger>Danger zone</SectionLabel>
      <DangerZone slug={slug} env={env} />
    </div>
  );
}

function KeyUse({ prefix, title, body }: { prefix: string; title: string; body: string }) {
  return (
    <div className="rounded-md border bg-muted/20 p-3.5">
      <Badge variant="outline" className="font-mono">{prefix}</Badge>
      <div className="font-medium mt-2">{title}</div>
      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{body}</p>
    </div>
  );
}

function SectionLabel({ children, danger }: { children: React.ReactNode; danger?: boolean }) {
  return <div className={`text-xs font-medium pb-2 border-b mt-4 ${danger ? 'text-destructive border-destructive/30' : 'text-muted-foreground'}`}>{children}</div>;
}

function DangerZone({ slug, env }: { slug: string; env: string }) {
  const { client, tokenKind } = useStore();
  const [action, setAction] = useState<null | { scope: 'events' | 'entities' | 'all'; title: string; del: string[] }>(null);
  const [result, setResult] = useState<string | null>(null);

  if (tokenKind !== 'secret') {
    return <Card className="border-destructive/40"><div className="p-5 text-xs text-muted-foreground">Data purge requires a project <code>secret</code> key (<code>sk_</code>). You're connected with a {tokenKind} token.</div></Card>;
  }

  const rows: Array<{ scope: 'events' | 'entities' | 'all'; t: string; d: string; del: string[] }> = [
    { scope: 'events', t: 'Purge event data', d: `Delete all events for the ${env} environment.`, del: [`all events (env: ${env})`, 'computed funnels & health'] },
    { scope: 'entities', t: 'Purge entities', d: `Delete all entity rows for the ${env} environment.`, del: [`all entities (env: ${env})`] },
    { scope: 'all', t: 'Purge everything', d: `Delete all events AND entities for the ${env} environment.`, del: [`all events + entities (env: ${env})`] },
  ];

  return (
    <Card className="border-destructive/40 py-0 gap-0 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-destructive/20"><h3 className="serif text-lg text-destructive">Danger zone · {env}</h3></div>
      {result && <div className="m-4 rounded-md border bg-muted/40 px-4 py-3 text-sm">{result}</div>}
      {rows.map((r) => (
        <div key={r.scope} className="flex items-center justify-between gap-4 px-5 py-3.5 border-b last:border-0">
          <div><div className="text-sm">{r.t}</div><div className="text-xs text-muted-foreground mt-0.5">{r.d}</div></div>
          <Button variant="destructive" onClick={() => setAction({ scope: r.scope, title: r.t, del: r.del })}>{r.t}</Button>
        </div>
      ))}
      {action && (
        <DangerConfirm title={`${action.title}?`}
          blastRadius={<>This purges <strong className="text-foreground font-mono">{env}</strong> data only and cannot be undone.</>}
          willDelete={action.del} willKeep={['metric & funnel definitions', 'API keys', 'entity-type schema']}
          matchValue={slug} matchLabel="Type the project slug to confirm" confirmLabel={action.title}
          onCancel={() => setAction(null)}
          onConfirm={async () => { const res = await client!.purgeData(slug, { env, scope: action.scope, confirm_slug: slug }); setResult(`Purged ${env}: ${res.events_deleted} events, ${res.entities_deleted} entities removed.`); setAction(null); }} />
      )}
    </Card>
  );
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1400); } catch { /* blocked */ } };
  return (
    <div className="relative">
      <Button variant="outline" size="sm" className="absolute top-2 right-2 h-9 z-10" onClick={copy}>{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{copied ? 'Copied' : 'Copy'}</Button>
      <pre className="rounded-md border bg-background p-4 pr-20 text-xs leading-relaxed overflow-auto">{code}</pre>
    </div>
  );
}
