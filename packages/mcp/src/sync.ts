import type { ScanReport } from '@ally/shared';
import { zScanIngest } from '@ally/shared';

export async function pushReport(
  report: ScanReport,
  opts: { apiKey: string; baseUrl: string },
): Promise<{ ok: boolean; status: number; body: string }> {
  const body = zScanIngest.parse({
    projectName: report.projectName,
    report,
  });

  const res = await fetch(`${opts.baseUrl}/api/v1/scans`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  return { ok: res.ok, status: res.status, body: text };
}
