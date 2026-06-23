import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

export function Nav() {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const marker = document.querySelector('.nav-sentinel');
    if (!marker || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        setCompact(!entry.isIntersecting);
      },
      { threshold: 0 },
    );

    observer.observe(marker);
    return () => observer.disconnect();
  }, []);

  return (
    <nav className={compact ? 'compact' : undefined}>
      <div className="wrap nav-inner">
        <a className="brand" href="#top">
          <img className="brand-logo" src="/poolstatis-logo.svg" alt="" />
          Poolstatis
        </a>
        <div className="nav-links">
          <a className="lnk" href="#how">How it works</a>
          <a className="lnk" href="#features">Features</a>
          <a className="lnk" href="#pricing">Pricing</a>
          <Link className="lnk" to="/docs">Docs</Link>
        </div>
        <div className="nav-cta">
          <Link className="lnk" to="/login">Log in</Link>
          <Link className="btn btn-primary" to="/signup">Connect your agent</Link>
        </div>
      </div>
    </nav>
  );
}
