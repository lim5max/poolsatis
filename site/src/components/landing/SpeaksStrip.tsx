import type { ReactNode } from 'react';
import { ClaudeLogo } from '@/components/logos/claude';
import { CursorLogo } from '@/components/logos/cursor';
import { WindsurfLogo } from '@/components/logos/windsurf';
import { ZedLogo } from '@/components/logos/zed';
import { ClineLogo } from '@/components/logos/cline';

const AGENTS: { name: string; logo: ReactNode }[] = [
  { name: 'Claude Code', logo: <ClaudeLogo className="logo" /> },
  { name: 'Cursor', logo: <CursorLogo className="logo" /> },
  { name: 'Windsurf', logo: <WindsurfLogo className="logo" /> },
  { name: 'Zed', logo: <ZedLogo className="logo" /> },
  { name: 'Cline', logo: <ClineLogo className="logo" /> },
];

export function SpeaksStrip() {
  return (
    <section className="band-line">
      <div className="wrap speaks reveal">
        <span className="label">One MCP entry. Works in</span>
        {AGENTS.map((a) => (
          <span className="agent" key={a.name}>{a.logo}{a.name}</span>
        ))}
        <span className="agent">any MCP client</span>
      </div>
    </section>
  );
}
