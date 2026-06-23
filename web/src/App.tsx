import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { LayoutGrid, List, Database, KeyRound, Settings, ChevronsUpDown, type PoolstatisIcon } from '@/components/icons';
import { useStore } from './store';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Connect } from './screens/Connect';
import { Projects } from './screens/Projects';
import { Registry } from './screens/Registry';
import { Data } from './screens/Data';
import { Keys } from './screens/Keys';
import { Setup } from './screens/Setup';
import { Person } from './screens/Person';

type NavItem = { to: string; Icon: PoolstatisIcon; label: string; end?: boolean };
const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  { label: 'Workspace', items: [{ to: '/', Icon: LayoutGrid, label: 'Projects', end: true }] },
  { label: 'Instrument', items: [
    { to: '/registry', Icon: List, label: 'Registry' },
    { to: '/data', Icon: Database, label: 'Data' },
    { to: '/keys', Icon: KeyRound, label: 'Keys' },
  ] },
  { label: 'System', items: [{ to: '/setup', Icon: Settings, label: 'Setup & MCP' }] },
];
const TITLES: Record<string, string> = { '/': 'Projects', '/registry': 'Registry', '/data': 'Data', '/keys': 'Keys', '/setup': 'Setup & MCP' };
const titleFor = (path: string) => (path.startsWith('/data/person') ? 'Person' : TITLES[path] ?? 'Poolstatis');
const isProjectScoped = (path: string) => path === '/' || path.startsWith('/registry') || path.startsWith('/data') || path.startsWith('/keys');

export function App() {
  const { token } = useStore();
  if (!token) return <Connect />;
  return (
    <div className="grid grid-cols-[232px_1fr] h-screen">
      <Sidebar />
      <Main />
    </div>
  );
}

function Sidebar() {
  const { client, disconnect, tokenKind } = useStore();
  return (
    <aside className="flex flex-col bg-sidebar border-r py-5">
      <div className="px-5 pb-5">
        <div className="serif text-2xl flex items-center gap-2.5">
          <img className="size-8" src="/poolstatis-logo.svg" alt="" /> Poolstatis
        </div>
        <div className="text-xs text-muted-foreground mt-1">Headless analytics admin</div>
      </div>
      <nav className="flex-1 px-3">
        {NAV_GROUPS.map((g) => (
          <div key={g.label} className="mb-1">
            <div className="px-3 pt-3.5 pb-1.5 text-xs font-medium text-muted-foreground/70">{g.label}</div>
            {g.items.map(({ to, Icon, label, end }) => (
              <NavLink key={to} to={to} end={end}
                className={({ isActive }) => cn('flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
                  isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50')}>
                <Icon className="size-4" /> {label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="px-5 pt-3 border-t mt-2 flex items-center justify-between">
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={cn('size-1.5 rounded-full', client ? 'bg-emerald-500' : 'bg-destructive')} /> {tokenKind ?? 'connected'} key
        </span>
        <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={disconnect}>disconnect</Button>
      </div>
    </aside>
  );
}

function Main() {
  const loc = useLocation();
  const { projects, project, setProject } = useStore();
  const title = titleFor(loc.pathname);
  const showProject = isProjectScoped(loc.pathname);

  return (
    <div className="overflow-y-auto h-screen">
      <div className="sticky top-0 z-10 flex items-center h-14 px-8 border-b bg-background/85 backdrop-blur-md">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Poolstatis</span>
          {showProject && project && (
            <>
              <span className="text-muted-foreground/50">/</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 gap-1.5">{project}<ChevronsUpDown className="size-3" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {projects.map((p) => (
                    <DropdownMenuItem key={p.slug} onClick={() => setProject(p.slug)}>{p.slug}</DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
          <span className="text-muted-foreground/50">/</span>
          <span className="text-foreground">{title}</span>
        </div>
      </div>
      <motion.div className="p-8 pb-20 max-w-6xl" key={loc.pathname}
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.26, ease: 'easeOut' }}>
        <Routes>
          <Route path="/" element={<Projects />} />
          <Route path="/registry" element={<Guarded><Registry /></Guarded>} />
          <Route path="/data" element={<Guarded><Data /></Guarded>} />
          <Route path="/data/person/:distinctId" element={<Guarded><Person /></Guarded>} />
          <Route path="/keys" element={<Guarded><Keys /></Guarded>} />
          <Route path="/setup" element={<Setup />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </motion.div>
    </div>
  );
}

function Guarded({ children }: { children: React.ReactNode }) {
  const { project } = useStore();
  if (!project) return <div className="flex flex-col items-center gap-2 py-14 text-center text-muted-foreground"><div className="serif text-xl text-foreground/70">No project selected</div><div>pick one on the Projects tab</div></div>;
  return <>{children}</>;
}
