import { Link } from 'react-router-dom';

export function FinalCta() {
  return (
    <section className="final">
      <div className="wrap reveal">
        <h2>Stop shipping <span className="it">blind.</span></h2>
        <p>
          Give your agent the missing half of the loop. It takes one MCP entry, and it already
          knows what to do with it.
        </p>
        <div className="hero-cta">
          <Link className="btn btn-primary" to="/signup">Connect your agent <span className="arr">↗</span></Link>
          <Link className="btn btn-ghost" to="/docs">Read the standard</Link>
        </div>
      </div>
    </section>
  );
}
