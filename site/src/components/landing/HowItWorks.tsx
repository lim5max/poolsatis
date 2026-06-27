import type { ReactNode } from 'react';

interface Step { num: string; h: string; p: string; code: ReactNode }

const STEPS: Step[] = [
  {
    num: 'Connect',
    h: 'Add the MCP server',
    p: 'Choose Claude, Codex, Cursor, Warp, Windsurf, VS Code/Copilot, or a custom MCP host. Poolstatis gives the same stdio command, args, and env for the client you use.',
    code: (
      <>
        <span className="c">{`// .mcp.json`}</span>{`
{ `}<span className="k">"poolstatis"</span>{`: {
  `}<span className="k">"command"</span>{`: `}<span className="s">"pnpm"</span>{`,
  `}<span className="k">"args"</span>{`: [`}<span className="s">"--silent"</span>{`, `}<span className="s">"dlx"</span>{`, `}<span className="s">"@poolstatis/mcp"</span>{`]
}}`}
      </>
    ),
  },
  {
    num: 'Register',
    h: 'Register with intent',
    p: 'Your agent reads the codebase, proposes the right metrics, and registers each with a mandatory purpose. No purpose, no metric.',
    code: (
      <>
        <span className="f">register_metric</span>{`({
  key: `}<span className="s">"first_export"</span>{`,
  `}<span className="k">purpose</span>{`: `}<span className="s">"the aha moment"</span>{`,
  category: `}<span className="s">"activation"</span>{`
})`}
      </>
    ),
  },
  {
    num: 'Ask',
    h: 'Ask in plain language',
    p: '“Did the new onboarding lift activation?” Your agent picks the right query, runs it through a typed DSL, and reads the answer back in terms of the goal.',
    code: (
      <>
        <span className="f">query_retention</span>{`({
  start_metric: `}<span className="s">"signup"</span>{`,
  return_metric: `}<span className="s">"first_export"</span>{`,
  interval: `}<span className="s">"week"</span>{`
})`}
      </>
    ),
  },
];

export function HowItWorks() {
  return (
    <section className="band band-line" id="how">
      <div className="wrap">
        <div className="sec-head reveal">
          <h2>Three moves. <span className="it">Your agent does all of them.</span></h2>
          <p className="sec-sub">
            You connect once. After that, instrumentation and analysis happen in the same place your
            coding agent already works: the chat.
          </p>
        </div>
        <div className="steps">
          {STEPS.map((s) => (
            <div className="step reveal" key={s.num}>
              <div className="top">
                <span className="num">{s.num}</span>
                <h4>{s.h}</h4>
                <p>{s.p}</p>
              </div>
              <pre className="code">{s.code}</pre>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
