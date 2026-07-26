import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  correlate,
  loadConfig,
  runtimeScan,
  scanProject,
} from '@ally/engine';
import type { Finding, ScanReport, WcagLevel } from '@ally/shared';

export interface EvaluationProfile {
  runtime: boolean;
  appUrl?: string;
  routes: string[];
  runtimeTimeoutMs: number;
  testScripts: string[];
  testTimeoutMs: number;
}

export interface EvaluationProfileOverrides {
  runtime?: boolean;
  appUrl?: string;
  routes?: string[];
  testScripts?: string[];
  runtimeTimeoutMs?: number;
  testTimeoutMs?: number;
}

export interface RuntimeRouteResult {
  route: string;
  url: string;
  findingCount: number;
  error?: string;
}

export interface EvaluationScan {
  report: ScanReport;
  runtime: {
    required: boolean;
    passed: boolean;
    routes: RuntimeRouteResult[];
  };
}

export interface TestScriptResult {
  script: string;
  passed: boolean;
  exitCode: number | null;
  durationMs: number;
  command?: string;
  output: string;
  error?: string;
}

interface ScanPolicy {
  targetLevel: WcagLevel;
  ignoreRules: string[];
}

interface PackageJson {
  scripts?: Record<string, string>;
  packageManager?: string;
}

function boundedInt(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(value as number, max));
}

function normalizeRoutes(routes: string[] | undefined): string[] {
  const normalized = (routes?.length ? routes : ['/'])
    .map((route) => route.trim())
    .filter(Boolean);
  return [...new Set(normalized)].slice(0, 50);
}

export function resolveEvaluationProfile(
  root: string,
  overrides: EvaluationProfileOverrides = {},
): EvaluationProfile {
  const config = loadConfig(root);
  const evaluation = config.evaluation;

  return {
    runtime: overrides.runtime ?? evaluation?.runtime ?? false,
    appUrl: overrides.appUrl?.trim() || config.appUrl,
    routes: normalizeRoutes(overrides.routes ?? evaluation?.routes),
    runtimeTimeoutMs: boundedInt(
      overrides.runtimeTimeoutMs ?? evaluation?.timeoutMs,
      30_000,
      1_000,
      120_000,
    ),
    testScripts: [
      ...new Set(overrides.testScripts ?? evaluation?.testScripts ?? []),
    ].slice(0, 20),
    testTimeoutMs: boundedInt(overrides.testTimeoutMs, 120_000, 1_000, 600_000),
  };
}

function routeUrl(appUrl: string, route: string): string {
  try {
    return new URL(route).toString();
  } catch {
    return new URL(route, appUrl.endsWith('/') ? appUrl : `${appUrl}/`).toString();
  }
}

export async function scanForEvaluation(
  root: string,
  policy: ScanPolicy,
  profile: EvaluationProfile,
): Promise<EvaluationScan> {
  let report = await scanProject(root, {
    targetLevel: policy.targetLevel,
    ignoreRules: policy.ignoreRules,
  });

  if (!profile.runtime) {
    return {
      report,
      runtime: { required: false, passed: true, routes: [] },
    };
  }

  if (!profile.appUrl) {
    return {
      report,
      runtime: {
        required: true,
        passed: false,
        routes: [{
          route: '/',
          url: '',
          findingCount: 0,
          error: 'Runtime evaluation requires appUrl in ally.config.json or the remediation contract.',
        }],
      },
    };
  }

  const runtimeFindings: Finding[] = [];
  const routes: RuntimeRouteResult[] = [];
  for (const route of profile.routes) {
    const url = routeUrl(profile.appUrl, route);
    try {
      const findings = await runtimeScan(url, {
        timeoutMs: profile.runtimeTimeoutMs,
      });
      runtimeFindings.push(...findings);
      routes.push({ route, url, findingCount: findings.length });
    } catch (error) {
      routes.push({
        route,
        url,
        findingCount: 0,
        error: error instanceof Error ? error.message : 'Runtime scan failed.',
      });
    }
  }

  report = correlate(report, runtimeFindings);
  return {
    report,
    runtime: {
      required: true,
      passed: routes.every((route) => !route.error),
      routes,
    },
  };
}

function packageManager(root: string, packageJson: PackageJson): {
  command: string;
  prefix: string[];
} {
  const declared = packageJson.packageManager?.split('@')[0];
  if (declared === 'pnpm' || existsSync(join(root, 'pnpm-lock.yaml'))) {
    return { command: 'pnpm', prefix: ['run'] };
  }
  if (declared === 'yarn' || existsSync(join(root, 'yarn.lock'))) {
    return { command: 'yarn', prefix: ['run'] };
  }
  return { command: 'npm', prefix: ['run'] };
}

async function runScript(
  root: string,
  script: string,
  command: string,
  prefix: string[],
  timeoutMs: number,
): Promise<TestScriptResult> {
  const started = performance.now();
  return new Promise((resolve) => {
    const child = spawn(command, [...prefix, script], {
      cwd: root,
      env: process.env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    let timedOut = false;
    const append = (chunk: Buffer | string) => {
      output = `${output}${chunk.toString()}`.slice(-8_000);
    };
    child.stdout?.on('data', append);
    child.stderr?.on('data', append);
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);

    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({
        script,
        passed: false,
        exitCode: null,
        durationMs: Math.round(performance.now() - started),
        command: `${command} ${[...prefix, script].join(' ')}`,
        output,
        error: error.message,
      });
    });
    child.on('close', (exitCode) => {
      clearTimeout(timer);
      resolve({
        script,
        passed: exitCode === 0 && !timedOut,
        exitCode,
        durationMs: Math.round(performance.now() - started),
        command: `${command} ${[...prefix, script].join(' ')}`,
        output: output.trim(),
        error: timedOut ? `Test script exceeded ${timeoutMs}ms.` : undefined,
      });
    });
  });
}

export async function runApprovedTestScripts(
  root: string,
  scripts: string[],
  timeoutMs = 120_000,
): Promise<TestScriptResult[]> {
  if (scripts.length === 0) return [];

  const packagePath = join(root, 'package.json');
  if (!existsSync(packagePath)) {
    return scripts.map((script) => ({
      script,
      passed: false,
      exitCode: null,
      durationMs: 0,
      output: '',
      error: 'No package.json exists at the contracted project root.',
    }));
  }

  let packageJson: PackageJson;
  try {
    packageJson = JSON.parse(readFileSync(packagePath, 'utf8')) as PackageJson;
  } catch {
    return scripts.map((script) => ({
      script,
      passed: false,
      exitCode: null,
      durationMs: 0,
      output: '',
      error: 'The project package.json is invalid JSON.',
    }));
  }

  const approved = packageJson.scripts ?? {};
  const manager = packageManager(root, packageJson);
  const results: TestScriptResult[] = [];
  for (const script of scripts) {
    if (!Object.hasOwn(approved, script)) {
      results.push({
        script,
        passed: false,
        exitCode: null,
        durationMs: 0,
        output: '',
        error: `Script "${script}" is not declared in package.json and was not executed.`,
      });
      continue;
    }
    results.push(await runScript(
      root,
      script,
      manager.command,
      manager.prefix,
      timeoutMs,
    ));
  }
  return results;
}
