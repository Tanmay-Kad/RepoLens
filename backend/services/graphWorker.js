import { parentPort, workerData } from 'node:worker_threads';
import madge from 'madge';

async function runWorker() {
  if (!workerData || !workerData.targetDir) {
    parentPort.postMessage({
      success: false,
      error: 'Worker missing targetDir in workerData',
    });
    return;
  }

  const { targetDir, tsConfigPath } = workerData;

  const madgeConfig = {
    includeNpm: false,
    fileExtensions: ['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs'],
    excludeRegExp: [
      /(^|[/\\])(\.git|node_modules|dist|build|out|coverage|\.next|vendor|bower_components)([/\\]|$)/,
      /\.min\.[^./\\]+$/,
    ],
  };

  if (typeof tsConfigPath === 'string' && tsConfigPath.trim().length > 0) {
    madgeConfig.tsConfig = tsConfigPath.trim();
  }

  try {
    const resMadge = await madge(targetDir, madgeConfig);
    const rawTree = resMadge.obj();
    const circular = resMadge.circular();
    const warnings = resMadge.warnings()?.skipped || [];

    parentPort.postMessage({
      success: true,
      result: {
        rawTree,
        circular,
        warnings,
      },
    });
  } catch (err) {
    parentPort.postMessage({
      success: false,
      error: err?.message || 'Madge extraction error',
    });
  }
}

runWorker().catch((err) => {
  if (parentPort) {
    parentPort.postMessage({
      success: false,
      error: err?.message || 'Unexpected worker execution error',
    });
  }
});
