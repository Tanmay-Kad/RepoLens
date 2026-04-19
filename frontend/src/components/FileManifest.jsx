import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, FileCode, Settings2 } from 'lucide-react';

export default function FileManifest({ graphData, onSelect, currentSelection, searchQuery }) {
  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'asc' });

  const files = useMemo(() => {
    if (!graphData?.nodes) return [];
    
    return graphData.nodes.map(node => {
      const dependencies = graphData.edges.filter(e => e.source === node.id).length;
      const dependents   = graphData.edges.filter(e => e.target === node.id).length;
      const impactScore  = Math.min(100, (dependents * 7) + (dependencies * 3));
      const isConfig     = Boolean(node.isConfig);
      // Config nodes use .label; source nodes use last path segment
      const displayName  = isConfig ? (node.label || node.id) : node.id.split('/').pop();
      const displayPath  = isConfig ? (node.filePath || node.label || node.id) : node.id;
      
      return {
        id: node.id,
        name: displayName,
        path: displayPath,
        isConfig,
        configType: node.type || null,
        dependencies,
        dependents,
        impactScore,
      };
    }).filter(file =>
      file.path.toLowerCase().includes((searchQuery || '').toLowerCase()) ||
      file.name.toLowerCase().includes((searchQuery || '').toLowerCase())
    );
  }, [graphData, searchQuery]);

  const sortedFiles = useMemo(() => {
    const items = [...files];
    if (sortConfig.key) {
      items.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return items;
  }, [files, sortConfig]);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) return <ChevronUp className="w-3 h-3 opacity-20" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 text-blue-400" /> : <ChevronDown className="w-3 h-3 text-blue-400" />;
  };

  return (
    <div className="h-full flex flex-col p-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">File Manifest</h2>
          <p className="text-xs text-slate-500 italic">Centralized registry of all detected source components and their coupling metrics.</p>
        </div>
        <div className="text-[10px] bg-white/5 border border-white/10 px-3 py-1.5 rounded-full text-slate-400">
          Showing <span className="text-blue-400 font-bold">{sortedFiles.length}</span> modules
          <span className="ml-2 text-amber-400 font-bold">{sortedFiles.filter(f => f.isConfig).length} config</span>
        </div>
      </div>

      <div className="flex-1 overflow-hidden border border-white/5 rounded-2xl bg-[#0f172a]/40 shadow-2xl flex flex-col min-h-0">
        <div className="overflow-x-auto overflow-y-auto custom-scrollbar flex-1">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead className="sticky top-0 z-10 bg-[#1e293b] border-b border-white/10">
              <tr>
                <th 
                  className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={() => requestSort('id')}
                >
                  <div className="flex items-center gap-2">File Path <SortIcon column="id" /></div>
                </th>
                <th 
                  className="px-4 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-center cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={() => requestSort('dependencies')}
                >
                  <div className="flex items-center justify-center gap-2">Deps <SortIcon column="dependencies" /></div>
                </th>
                <th 
                  className="px-4 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-center cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={() => requestSort('dependents')}
                >
                  <div className="flex items-center justify-center gap-2">Used By <SortIcon column="dependents" /></div>
                </th>
                <th 
                  className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-right cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={() => requestSort('impactScore')}
                >
                  <div className="flex items-center justify-end gap-2">Impact <SortIcon column="impactScore" /></div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sortedFiles.map(file => (
                <tr 
                  key={file.id} 
                  onClick={() => onSelect(file)}
                  className={`group cursor-pointer transition-all duration-200 ${
                    currentSelection?.id === file.id
                      ? 'bg-blue-500/10 border-l-4 border-l-blue-500'
                      : file.isConfig
                        ? 'border-l-4 border-l-amber-500/40 hover:bg-amber-500/5'
                        : 'hover:bg-white/5 border-l-4 border-l-transparent'
                  }`}
                >
                  <td className="px-6 py-4 truncate max-w-sm">
                    <div className="flex items-center gap-3">
                      {file.isConfig
                        ? <Settings2 className={`w-4 h-4 shrink-0 ${currentSelection?.id === file.id ? 'text-amber-400' : 'text-amber-500/60 group-hover:text-amber-400'}`} />
                        : <FileCode className={`w-4 h-4 shrink-0 ${currentSelection?.id === file.id ? 'text-blue-400' : 'text-slate-500 group-hover:text-blue-400'}`} />
                      }
                      <div className="min-w-0">
                        <span className={`text-xs font-medium block truncate ${
                          currentSelection?.id === file.id ? 'text-blue-200' : 'text-slate-300 group-hover:text-white'
                        }`}>{file.path}</span>
                        {file.isConfig && (
                          <span className="text-[9px] text-amber-400/70 font-mono">{file.configType} · config</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="text-[11px] font-mono text-slate-400">{file.dependencies}</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="text-[11px] font-mono text-slate-400">{file.dependents}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <span className={`text-[11px] font-bold min-w-[24px] ${file.impactScore >= 70 ? 'text-red-400' : file.impactScore >= 35 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                        {file.impactScore}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
