/**
 * Normalizes metrics.frameworks into a consistent list of items for UI rendering.
 * Handles the backend array schema [{ name: string, evidencePath: string }]
 * as well as legacy/fallback object maps { [name]: { evidence: string } }.
 *
 * @param {Array<{ name: string, evidencePath?: string, evidence?: string }>|Record<string, any>|null|undefined} frameworks
 * @returns {Array<{ name: string, evidence: string, key: string }>}
 */
export function normalizeFrameworks(frameworks) {
  if (!frameworks) return [];

  if (Array.isArray(frameworks)) {
    return frameworks
      .map((fw, idx) => {
        if (!fw) return null;
        const name = typeof fw === 'string' ? fw : fw.name;
        if (!name) return null;
        const evidence =
          typeof fw === 'object'
            ? fw.evidencePath || fw.evidence || 'package.json'
            : 'package.json';
        return {
          name,
          evidence,
          key: `${name}-${idx}`,
        };
      })
      .filter(Boolean);
  }

  if (typeof frameworks === 'object') {
    return Object.entries(frameworks)
      .map(([name, data]) => {
        if (!name) return null;
        const evidence =
          (typeof data === 'object' && data !== null
            ? data.evidencePath || data.evidence
            : null) || 'package.json';
        return {
          name,
          evidence,
          key: name,
        };
      })
      .filter(Boolean);
  }

  return [];
}
