import { execFileSync } from 'node:child_process';

export default async function globalSetup() {
  execFileSync('pnpm', ['-C', 'apps/desktop', 'build'], {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
  execFileSync('pnpm', ['-C', 'apps/pro-desktop', 'build'], {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
}
