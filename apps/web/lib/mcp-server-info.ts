import { PRODUCTION_SITE_URL } from './site-url';

export const ALLY_MCP_SERVER_INFO = {
  name: 'ally-remote-mcp',
  title: 'Ally MCP',
  version: '0.3.0',
  description: 'Accessibility scanning, WCAG guidance, remediation planning, and deterministic fix verification.',
  websiteUrl: `${PRODUCTION_SITE_URL}/docs`,
  icons: [
    {
      src: `${PRODUCTION_SITE_URL}/ally-mcp-icon.png`,
      mimeType: 'image/png',
      sizes: ['256x256'],
    },
  ],
};
