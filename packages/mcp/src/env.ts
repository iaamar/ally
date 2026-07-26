import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config } from 'dotenv';

export interface EnvironmentBootstrap {
  attempted: boolean;
  loaded: boolean;
  path?: string;
  error?: string;
}

let bootstrap: EnvironmentBootstrap = { attempted: false, loaded: false };

export function loadMcpEnvironment(
  envFile = process.env.ALLY_ENV_FILE,
): EnvironmentBootstrap {
  if (!envFile?.trim()) {
    bootstrap = { attempted: false, loaded: false };
    return bootstrap;
  }

  const path = resolve(envFile);
  if (!existsSync(path)) {
    bootstrap = {
      attempted: true,
      loaded: false,
      path,
      error: 'The configured ALLY_ENV_FILE does not exist.',
    };
    return bootstrap;
  }

  const result = config({ path, override: false, quiet: true });
  bootstrap = result.error
    ? {
        attempted: true,
        loaded: false,
        path,
        error: result.error.message,
      }
    : { attempted: true, loaded: true, path };
  return bootstrap;
}

export function getEnvironmentBootstrap(): EnvironmentBootstrap {
  return { ...bootstrap };
}
