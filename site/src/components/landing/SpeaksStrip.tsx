import type { ReactNode } from 'react';
import { ClaudeLogo } from '@/components/logos/claude';

const AGENTS: Array<{ name: string; logo?: ReactNode }> = [
  { name: 'Claude Code', logo: <ClaudeLogo className="logo" /> },
  { name: 'Claude Desktop', logo: <ClaudeLogo className="logo" /> },
  { name: 'Codex' },
  { name: 'Cursor' },
  { name: 'Warp' },
  { name: 'Windsurf' },
  { name: 'VS Code / Copilot' },
  { name: 'Cline' },
  { name: 'Zed' },
  { name: 'Continue' },
  { name: 'Custom MCP' },
];

export function SpeaksStrip() {
  return (
    <section className="band-line">
      <div className="wrap speaks reveal">
        <span className="label">One MCP entry. Works in</span>
        {AGENTS.map((a) => (
          <span className="agent" key={a.name}>{a.logo}{a.name}</span>
        ))}
        <span className="agent">hosted setup</span>
      </div>
    </section>
  );
}
