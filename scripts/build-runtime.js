const path = require('node:path');
const fs = require('node:fs');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

async function main() {
  let esbuild;
  try {
    esbuild = require('esbuild');
  } catch (error) {
    console.error('未找到 esbuild，请先执行 npm install。');
    process.exitCode = 1;
    return;
  }

  const projectRoot = path.resolve(__dirname, '..');
  const entry = path.join(projectRoot, 'src', 'runtime', 'index.js');
  const outFile = path.join(projectRoot, 'dist', 'script.js');

  if (!fs.existsSync(entry)) {
    console.error(`运行时入口不存在：${path.relative(projectRoot, entry)}`);
    process.exitCode = 1;
    return;
  }

  ensureDir(path.dirname(outFile));

  try {
    const result = await esbuild.build({
      entryPoints: [entry],
      outfile: outFile,
      bundle: true,
      platform: 'browser',
      format: 'iife',
      target: ['es2018'],
      sourcemap: false,
      minify: true,
      legalComments: 'none',
      metafile: true,
      logLevel: 'info',
    });

    const outputs = result && result.metafile && result.metafile.outputs ? result.metafile.outputs : null;
    const outKey = outputs ? Object.keys(outputs).find((k) => k.endsWith('dist/script.js')) : '';
    const bytes = outKey && outputs && outputs[outKey] ? outputs[outKey].bytes : 0;
    if (bytes) {
      console.log(`✅ runtime bundle 完成：dist/script.js (${bytes} bytes)`);
    } else {
      console.log('✅ runtime bundle 完成：dist/script.js');
    }
  } catch (error) {
    console.error('❌ runtime bundle 失败（禁止回退旧产物）：', error && error.message ? error.message : error);
    process.exitCode = 1;
  }
}

main();

