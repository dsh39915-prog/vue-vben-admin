import { spawnSync } from 'node:child_process';

import isCI from 'is-ci';

if (!isCI) {
  const gitVersion = spawnSync('git', ['--version'], { encoding: 'utf8' });
  const version = gitVersion.stdout?.match(/git version (\d+)\.(\d+)/);
  const hasSupportedGit =
    version &&
    (Number(version[1]) > 2 ||
      (Number(version[1]) === 2 && Number(version[2]) >= 31));

  if (hasSupportedGit) {
    const repository = spawnSync('git', ['rev-parse', '--git-dir'], {
      stdio: 'ignore',
    });

    if (repository.status === 0) {
      const result = spawnSync('pnpm exec lefthook install', {
        shell: true,
        stdio: 'inherit',
      });
      process.exitCode = result.status ?? 1;
    }
  } else {
    console.warn(
      'Skipping Git hooks: Lefthook requires Git >= 2.31. Upgrade Git and run pnpm exec lefthook install to enable hooks.',
    );
  }
}
