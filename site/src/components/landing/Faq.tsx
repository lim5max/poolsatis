const FAQ = [
  {
    q: 'Is this just PostHog?',
    a: 'PostHog is built for humans clicking around dashboards. Poolstatis is built for agents calling tools: a semantic registry, a typed query DSL, and a headless admin for humans to audit what the agent proposes. Smaller, sharper, agent-first.',
  },
  {
    q: 'Do I have to write SQL?',
    a: 'Never. Your agent works through a typed query DSL that references registered metric keys: trends, funnels, retention, lifecycle, and stickiness. There’s no raw SQL surface to get wrong.',
  },
  {
    q: 'Can humans use it too?',
    a: 'Yes. There’s a clean admin panel to review observed events, activate proposed metrics, inspect people, and watch data quality. It’s deliberately headless: tables and controls, not a per-project chart wall.',
  },
  {
    q: 'Where does my data live?',
    a: 'In Postgres, behind a clean store interface. Self-host and it never leaves your infrastructure. When cloud ships, it’s the same engine, managed for you.',
  },
  {
    q: 'Which agents work with it?',
    a: 'Anything that speaks MCP: Claude Code, Cursor, Windsurf, Zed, Cline, and the rest. One server entry and the analytics tools appear alongside everything else your agent can do.',
  },
];

export function Faq() {
  return (
    <section className="band band-line" id="faq">
      <div className="wrap">
        <div className="sec-head reveal" style={{ textAlign: 'center', margin: '0 auto' }}>
          <h2>The honest FAQ</h2>
        </div>
        <div className="faq reveal">
          {FAQ.map((f) => (
            <details key={f.q}>
              <summary>{f.q} <span className="pm">+</span></summary>
              <div className="ans">{f.a}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
