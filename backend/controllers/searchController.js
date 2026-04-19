import fs from 'fs';
import path from 'path';
import Repository from '../models/Repository.js';

const ALLOWED_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.json', '.md', '.html', '.css']);
const EXCLUDED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage']);

async function walkDir(dir, callback) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (EXCLUDED_DIRS.has(file)) continue;
    const filepath = path.join(dir, file);
    const stat = fs.statSync(filepath);
    if (stat.isDirectory()) {
      await walkDir(filepath, callback);
    } else {
      callback(filepath);
    }
  }
}

export const searchCodebase = async (req, res) => {
  const { repoId } = req.params;
  const { q, filter } = req.query;

  if (!q || q.trim().length === 0) {
    return res.status(200).json({ results: [] });
  }

  try {
    const repo = await Repository.findById(repoId);
    if (!repo || !repo.localPath || !fs.existsSync(repo.localPath)) {
      return res.status(404).json({ error: 'Repository clone not found.' });
    }

    const queryLower = q.toLowerCase();
    const results = [];
    const absoluteBasePath = path.resolve(repo.localPath);
    let matchCount = 0;

    await walkDir(absoluteBasePath, (filepath) => {
      if (matchCount >= 50) return; // Cap results for performance
      
      const ext = path.extname(filepath).toLowerCase();
      if (!ALLOWED_EXTENSIONS.has(ext)) return;

      const relativePath = path.relative(absoluteBasePath, filepath).replace(/\\/g, '/');
      const filename = path.basename(filepath);

      // Filter: Files
      if (filter === 'Files') {
        if (filename.toLowerCase().includes(queryLower)) {
          results.push({ file: relativePath, matches: [] });
          matchCount++;
        }
        return;
      }

      // Determine Regex for 'Functions' vs 'Full text'
      let isMatch = false;
      const fileMatches = [];
      const content = fs.readFileSync(filepath, 'utf-8');
      const lines = content.split('\n');

      if (filter === 'Functions') {
        const functionRegex = new RegExp(`(?:function|class)\\s+${queryLower}|(?:const|let|var)\\s+${queryLower}\\s*=\\s*(?:async\\s*)?(?:function|\\(.*\\)\\s*=>)`, 'i');
        
        for (let i = 0; i < lines.length; i++) {
          if (functionRegex.test(lines[i])) {
            fileMatches.push({ line: i + 1, snippet: lines[i].trim() });
            isMatch = true;
          }
        }
      } else {
        // Full text or any other filter defaults to generic text search
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(queryLower)) {
            fileMatches.push({ line: i + 1, snippet: lines[i].trim() });
            isMatch = true;
          }
        }
      }

      if (isMatch) {
        results.push({ file: relativePath, matches: fileMatches });
        matchCount++;
      }
    });

    res.status(200).json({ results, totalCount: matchCount });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to search codebase' });
  }
};
