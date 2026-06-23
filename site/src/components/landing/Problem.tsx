const CONTRACT = [
  {
    k: 'Purpose',
    h: 'Say why it exists',
    p: 'No purpose, no metric.',
  },
  {
    k: 'Goal',
    h: 'Name the journey',
    p: 'Every funnel carries the outcome it measures.',
  },
  {
    k: 'Keys',
    h: 'Query known keys',
    p: 'Agents never guess raw event names.',
  },
  {
    k: 'Audit',
    h: 'Approve before active',
    p: 'Humans keep the registry clean.',
  },
];

export function Problem() {
  return (
    <section className="band band-line contract-section">
      <div className="wrap">
        <div className="contract-layout">
          <div className="sec-head reveal">
            <h2>Every number has <span className="it">a job.</span></h2>
            <p className="sec-sub">
              A metric enters the system only when an agent and a human can both explain what decision
              it supports.
            </p>
          </div>

          <div className="contract-card reveal">
            <div className="contract-card-head">
              <span className="contract-title">Poolstatis registry contract</span>
              <span className="contract-note">agent-safe by design</span>
            </div>
            <div className="contract-flow">
              {CONTRACT.map((p) => (
                <div className="contract-node" key={p.h}>
                  <span className="contract-key">{p.k}</span>
                  <h4>{p.h}</h4>
                  <p>{p.p}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
