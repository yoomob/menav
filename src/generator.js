// 生成端薄入口：保持对外导出稳定，内部实现位于 src/generator/main.js
const impl = require('./generator/main');

module.exports = impl;

if (require.main === module) {
  if (typeof impl.main === 'function') {
    impl.main();
  } else {
    console.error('generator main() 未导出，无法直接执行。');
    process.exitCode = 1;
  }
}

