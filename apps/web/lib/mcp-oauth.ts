import { resolveSiteUrl } from './site-url';

export const MCP_OAUTH_SCOPES = ['email'] as const;

export function getMcpOAuthConfig(requestOrigin?: string) {
  const siteUrl = resolveSiteUrl(requestOrigin);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) throw new Error('Supabase Auth is not configured.');

  return {
    resource: `${siteUrl}/api/mcp`,
    resourceMetadataUrl: `${siteUrl}/.well-known/oauth-protected-resource`,
    authorizationServer: `${new URL(supabaseUrl).origin}/auth/v1`,
    icon: `${siteUrl}/ally-mcp-icon.png`,
  };
}

export function getProtectedResourceMetadata(requestOrigin?: string) {
  const config = getMcpOAuthConfig(requestOrigin);
  return {
    resource: config.resource,
    authorization_servers: [config.authorizationServer],
    scopes_supported: [...MCP_OAUTH_SCOPES],
    bearer_methods_supported: ['header'],
    resource_name: 'Ally MCP',
    resource_documentation: `${resolveSiteUrl(requestOrigin)}/docs`,
  };
}

export function getMcpBearerChallenge(requestOrigin?: string): string {
  const { resourceMetadataUrl } = getMcpOAuthConfig(requestOrigin);
  return `Bearer resource_metadata="${resourceMetadataUrl}", scope="${MCP_OAUTH_SCOPES.join(' ')}"`;
}
