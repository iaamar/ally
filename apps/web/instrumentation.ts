export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) return;
  const { registerOTel } = await import('@vercel/otel');
  registerOTel({ serviceName: 'ally-hosted-mcp' });
}
