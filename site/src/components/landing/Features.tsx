import type { ReactNode } from 'react';
import { Boxes, Server, ShieldCheck, Target, Terminal, UsersRound, type PoolstatisIcon } from '@/components/icons';

interface Feat { ic: PoolstatisIcon; h: string; p: ReactNode }

const FEATURES: Feat[] = [
  { ic: Target, h: 'Purpose-first registry', p: 'Every metric names the decision it informs. Numbers that can’t justify themselves don’t get created.' },
  { ic: Boxes, h: 'Four primitives, zero ambiguity', p: 'Event, Entity, Metric, Funnel. Small enough for an agent to use correctly every time.' },
  { ic: Terminal, h: 'A query DSL, not a SQL console', p: 'Trends, funnels, retention, lifecycle, and stickiness reference metric keys.' },
  { ic: ShieldCheck, h: 'Data quality, surfaced', p: <>Matching events are <b>registered</b>; everything else is flagged <b>wild</b> before drift hides.</> },
  { ic: UsersRound, h: 'People you can group', p: 'Recency, frequency, tenure, and lifecycle stage are derived per person, server-side.' },
  { ic: Server, h: 'Yours to host', p: 'Postgres under the hood, behind a clean store interface. Your data stays on your infra.' },
];

export function Features() {
  return (
    <section className="band band-line" id="features">
      <div className="wrap">
        <div className="sec-head reveal">
          <h2>A semantic layer, <span className="it">not another event firehose.</span></h2>
          <p className="sec-sub">
            Poolstatis is opinionated on purpose. The constraints are what make an agent’s output
            trustworthy.
          </p>
        </div>
        <div className="bento">
          {FEATURES.map((f) => {
            const Icon = f.ic;
            return (
              <div className="feat" key={f.h}>
                <div className="ic">
                  <Icon aria-hidden="true" />
                </div>
                <h4>{f.h}</h4>
                <p>{f.p}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
