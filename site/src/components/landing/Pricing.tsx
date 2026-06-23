import { Link } from 'react-router-dom';

export function Pricing() {
  return (
    <section className="band band-line" id="pricing">
      <div className="wrap">
        <div className="sec-head reveal">
          <h2>Free to self-host. <span className="it">Forever.</span></h2>
          <p className="sec-sub">
            The whole platform is open source. Run it yourself, or let us run it for you when cloud lands.
          </p>
        </div>
        <div className="price-grid">
          <div className="plan reveal">
            <span className="pname">Self-host</span>
            <div className="pprice">$0 <small>/ forever</small></div>
            <p className="pdesc">The complete platform on your own Postgres. No seat limits, no event caps.</p>
            <ul>
              <li>Ingest, registry, query DSL &amp; MCP server</li>
              <li>Headless admin panel for humans</li>
              <li>Unlimited projects, metrics &amp; events</li>
              <li>Your data stays on your infra</li>
            </ul>
            <a className="btn btn-ghost" href="https://github.com" target="_blank" rel="noreferrer">Clone the repo</a>
          </div>
          <div className="plan feature reveal">
            <span className="flag">Managed waitlist</span>
            <span className="pname">Cloud</span>
            <div className="pprice">Waitlist <small>/ managed</small></div>
            <p className="pdesc">Hosted, scaled, and backed up for you. Same platform, none of the ops.</p>
            <ul>
              <li>Everything in Self-host</li>
              <li>Managed Postgres &amp; retention</li>
              <li>Auto-generated insights worker</li>
              <li>Team access &amp; audit log</li>
            </ul>
            <Link className="btn btn-primary" to="/signup">Join the waitlist <span className="arr">↗</span></Link>
          </div>
        </div>
      </div>
    </section>
  );
}
