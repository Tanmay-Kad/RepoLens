/**
 * Pure module to group node ids into a hierarchical folder tree with per-folder file counts.
 * Optimized for performance on large repositories (2000+ files).
 */

/**
 * Builds a folder tree from a list of nodes.
 *
 * @param {Array<Object>} nodes - Array of node objects with an `id` field representing the relative path.
 * @returns {Array<Object>} Sorted list of top-level folder and file tree nodes.
 */
export function buildFolderTree(nodes = []) {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return [];
  }

  // Root map of subdirectories/files
  const root = {
    name: '',
    path: '',
    type: 'folder',
    fileCount: 0,
    childrenMap: new Map(),
  };

  for (const node of nodes) {
    if (!node || !node.id) continue;

    const normalizedPath = String(node.id).replace(/\\/g, '/');
    const parts = normalizedPath.split('/').filter(Boolean);

    let current = root;
    let accumulatedPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      accumulatedPath = accumulatedPath ? `${accumulatedPath}/${part}` : part;

      if (isFile) {
        current.childrenMap.set(part, {
          type: 'file',
          name: part,
          path: accumulatedPath,
          id: node.id,
          node,
        });
      } else {
        if (!current.childrenMap.has(part)) {
          current.childrenMap.set(part, {
            type: 'folder',
            name: part,
            path: accumulatedPath,
            fileCount: 0,
            childrenMap: new Map(),
          });
        }
        current = current.childrenMap.get(part);
      }
    }
  }

  // Recursive converter from Map structure to sorted array with file counts
  function convertAndSort(entry) {
    const children = [];
    let totalFiles = 0;

    for (const child of entry.childrenMap.values()) {
      if (child.type === 'file') {
        children.push(child);
        totalFiles += 1;
      } else {
        const processedFolder = convertAndSort(child);
        children.push(processedFolder);
        totalFiles += processedFolder.fileCount;
      }
    }

    // Stable sort: Folders first (A-Z), then Files (A-Z)
    children.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });

    return {
      type: 'folder',
      name: entry.name,
      path: entry.path,
      fileCount: totalFiles,
      children,
    };
  }

  const processedRoot = convertAndSort(root);
  return processedRoot.children;
}
