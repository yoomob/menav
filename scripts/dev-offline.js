const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { createLogger, isVerbose, startTimer } = require('../src/generator/utils/logger');
const { startServer } = require('./serve-dist');

const log = createLogger('dev:offline');
let serverRef = null;

function runNode(scriptPath) {
  const result = spawnSync(process.execPath, [scriptPath], { stdio: 'inherit' });
  return result && Number.isFinite(result.status) ? result.status : 1;
}

async function main() {
  const elapsedMs = startTimer();
  log.info('开始', { version: process.env.npm_package_version });

  const repoRoot = path.resolve(__dirname, '..');
  const generatorPath = path.join(repoRoot, 'src', 'generator.js');

  const exitCode = runNode(generatorPath);
  if (exitCode !== 0) {
    log.error('生成失败', { exit: exitCode });
    process.exitCode = exitCode;
    return;
  }

  const portRaw = process.env.PORT || process.env.MENAV_PORT || '5173';
  const port = Number.parseInt(portRaw, 10) || 5173;
  const { server, port: actualPort } = await startServer({
    rootDir: path.join(repoRoot, 'dist'),
    host: process.env.HOST || '0.0.0.0',
    port,
  });
  serverRef = server;

  log.ok('就绪', { ms: elapsedMs(), url: `http://localhost:${actualPort}` });

  const shutdown = () => {
    log.info('正在关闭...');
    if (!serverRef) process.exit(0);
    serverRef.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (require.main === module) {
  main().catch((error) => {
    log.error('启动失败', { message: error && error.message ? error.message : String(error) });
    if (isVerbose() && error && error.stack) console.error(error.stack);
    process.exitCode = 1;
  });
}
