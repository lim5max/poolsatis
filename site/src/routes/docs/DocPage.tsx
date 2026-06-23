import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from '@/components/icons';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import { allDocPages, extractToc, findDoc } from './content';

const REHYPE = [
  rehypeSlug,
  [
    rehypeAutolinkHeadings,
    { behavior: 'append', properties: { className: ['heading-anchor'], ariaHidden: 'true', tabIndex: -1 }, content: { type: 'text', value: '#' } },
  ],
] as never;

export function DocPage() {
  const { slug = '' } = useParams();
  const found = findDoc(slug);
  const toc = useMemo(() => (found ? extractToc(found.page.body) : []), [found]);
  const activeId = useScrollSpy(toc.map((t) => t.id), slug);

  if (!found) {
    return (
      <div className="py-10">
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="mt-2 text-muted-foreground">
          That doc doesn’t exist. <Link to="/docs" className="text-primary hover:underline">Back to docs</Link>.
        </p>
      </div>
    );
  }

  const { page, group } = found;
  const idx = allDocPages.findIndex((p) => p.slug === slug);
  const prev = idx > 0 ? allDocPages[idx - 1] : null;
  const next = idx < allDocPages.length - 1 ? allDocPages[idx + 1] : null;

  return (
    <div className="flex gap-12">
      <article className="min-w-0 flex-1">
        <div className="mb-2 font-mono text-xs uppercase tracking-wider text-primary/80">{group.label}</div>
        <div className="doc-prose">
          <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={REHYPE}>
            {page.body}
          </Markdown>
        </div>

        <nav className="mt-16 grid gap-3 border-t border-border pt-8 sm:grid-cols-2">
          {prev ? (
            <Link to={`/docs/${prev.slug}`} className="group rounded-xl border border-border p-4 transition-colors hover:border-primary/40">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><ArrowLeft className="size-3.5" /> Previous</span>
              <span className="mt-1 block font-medium group-hover:text-primary">{prev.title}</span>
            </Link>
          ) : <span />}
          {next && (
            <Link to={`/docs/${next.slug}`} className="group rounded-xl border border-border p-4 text-right transition-colors hover:border-primary/40">
              <span className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">Next <ArrowRight className="size-3.5" /></span>
              <span className="mt-1 block font-medium group-hover:text-primary">{next.title}</span>
            </Link>
          )}
        </nav>
      </article>

      {toc.length > 0 && (
        <aside className="hidden w-56 shrink-0 xl:block">
          <div className="sticky top-24">
            <div className="mb-3 font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">On this page</div>
            <nav>
              {toc.map((t) => (
                <a
                  key={t.id}
                  href={`#${t.id}`}
                  className={`doc-toclink lvl-${t.level}${activeId === t.id ? ' active' : ''}`}
                >
                  {t.text}
                </a>
              ))}
            </nav>
          </div>
        </aside>
      )}
    </div>
  );
}

/** Highlight the heading nearest the top of the viewport as you scroll. */
function useScrollSpy(ids: string[], dep: string): string | null {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    setActive(ids[0] ?? null);
    if (!ids.length || !('IntersectionObserver' in window)) return;
    const seen = new Map<string, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => seen.set(e.target.id, e.isIntersecting));
        const firstVisible = ids.find((id) => seen.get(id));
        if (firstVisible) setActive(firstVisible);
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 },
    );
    ids.forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });
    return () => io.disconnect();
    // re-run when the page (dep) changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep]);
  return active;
}
