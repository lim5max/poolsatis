import './docs.css';
import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { GithubIcon, Menu, Search, X } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { docsIndex } from './content';

export function DocsLayout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  // close the mobile drawer whenever the route changes
  const key = pathname;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <TopBar onMenu={() => setOpen(true)} />
      <div className="mx-auto flex w-full max-w-[1400px]">
        {/* sidebar — sticky on desktop, drawer on mobile */}
        <Sidebar open={open} onClose={() => setOpen(false)} navKey={key} />
        <main className="min-w-0 flex-1 px-6 py-10 lg:px-12">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-4 lg:px-6">
        <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={onMenu} aria-label="Open menu">
          <Menu className="size-5" />
        </Button>
        <Link to="/" className="flex items-center gap-2 font-bold tracking-tight">
          <img className="size-7" src="/poolstatis-logo.svg" alt="" />
          Poolstatis
          <span className="ml-1 rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] font-normal text-muted-foreground">docs</span>
        </Link>

        <div className="ml-auto hidden items-center gap-2 rounded-md border border-border bg-secondary/50 px-3 py-1.5 text-sm text-muted-foreground sm:flex w-56">
          <Search className="size-3.5" />
          <span className="flex-1">Search docs</span>
          <kbd className="rounded bg-background px-1.5 font-mono text-[11px]">⌘K</kbd>
        </div>

        <a href="https://github.com" target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground" aria-label="GitHub">
          <GithubIcon className="size-5" />
        </a>
        <Button asChild size="sm" className="hidden sm:inline-flex">
          <Link to="/signup">Connect your agent</Link>
        </Button>
      </div>
    </header>
  );
}

function Sidebar({ open, onClose, navKey }: { open: boolean; onClose: () => void; navKey: string }) {
  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={onClose} />}
      <aside
        className={[
          'z-50 w-64 shrink-0 border-r border-border bg-background',
          'fixed inset-y-0 left-0 transition-transform lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)] lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <div className="flex h-14 items-center justify-between px-4 lg:hidden">
          <span className="font-bold">Docs</span>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close menu"><X className="size-5" /></Button>
        </div>
        <nav className="h-full overflow-y-auto px-3 py-6 lg:py-8" key={navKey}>
          {docsIndex.map((group) => (
            <div key={group.label} className="mb-6">
              <div className="px-3 pb-2 font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.pages.map((p) => (
                  <NavLink
                    key={p.slug}
                    to={`/docs/${p.slug}`}
                    className={({ isActive }) => `doc-navlink${isActive ? ' active' : ''}`}
                    onClick={onClose}
                  >
                    {p.title}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
