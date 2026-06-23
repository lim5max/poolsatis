import { useEffect } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { Landing } from './routes/Landing';
import { Login, Signup } from './routes/Auth';
import { DocsLayout } from './routes/docs/DocsLayout';
import { DocPage } from './routes/docs/DocPage';
import { docsIndex } from './routes/docs/content';

/** Scroll to top on route change (and to an in-page anchor when present). */
function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) { el.scrollIntoView({ behavior: 'smooth' }); return; }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export function App() {
  return (
    <>
      <ScrollManager />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/docs" element={<DocsLayout />}>
          <Route index element={<Navigate to={docsIndex[0]!.pages[0]!.slug} replace />} />
          <Route path=":slug" element={<DocPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
