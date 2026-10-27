import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  Sparkles,
  Folder,
  FolderOpen,
  FileCode,
  AlertTriangle,
  Layers,
  FileQuestion,
  BarChart2,
  X,
  Loader2,
  ChevronRight,
  RefreshCw,
  Compass,
  CheckCircle2,
  HelpCircle,
  SlidersHorizontal,
  Filter,
  RotateCcw,
} from 'lucide-react';
import Section from '../ui/Section';
import Badge from '../ui/Badge';
import IconButton from '../ui/IconButton';
import Button from '../ui/Button';
import { buildFolderTree } from '../../models/folderTree';
import { NODE_KINDS, KIND_DEFINITIONS } from '../../models/graphModel';
import { normalizeFrameworks } from '../../models/frameworks';
import { SCOPE_CATEGORIES } from '../../models/scopeModel';
import { searchFilesAi } from '../../services/api';

/**
 * Left sidebar component with Search, Filters, File Tree, Architecture Health, and Overview sections.
 */
export default function Sidebar({
  model,
  selectedNode,
  onSelectNode,
  searchQuery,
  onSearchChange,
  onHighlightCycle,
  activeCycle,
  onAiSearchResults,
  viewScope,
  onToggleCategory,
  onToggleExtension,
  onSetMinFanIn,
  onToggleIsolated,
  onFocusFolder,
  onHideFolder,
  onClearFolderExcludes,
  onResetScope,
  visibleSubgraph,
  className = '',
}) {
  const [isAiSearchMode, setIsAiSearchMode] = useState(false);
  const [aiSearchLoading, setAiSearchLoading] = useState(false);
  const [aiSearchError, setAiSearchError] = useState(null);
  const [aiReasoning, setAiReasoning] = useState(null);

  // Folder tree collapsed state: Set of folder paths that user explicitly closed
  const [collapsedFolders, setCollapsedFolders] = useState(() => new Set());
  const selectedFileRef = useRef(null);

  const nodes = useMemo(() => model?.nodes || [], [model?.nodes]);
  const circular = model?.rawCircular || [];
  const metrics = model?.metrics || {};
  const analysis = model?.analysis || {};
  const metricDefinitions = model?.metricDefinitions || {};

  // Build folder tree
  const folderTree = useMemo(() => {
    return buildFolderTree(nodes);
  }, [nodes]);

  // Scroll selected file into view when selectedNode changes
  useEffect(() => {
    if (selectedNode?.id && selectedFileRef.current) {
      selectedFileRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedNode?.id]);

  const toggleFolder = (folderPath) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  // AI search submission
  const handleAiSearchSubmit = async (e) => {
    e.preventDefault();
    if (!searchQuery?.trim()) return;

    setAiSearchLoading(true);
    setAiSearchError(null);
    setAiReasoning(null);

    try {
      const nodePayload = nodes.map((n) => ({
        id: n.id,
        label: n.label,
        folder: n.folder,
      }));
      const res = await searchFilesAi({ query: searchQuery.trim(), nodes: nodePayload });
      if (res && Array.isArray(res.matches)) {
        onAiSearchResults(res.matches);
        setAiReasoning(res.reasoning || null);
      } else {
        onAiSearchResults([]);
        setAiReasoning('No relevant files found matching this description.');
      }
    } catch (err) {
      setAiSearchError(err.message || 'AI search unavailable.');
      onAiSearchResults(null);
    } finally {
      setAiSearchLoading(false);
    }
  };

  const handleClearSearch = () => {
    onSearchChange('');
    onAiSearchResults(null);
    setAiReasoning(null);
    setAiSearchError(null);
  };

  // Filtered most imported files (respecting active scope)
  const mostImportedFiles = useMemo(() => {
    const list = visibleSubgraph?.visibleNodes || nodes;
    return [...list]
      .filter((n) => (n.fanIn || 0) >= (viewScope?.minFanIn || 2))
      .sort((a, b) => (b.fanIn || 0) - (a.fanIn || 0));
  }, [visibleSubgraph?.visibleNodes, nodes, viewScope?.minFanIn]);

  // Isolated files
  const isolatedFiles = useMemo(() => {
    return nodes.filter((n) => n.nodeKind === NODE_KINDS.ISOLATED);
  }, [nodes]);

  // Render tree item recursively (only if parent is expanded)
  const renderTreeItem = (item, depth = 0) => {
    const isFolder = item.type === 'folder';
    const paddingLeft = `${depth * 12 + 6}px`;

    if (isFolder) {
      const isOpen = !collapsedFolders.has(item.path);
      return (
        <div key={item.path} className="select-none">
          <div
            style={{ paddingLeft }}
            className="group w-full flex items-center justify-between py-1 pr-2 text-xs text-content-secondary hover:text-content-primary hover:bg-surface-raised rounded-sm transition-colors duration-fast"
          >
            <button
              type="button"
              onClick={() => toggleFolder(item.path)}
              className="flex items-center gap-1.5 min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
            >
              <ChevronRight
                className={`w-3.5 h-3.5 text-content-muted shrink-0 transition-transform duration-fast ${
                  isOpen ? 'rotate-90' : ''
                }`}
                aria-hidden="true"
              />
              {isOpen ? (
                <FolderOpen className="w-3.5 h-3.5 text-accent shrink-0" aria-hidden="true" />
              ) : (
                <Folder className="w-3.5 h-3.5 text-content-muted shrink-0" aria-hidden="true" />
              )}
              <span className="truncate font-medium">{item.name}</span>
            </button>
            <div className="flex items-center gap-1">
              <div className="hidden group-hover:flex items-center gap-1">
                <button
                  type="button"
                  title={`Focus folder ${item.path}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onFocusFolder && onFocusFolder(item.path);
                  }}
                  className="px-1 py-0.5 text-[9px] rounded-xs bg-accent/20 hover:bg-accent text-white font-mono"
                >
                  Focus
                </button>
                <button
                  type="button"
                  title={`Hide folder ${item.path}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onHideFolder && onHideFolder(item.path);
                  }}
                  className="px-1 py-0.5 text-[9px] rounded-xs bg-surface-overlay hover:bg-rose-500/30 text-content-muted hover:text-rose-300 font-mono"
                >
                  Hide
                </button>
              </div>
              <span className="text-[11px] text-content-muted font-mono ml-1">
                {item.fileCount}
              </span>
            </div>
          </div>

          {isOpen && item.children && (
            <div>
              {item.children.map((child) => renderTreeItem(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    // File item
    const isSelected = selectedNode?.id === item.id;
    const kind = item.node?.nodeKind || NODE_KINDS.NORMAL;
    const kindDef = KIND_DEFINITIONS[kind] || KIND_DEFINITIONS[NODE_KINDS.NORMAL];

    return (
      <div
        key={item.id}
        ref={isSelected ? selectedFileRef : null}
        style={{ paddingLeft }}
        className="select-none"
      >
        <button
          type="button"
          onClick={() => onSelectNode(item.node)}
          className={`w-full flex items-center justify-between py-1 pr-2 text-xs rounded-sm transition-colors duration-fast focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ${
            isSelected
              ? 'bg-accent/20 text-content-primary font-medium border-l-2 border-accent'
              : 'text-content-secondary hover:text-content-primary hover:bg-surface-raised'
          }`}
          title={`${item.id} (${kindDef.label}, fan-in: ${item.node?.fanIn || 0})`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: kindDef.colorHex }}
              aria-hidden="true"
            />
            <span className="truncate font-mono text-[11px]">{item.name}</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {kind !== NODE_KINDS.NORMAL && (
              <span
                className="text-[10px] uppercase tracking-wider px-1 py-0.2 rounded font-semibold"
                style={{
                  backgroundColor: `${kindDef.colorHex}20`,
                  color: kindDef.colorHex,
                  border: `1px solid ${kindDef.colorHex}40`,
                }}
              >
                {kind}
              </span>
            )}
            {item.node?.fanIn > 0 && (
              <span className="text-[11px] text-content-muted font-mono" title={`${item.node.fanIn} incoming dependents`}>
                ↓{item.node.fanIn}
              </span>
            )}
          </div>
        </button>
      </div>
    );
  };

  return (
    <aside className={`flex flex-col bg-surface-panel border-r border-border-subtle overflow-y-auto select-none ${className}`}>
      {/* 1. Search Section */}
      <div className="p-3 border-b border-border-subtle bg-surface-panel shrink-0">
        <div className="flex items-center justify-between gap-2 mb-2">
          <label htmlFor="repo-search-input" className="text-xs font-semibold uppercase tracking-wider text-content-primary">
            Search Files
          </label>
          <button
            type="button"
            onClick={() => {
              setIsAiSearchMode(!isAiSearchMode);
              handleClearSearch();
            }}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium border transition-colors duration-fast ${
              isAiSearchMode
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                : 'bg-surface-raised text-content-secondary border-border-default hover:text-content-primary'
            }`}
            title="Toggle Gemini natural-language search"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" aria-hidden="true" />
            <span>AI Search</span>
          </button>
        </div>

        <form onSubmit={isAiSearchMode ? handleAiSearchSubmit : (e) => e.preventDefault()}>
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-content-muted absolute left-2.5 pointer-events-none" aria-hidden="true" />
            <input
              id="repo-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={isAiSearchMode ? 'e.g. auth middleware or logger...' : 'Filter files by name...'}
              className="w-full h-8 pl-8 pr-7 text-xs bg-surface-raised border border-border-default focus:border-accent text-content-primary rounded-sm placeholder:text-content-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                aria-label="Clear search"
                className="absolute right-2 text-content-muted hover:text-content-primary"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          {isAiSearchMode && (
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[11px] text-content-muted">Press Enter to run AI query</span>
              <Button
                size="sm"
                variant="primary"
                type="submit"
                disabled={aiSearchLoading || !searchQuery?.trim()}
                className="h-6 text-xs px-2"
              >
                {aiSearchLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Search'}
              </Button>
            </div>
          )}
        </form>

        {aiSearchError && (
          <p className="text-xs text-red-400 mt-2 bg-red-500/10 p-1.5 rounded-sm border border-red-500/20">
            {aiSearchError}
          </p>
        )}

        {aiReasoning && (
          <div className="mt-2 text-xs text-purple-300 bg-purple-500/10 p-2 rounded-sm border border-purple-500/20 leading-relaxed">
            <span className="font-semibold block text-[10px] uppercase tracking-wider text-purple-400 mb-0.5">Gemini Insight</span>
            {aiReasoning}
          </div>
        )}
      </div>

      {/* 2. Graph Scope & Filters Section */}
      <Section
        id="scope-filters"
        title="Graph Scope & Filters"
        icon={SlidersHorizontal}
        defaultOpen={true}
        badge={
          visibleSubgraph?.hiddenCounts?.total > 0 ? (
            <span className="text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded font-mono">
              {visibleSubgraph.hiddenCounts.total} hidden
            </span>
          ) : null
        }
      >
        <div className="space-y-3 pt-1 text-xs">
          {/* Categories */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-content-secondary">Categories</span>
              <span className="text-[10px] text-content-muted italic">heuristic</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { key: SCOPE_CATEGORIES.SOURCE, label: 'Source', count: visibleSubgraph?.categoryCounts?.source ?? 0, color: 'text-emerald-400' },
                { key: SCOPE_CATEGORIES.TEST, label: 'Tests', count: visibleSubgraph?.categoryCounts?.test ?? 0, color: 'text-amber-400' },
                { key: SCOPE_CATEGORIES.EXAMPLE, label: 'Examples', count: visibleSubgraph?.categoryCounts?.example ?? 0, color: 'text-blue-400' },
                { key: SCOPE_CATEGORIES.TOOLING, label: 'Tooling', count: visibleSubgraph?.categoryCounts?.tooling ?? 0, color: 'text-purple-400' },
              ].map(({ key, label, count, color }) => {
                const isChecked = viewScope?.categories ? viewScope.categories.has(key) : true;
                return (
                  <label
                    key={key}
                    className={`flex items-center justify-between p-1.5 rounded-sm border cursor-pointer select-none transition-colors ${
                      isChecked
                        ? 'bg-surface-raised border-border-default'
                        : 'bg-surface-app/40 border-border-subtle opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => onToggleCategory && onToggleCategory(key)}
                        className="rounded-xs border-border-default text-accent focus:ring-0 w-3 h-3"
                      />
                      <span className={`truncate text-[11px] font-medium ${color}`}>{label}</span>
                    </div>
                    <span className="text-[10px] font-mono text-content-muted ml-1">{count}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Extension Chips */}
          {visibleSubgraph?.extensionCounts && Object.keys(visibleSubgraph.extensionCounts).length > 0 && (
            <div>
              <span className="font-semibold text-content-secondary block mb-1">Extensions</span>
              <div className="flex flex-wrap gap-1">
                {Object.entries(visibleSubgraph.extensionCounts)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 8)
                  .map(([ext, count]) => {
                    const isSelected = viewScope?.extensions && viewScope.extensions.has(ext);
                    return (
                      <button
                        key={ext}
                        type="button"
                        onClick={() => onToggleExtension && onToggleExtension(ext)}
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded-sm border transition-colors ${
                          isSelected
                            ? 'bg-accent/20 border-accent text-accent font-semibold'
                            : 'bg-surface-raised border-border-subtle text-content-secondary hover:border-border-default'
                        }`}
                      >
                        {ext} ({count})
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Min Fan-in Control */}
          <div className="flex items-center justify-between">
            <label htmlFor="min-fan-in" className="text-content-secondary">
              Min Fan-In: <span className="font-mono text-content-primary">{viewScope?.minFanIn || 0}</span>
            </label>
            <input
              id="min-fan-in"
              type="range"
              min="0"
              max="15"
              step="1"
              value={viewScope?.minFanIn || 0}
              onChange={(e) => onSetMinFanIn && onSetMinFanIn(parseInt(e.target.value, 10))}
              className="w-24 accent-accent cursor-pointer"
            />
          </div>

          {/* Isolated Files Toggle */}
          <label className="flex items-center justify-between cursor-pointer select-none">
            <span className="text-content-secondary">Show isolated files on canvas</span>
            <input
              type="checkbox"
              checked={Boolean(viewScope?.showIsolated)}
              onChange={(e) => onToggleIsolated && onToggleIsolated(e.target.checked)}
              className="rounded-xs border-border-default text-accent focus:ring-0 w-3.5 h-3.5"
            />
          </label>

          {/* Active Folder Filter Badges */}
          {(viewScope?.folderInclude || (viewScope?.folderExclude && viewScope.folderExclude.size > 0)) && (
            <div className="p-1.5 rounded-sm bg-surface-overlay text-[10px] space-y-1">
              {viewScope.folderInclude && (
                <div className="flex items-center justify-between text-accent">
                  <span className="truncate">Focus: {viewScope.folderInclude}</span>
                  <button type="button" onClick={() => onFocusFolder && onFocusFolder(null)} className="underline ml-1">Clear</button>
                </div>
              )}
              {viewScope?.folderExclude && viewScope.folderExclude.size > 0 && (
                <div className="flex items-center justify-between text-content-muted">
                  <span>Excluded folders: {viewScope.folderExclude.size}</span>
                  <button type="button" onClick={() => onClearFolderExcludes && onClearFolderExcludes()} className="underline ml-1">Reset</button>
                </div>
              )}
            </div>
          )}

          {/* Reset Filters */}
          <Button
            size="sm"
            variant="ghost"
            onClick={onResetScope}
            className="w-full text-xs text-content-muted hover:text-content-primary flex items-center justify-center gap-1.5 py-1"
          >
            <RotateCcw className="w-3 h-3" aria-hidden="true" />
            <span>Reset Scope & Filters</span>
          </Button>
        </div>
      </Section>

      {/* 3. Files Section (Lazy Folder Tree) */}
      <Section
        title="Files"
        icon={Folder}
        badge={nodes.length}
        defaultOpen={true}
      >
        <div className="mt-1 max-h-[360px] overflow-y-auto pr-1">
          {folderTree.length === 0 ? (
            <p className="text-xs text-content-muted italic py-2">No files in graph.</p>
          ) : (
            folderTree.map((item) => renderTreeItem(item, 0))
          )}
        </div>
      </Section>

      {/* 3. Architecture Health Section */}
      <Section
        title="Architecture Health"
        icon={AlertTriangle}
        badge={circular.length > 0 ? `${circular.length} cycles` : 'Healthy'}
        defaultOpen={true}
      >
        <div className="space-y-4 pt-1">
          {/* Circular Dependencies */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-content-secondary flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-rose-400" aria-hidden="true" />
                Circular Dependencies
              </span>
              <Badge variant={circular.length > 0 ? 'cycle' : 'success'}>
                {circular.length}
              </Badge>
            </div>

            {circular.length === 0 ? (
              <p className="text-xs text-content-muted bg-surface-raised p-2 rounded-sm border border-border-subtle">
                No circular dependencies detected.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {circular.map((cycle, idx) => {
                  const isActive = activeCycle === cycle;
                  const cycleChain = cycle.join(' → ');
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => onHighlightCycle(isActive ? null : cycle)}
                      className={`w-full text-left p-2 rounded-sm border text-xs font-mono transition-colors duration-fast ${
                        isActive
                          ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                          : 'bg-surface-raised border-border-subtle text-content-secondary hover:text-content-primary hover:border-border-default'
                      }`}
                      title={cycleChain}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1 font-sans text-[11px]">
                        <span className="font-semibold text-rose-400">Cycle #{idx + 1} ({cycle.length} steps)</span>
                        <span className="text-[10px] text-content-muted">{isActive ? 'Active' : 'Highlight'}</span>
                      </div>
                      <div className="truncate text-[11px] text-content-muted">
                        {cycleChain}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Most Imported Files (fanIn >= 2) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-content-secondary flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-purple-400" aria-hidden="true" />
                Most Imported Files (Fan-in ≥ 2)
              </span>
              <span className="text-xs text-content-muted font-mono">{mostImportedFiles.length}</span>
            </div>

            {mostImportedFiles.length === 0 ? (
              <p className="text-xs text-content-muted bg-surface-raised p-2 rounded-sm border border-border-subtle">
                No files with 2+ imports.
              </p>
            ) : (
              <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                {mostImportedFiles.slice(0, 8).map((file) => (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => onSelectNode(file)}
                    className="w-full flex items-center justify-between p-1.5 rounded-sm hover:bg-surface-raised text-xs text-content-secondary hover:text-content-primary transition-colors duration-fast text-left"
                    title={file.id}
                  >
                    <span className="truncate font-mono text-[11px]">{file.id}</span>
                    <Badge variant="important" className="ml-2 shrink-0">
                      ↓{file.fanIn}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Isolated Files */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-content-secondary flex items-center gap-1.5">
                <FileQuestion className="w-3.5 h-3.5 text-content-muted" aria-hidden="true" />
                Isolated Files
              </span>
              <Badge variant="isolated">{isolatedFiles.length}</Badge>
            </div>
            <p className="text-[11px] text-content-muted leading-tight mb-1.5">
              No imports in or out in the JS/TS graph. (Note: Isolation in the import graph does not prove a file is unused).
            </p>
            {isolatedFiles.length > 0 && (
              <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                {isolatedFiles.slice(0, 6).map((file) => (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => onSelectNode(file)}
                    className="w-full text-left truncate p-1 rounded-sm hover:bg-surface-raised text-xs font-mono text-content-muted hover:text-content-primary"
                    title={file.id}
                  >
                    {file.id}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* 4. Overview Section (Real Metrics) */}
      <Section
        title="Overview"
        icon={BarChart2}
        defaultOpen={false}
      >
        <div className="space-y-2 pt-1 text-xs">
          <div className="flex items-center justify-between py-1 border-b border-border-subtle" title={metricDefinitions.supportedSourceFiles || 'Source files included in dependency analysis'}>
            <span className="text-content-secondary">Files in Graph (JS/TS):</span>
            <span className="font-mono font-semibold text-content-primary">{nodes.length}</span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-border-subtle" title={metricDefinitions['files.total'] || metricDefinitions.totalFiles || 'Total files found in repository clone'}>
            <span className="text-content-secondary">Total Repository Files:</span>
            <span className="font-mono text-content-primary">{(metrics.files?.total ?? metrics.totalFiles) ?? '—'}</span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-border-subtle" title="Total import edges between modules">
            <span className="text-content-secondary">Graph Edges:</span>
            <span className="font-mono text-content-primary">{model?.rawEdges?.length || 0}</span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-border-subtle" title={metricDefinitions['loc.total'] || metricDefinitions.sourceLoc || 'Physical lines of code in analyzed JS/TS source files'}>
            <span className="text-content-secondary">Source LOC (JS/TS):</span>
            <span className="font-mono text-content-primary">
              {(metrics.loc?.total ?? metrics.sourceLoc) != null ? (metrics.loc?.total ?? metrics.sourceLoc).toLocaleString() : '—'}
            </span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-border-subtle" title={metricDefinitions['graph.circularCount'] || metricDefinitions.circularCount || 'Circular dependency chains'}>
            <span className="text-content-secondary">Circular Dependency Chains:</span>
            <span className="font-mono text-content-primary">{circular.length}</span>
          </div>

          {normalizeFrameworks(metrics.frameworks).length > 0 && (
            <div className="py-1 border-b border-border-subtle">
              <span className="text-content-secondary block mb-1">Detected Frameworks:</span>
              <div className="flex flex-wrap gap-1.5">
                {normalizeFrameworks(metrics.frameworks).map((fw) => (
                  <Badge
                    key={fw.key}
                    variant="default"
                    title={`Evidence: ${fw.evidence}`}
                  >
                    {fw.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {analysis.unsupported && analysis.unsupported.length > 0 && (
            <div className="py-1">
              <span className="text-content-secondary block mb-1">Other Extensions in Repo:</span>
              <div className="flex flex-wrap gap-1">
                {analysis.unsupported.slice(0, 8).map((u, i) => (
                  <span key={i} className="text-[11px] font-mono text-content-muted bg-surface-raised px-1.5 py-0.5 rounded-sm">
                    {u.ext || 'other'} ({u.count})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </Section>
    </aside>
  );
}
