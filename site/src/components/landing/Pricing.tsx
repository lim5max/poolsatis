import { Link } from 'react-router-dom';

export function Pricing() {
  return (
    <section className="band band-line" id="pricing">
      <div className="wrap">
        <div className="sec-head reveal">
          <h2>$0 while we shape hosted. <span className="it">Metered later.</span></h2>
          <p className="sec-sub">
            Start with a hosted agent workspace for free. We already track the usage dimensions that will make future pricing predictable.
          </p>
        </div>
        <div className="price-grid">
          <div className="plan reveal">
            <span className="pname">Hosted preview</span>
            <div className="pprice">$0 <small>/ now</small></div>
            <p className="pdesc">Create a workspace, connect your MCP client, register metrics, and send events without a card.</p>
            <ul>
              <li>Templates for Claude, Codex, Cursor, Warp, and custom MCP hosts</li>
              <li>1 project on the free hosted plan</li>
              <li>1M monthly events tracked before billing exists</li>
              <li>12 months retention target for preview workspaces</li>
            </ul>
            <Link className="btn btn-primary" to="/signup">Start for free <span className="arr">↗</span></Link>
          </div>
          <div className="plan feature reveal">
            <span className="flag">Planned meters</span>
            <span className="pname">Future billing</span>
            <div className="pprice">$0 <small>/ until enabled</small></div>
            <p className="pdesc">The schema is ready for usage-based pricing, but charges are not enforced yet.</p>
            <ul>
              <li>Events, similar to PostHog-style event billing</li>
              <li>Monthly tracked users as an Amplitude-style option</li>
              <li>Retained entities, projects, retention, and seats</li>
              <li>Limits and rates visible before enforcement</li>
            </ul>
            <Link className="btn btn-ghost" to="/docs">Read the model</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
