import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';

export function Hero() {
  return (
    <header className="hero" id="top">
      <div className="hero-grid" aria-hidden="true" />
      <div className="wrap hero-cols">
        <div>
          <span className="eyebrow fade-up d1">Agent-first product analytics</span>
          <h1 className="headline fade-up d2">
            Let your agent <span className="hl">measure</span> what it ships.
          </h1>
          <p className="subhead fade-up d3">
            A semantic registry, typed queries, and answers tied to purpose. No dashboards, no SQL.
          </p>
          <div className="hero-cta fade-up d4">
            <Link className="btn btn-primary" to="/signup">Connect your agent <span className="arr">↗</span></Link>
            <Link className="btn btn-ghost" to="/docs">Read the docs</Link>
          </div>
        </div>

        <AgentProof />
      </div>
    </header>
  );
}

function AgentProof() {
  const bar = (width: string) => ({ '--w': width }) as CSSProperties;

  return (
    <div
      className="agent-proof fade-up d4"
      role="img"
      aria-label="A coding agent using Poolstatis MCP to register metrics, build a funnel, and report onboarding conversion growth."
    >
      <div className="proof-shell">
        <div className="proof-top">
          <img className="brand-avatar" src="/poolstatis-logo.svg" alt="" />
          <div>
            <strong>Your coding agent found an onboarding lift.</strong>
            <p className="proof-intro">It used Poolstatis MCP tools inside the coding session.</p>
          </div>
          <span className="proof-state">Poolstatis MCP</span>
        </div>

        <div className="proof-console" aria-label="Coding agent MCP tool calls and answer">
          <div className="console-bar">
            <span />
            <span />
            <span />
            <strong>Coding agent run</strong>
          </div>
          <div className="proof-log">
            <p>
              <span className="agent-line">agent</span>
              <code>scanned onboarding changes</code>
            </p>
            <p>
              <span className="tool">tool</span>
              <code>register_metric signup_started</code>
            </p>
            <p>
              <span className="tool">tool</span>
              <code>register_metric activation_first_value</code>
            </p>
            <p>
              <span className="tool">tool</span>
              <code>register_funnel onboarding_activation</code>
            </p>
            <p>
              <span className="tool">tool</span>
              <code>query_funnel onboarding prev_14d</code>
            </p>
            <p>
              <span className="ok">answer</span>
              <code>38.4% -&gt; 47.1%</code>
            </p>
          </div>
        </div>

        <div className="proof-answer">
          <div>
            <span className="proof-label">Conversion lift</span>
            <p>More users reached first useful action after the new onboarding shipped.</p>
            <div className="proof-bars" aria-hidden="true">
              <span style={bar('62%')}>38.4%</span>
              <span style={bar('78%')}>47.1%</span>
            </div>
          </div>
          <strong>+8.7 pp</strong>
        </div>
      </div>
    </div>
  );
}
