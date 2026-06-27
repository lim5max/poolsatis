export type McpClientId =
  | 'claude-code'
  | 'claude-desktop'
  | 'codex'
  | 'cursor'
  | 'warp'
  | 'windsurf'
  | 'vscode'
  | 'cline'
  | 'zed'
  | 'continue'
  | 'replit'
  | 'opencode'
  | 'hermes'
  | 'custom';

export interface McpClientProfile {
  id: McpClientId;
  name: string;
  group: 'Popular MCP hosts' | 'IDE agents' | 'Advanced/custom';
  badge?: string;
  description: string;
  pasteTarget: string;
}

export const MCP_CLIENTS: McpClientProfile[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    group: 'Popular MCP hosts',
    badge: 'Preset',
    description: 'Use this when the product repo is edited through Claude Code.',
    pasteTarget: 'Paste the stdio command, args, and env into your Claude Code MCP configuration.',
  },
  {
    id: 'claude-desktop',
    name: 'Claude Desktop',
    group: 'Popular MCP hosts',
    badge: 'Preset',
    description: 'Use this when Claude Desktop is the local MCP host.',
    pasteTarget: 'Paste the stdio command, args, and env into your Claude Desktop MCP configuration.',
  },
  {
    id: 'codex',
    name: 'Codex',
    group: 'Popular MCP hosts',
    badge: 'Preset',
    description: 'Use these command and env values when adding Poolstatis as a Codex MCP server.',
    pasteTarget: 'Add a Poolstatis MCP server in Codex with the command, args, and env below.',
  },
  {
    id: 'cursor',
    name: 'Cursor',
    group: 'Popular MCP hosts',
    description: 'Use this when your coding loop runs inside Cursor and its MCP server settings.',
    pasteTarget: 'Add Poolstatis in Cursor MCP settings with the command, args, and env below.',
  },
  {
    id: 'warp',
    name: 'Warp',
    group: 'Popular MCP hosts',
    description: 'Use this when Warp is the agent surface that should call Poolstatis tools.',
    pasteTarget: 'Add Poolstatis as a Warp MCP server with the stdio command and env below.',
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    group: 'Popular MCP hosts',
    description: 'Use this when Windsurf is the IDE agent editing the product repo.',
    pasteTarget: 'Add Poolstatis in Windsurf MCP settings with the command, args, and env below.',
  },
  {
    id: 'vscode',
    name: 'VS Code / Copilot',
    group: 'IDE agents',
    description: 'Use this for VS Code agent setups that can register local stdio MCP servers.',
    pasteTarget: 'Use these Poolstatis command, args, and env values in your VS Code MCP configuration.',
  },
  {
    id: 'cline',
    name: 'Cline',
    group: 'IDE agents',
    description: 'Use this for Cline-style coding sessions that call local MCP servers.',
    pasteTarget: 'Add Poolstatis to Cline MCP server settings with the command, args, and env below.',
  },
  {
    id: 'zed',
    name: 'Zed',
    group: 'IDE agents',
    description: 'Use this when your agent workflow runs through Zed and a compatible MCP bridge.',
    pasteTarget: 'Use these values in the Zed-compatible MCP host that launches Poolstatis.',
  },
  {
    id: 'continue',
    name: 'Continue',
    group: 'IDE agents',
    description: 'Use this for Continue.dev workflows with MCP server configuration.',
    pasteTarget: 'Add Poolstatis to Continue with the stdio command, args, and env below.',
  },
  {
    id: 'replit',
    name: 'Replit',
    group: 'IDE agents',
    description: 'Use this for Replit agent workflows that support MCP tool servers.',
    pasteTarget: 'Add Poolstatis to the Replit MCP host with the command, args, and env below.',
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    group: 'Advanced/custom',
    description: 'Use this for OpenCode or OpenCode-style terminal agents with MCP server config.',
    pasteTarget: 'Register Poolstatis as an OpenCode MCP server using the values below.',
  },
  {
    id: 'hermes',
    name: 'Hermes MCP',
    group: 'Advanced/custom',
    description: 'Use this for Hermes/Anubis MCP implementations or custom clients that launch stdio servers.',
    pasteTarget: 'Wire these values into your Hermes MCP client/server launcher.',
  },
  {
    id: 'custom',
    name: 'Custom MCP',
    group: 'Advanced/custom',
    description: 'Use this for another MCP host after checking where that host stores server config.',
    pasteTarget: 'Use the same stdio command, args, and environment in your MCP host.',
  },
];

export function mcpClientById(id: McpClientId): McpClientProfile {
  return MCP_CLIENTS.find((client) => client.id === id) ?? MCP_CLIENTS[0]!;
}

function parseRunnerArgs(raw: string | undefined): string[] {
  if (!raw?.trim()) return ['--silent', 'dlx', '@poolstatis/mcp'];
  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed) as unknown;
    return Array.isArray(parsed) ? parsed.filter((arg): arg is string => typeof arg === 'string') : [];
  }
  return trimmed.split(/\s+/);
}

export const MCP_RUNNER = {
  command: (import.meta.env.VITE_POOLSTATIS_MCP_COMMAND as string | undefined) ?? 'pnpm',
  args: parseRunnerArgs(import.meta.env.VITE_POOLSTATIS_MCP_ARGS as string | undefined),
  packageStatus: import.meta.env.VITE_POOLSTATIS_MCP_PACKAGE_PUBLISHED === 'true'
    ? 'published'
    : 'publish_pending',
};

export function mcpServerConfig(command: string, args: string[], url: string, token: string): string {
  return JSON.stringify({
    mcpServers: {
      poolstatis: {
        command,
        args,
        env: {
          POOLSTATIS_URL: url,
          POOLSTATIS_TOKEN: token,
        },
      },
    },
  }, null, 2);
}
