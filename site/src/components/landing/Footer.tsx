import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer>
      <div className="wrap">
        <div className="foot-grid">
          <div className="col" style={{ maxWidth: 280 }}>
            <a className="brand" href="#top" style={{ marginBottom: 14 }}>
              <img className="brand-logo" src="/poolstatis-logo.svg" alt="" /> Poolstatis
            </a>
            <p className="mono" style={{ fontSize: 13, color: 'var(--ink-muted)', lineHeight: 1.6 }}>
              Product analytics for the age of coding agents. Every metric earns its place.
            </p>
          </div>
          <div className="col">
            <h5>Product</h5>
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="col">
            <h5>Developers</h5>
            <Link to="/docs">Documentation</Link>
            <Link to="/docs/standard">Instrumentation standard</Link>
            <Link to="/docs/mcp-tools">MCP reference</Link>
            <a href="https://github.com" target="_blank" rel="noreferrer">GitHub</a>
          </div>
          <div className="col">
            <h5>Account</h5>
            <Link to="/login">Log in</Link>
            <Link to="/signup">Sign up</Link>
          </div>
        </div>
        <div className="foot-bottom">
          <span className="mono">© 2026 Poolstatis</span>
          <span className="mono">Made for agents. Audited by humans.</span>
        </div>
      </div>
    </footer>
  );
}
