import React, { useState, useEffect, useCallback, useMemo } from 'react';
import TopBar from './TopBar';
import Sidebar from './Sidebar';
import GraphCanvas from './GraphCanvas';
import DetailsPanel from './DetailsPanel';
import PanelSeparator from './PanelSeparator';
import StateMessage from '../ui/StateMessage';
import Button from '../ui/Button';
import { useRepoGraph } from './useRepoGraph';
import { GRAPH_LAYOUTS } from '../../models/layoutPacking';
import {
  createDefaultScope,
  filterGraphByScope,
  formatScopeBanner,
  SCOPE_CATEGORIES,
} from '../../models/scopeModel';
import { computeNeighborhood, FOCUS_DIRECTIONS } from '../../models/focusModel';

const STORAGE_KEYS = {
  SIDEBAR_WIDTH: 'repolens:sidebar_width',
  DETAILS_WIDTH: 'repolens:details_width',
  SIDEBAR_OPEN: 'repolens:sidebar_open',
  DETAILS_OPEN: 'repolens:details_open',
  LAYOUT_MODE: 'repolens:layout_mode',
};

function readStorage(key, fallback) {
  try {
    const val = localStorage.getItem(key);
    return val !== null ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    // Storage quota or disabled in private browsing
  }
}

function readSessionStorage(key, fallback) {
  try {
    const val = sessionStorage.getItem(key);
    return val !== null ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
}

function writeSessionStorage(key, val) {
  try {
    sessionStorage.setItem(key, JSON.stringify(val));
  } catch {
    // Storage quota or disabled in private browsing
  }
}

/**
 * Three-panel workspace shell with dynamic scope filtering, Focus mode,
 * multi-layout selection, and accessible shortcuts.
 */
export default function Workspace({ repoId, onNavigateHome }) {
  const { loading, error, graphData, model, reload } = useRepoGraph(repoId);

  // Layout state
  const [sidebarWidth, setSidebarWidth] = useState(() => readStorage(STORAGE_KEYS.SIDEBAR_WIDTH, 300));
  const [detailsWidth, setDetailsWidth] = useState(() => readStorage(STORAGE_KEYS.DETAILS_WIDTH, 340));
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => readStorage(STORAGE_KEYS.SIDEBAR_OPEN, true));
  const [isDetailsOpen, setIsDetailsOpen] = useState(() => readStorage(STORAGE_KEYS.DETAILS_OPEN, false));

  // Layout engine state (persisted per session)
  const [layoutMode, setLayoutMode] = useState(() =>
    readSessionStorage(STORAGE_KEYS.LAYOUT_MODE, GRAPH_LAYOUTS.FORCE)
  );

  // Mobile / small viewport drawer state (<1024px)
  const [isMobile, setIsMobile] = useState(false);
  const [mobileDrawer, setMobileDrawer] = useState(null); // 'sidebar' | 'details' | null

  // Selection & interaction state (reset per repoId)
  const [selectedNode, setSelectedNode] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [aiSearchResults, setAiSearchResults] = useState(null);
  const [activeCycle, setActiveCycle] = useState(null);
  const [isSimulatingBlast, setIsSimulatingBlast] = useState(false);

  // Scope filter state (strictly in memory per repo, no localStorage)
  const [userScope, setUserScope] = useState(null);
  const [userDismissedSafeguard, setUserDismissedSafeguard] = useState(false);

  const isDenseGraph = Boolean(model?.nodes && model.nodes.length > 400);
  const isDenseSafeguardActive = isDenseGraph && !userDismissedSafeguard;

  const viewScope = useMemo(() => {
    if (userScope) return userScope;
    if (!model?.nodes || model.nodes.length === 0) return null;
    const initial = createDefaultScope(model.nodes);
    if (isDenseSafeguardActive) {
      initial.categories = new Set([SCOPE_CATEGORIES.SOURCE]);
      initial.showIsolated = false;
    }
    return initial;
  }, [userScope, model, isDenseSafeguardActive]);

  // Compute visible subgraph purely
  const visibleSubgraph = useMemo(() => {
    if (!model?.nodes) return null;
    return filterGraphByScope(model.nodes, model.rawEdges, viewScope);
  }, [model, viewScope]);

  // Focus mode configuration
  const [focusConfig, setFocusConfig] = useState({
    active: false,
    rootNodeId: null,
    depth: 1,
    direction: FOCUS_DIRECTIONS.BOTH,
    respectScope: true,
    neighborhood: null,
  });

  // Monitor viewport width
  useEffect(() => {
    const checkViewport = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile && mobileDrawer) {
        setMobileDrawer(null);
      }
    };
    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, [mobileDrawer]);

  // Layout resize handlers
  const handleSidebarResize = useCallback((w) => {
    setSidebarWidth(w);
    writeStorage(STORAGE_KEYS.SIDEBAR_WIDTH, w);
    console.log('SIDEBAR_RESIZED:', w);
  }, []);

  const handleDetailsResize = useCallback((w) => {
    setDetailsWidth(w);
    writeStorage(STORAGE_KEYS.DETAILS_WIDTH, w);
  }, []);

  const toggleSidebar = useCallback(() => {
    if (isMobile) {
      setMobileDrawer((prev) => (prev === 'sidebar' ? null : 'sidebar'));
    } else {
      setIsSidebarOpen((prev) => {
        const next = !prev;
        writeStorage(STORAGE_KEYS.SIDEBAR_OPEN, next);
        return next;
      });
    }
  }, [isMobile]);

  const toggleDetails = useCallback(() => {
    if (isMobile) {
      setMobileDrawer((prev) => (prev === 'details' ? null : 'details'));
    } else {
      setIsDetailsOpen((prev) => {
        const next = !prev;
        writeStorage(STORAGE_KEYS.DETAILS_OPEN, next);
        return next;
      });
    }
  }, [isMobile]);

  // Layout mode switcher
  const handleChangeLayout = useCallback((mode) => {
    setLayoutMode(mode);
    writeSessionStorage(STORAGE_KEYS.LAYOUT_MODE, mode);
  }, []);

  // Scope handlers
  const handleToggleCategory = useCallback((category) => {
    setUserScope((prev) => {
      const base = prev || viewScope;
      if (!base) return null;
      const nextCategories = new Set(base.categories);
      if (nextCategories.has(category)) {
        nextCategories.delete(category);
      } else {
        nextCategories.add(category);
      }
      return { ...base, categories: nextCategories };
    });
  }, [viewScope]);

  const handleToggleExtension = useCallback((ext) => {
    setUserScope((prev) => {
      const base = prev || viewScope;
      if (!base) return null;
      const nextExtensions = new Set(base.extensions);
      if (nextExtensions.has(ext)) {
        nextExtensions.delete(ext);
      } else {
        nextExtensions.add(ext);
      }
      return { ...base, extensions: nextExtensions };
    });
  }, [viewScope]);

  const handleSetMinFanIn = useCallback((minFanIn) => {
    setUserScope((prev) => {
      const base = prev || viewScope;
      return base ? { ...base, minFanIn } : null;
    });
  }, [viewScope]);

  const handleToggleIsolated = useCallback((showIsolated) => {
    setUserScope((prev) => {
      const base = prev || viewScope;
      return base ? { ...base, showIsolated } : null;
    });
  }, [viewScope]);

  const handleFocusFolder = useCallback((folderPath) => {
    setUserScope((prev) => {
      const base = prev || viewScope;
      return base ? { ...base, folderInclude: folderPath } : null;
    });
  }, [viewScope]);

  const handleHideFolder = useCallback((folderPath) => {
    setUserScope((prev) => {
      const base = prev || viewScope;
      if (!base) return null;
      const nextExcludes = new Set(base.folderExclude);
      nextExcludes.add(folderPath);
      return { ...base, folderExclude: nextExcludes };
    });
  }, [viewScope]);

  const handleClearFolderExcludes = useCallback(() => {
    setUserScope((prev) => {
      const base = prev || viewScope;
      return base ? { ...base, folderExclude: new Set() } : null;
    });
  }, [viewScope]);

  const handleResetScope = useCallback(() => {
    setUserScope(null);
    setUserDismissedSafeguard(false);
  }, []);

  const handleShowAll = useCallback(() => {
    setUserDismissedSafeguard(true);
    setUserScope({
      categories: new Set(Object.values(SCOPE_CATEGORIES)),
      folderInclude: null,
      folderExclude: new Set(),
      extensions: new Set(),
      minFanIn: 0,
      showIsolated: true,
    });
  }, []);

  // Focus mode actions
  const handleSetFocus = useCallback(
    ({ rootNodeId, depth, direction, respectScope }) => {
      if (!rootNodeId || !model) return;
      const neighborhood = computeNeighborhood(rootNodeId, model, {
        depth,
        direction,
        respectScope,
        allowedNodeIds: visibleSubgraph?.visibleNodeIds,
      });

      setFocusConfig({
        active: true,
        rootNodeId,
        depth,
        direction,
        respectScope,
        neighborhood,
      });
    },
    [model, visibleSubgraph?.visibleNodeIds]
  );

  const handleClearFocus = useCallback(() => {
    setFocusConfig({
      active: false,
      rootNodeId: null,
      depth: 1,
      direction: FOCUS_DIRECTIONS.BOTH,
      respectScope: true,
      neighborhood: null,
    });
  }, []);

  // Synchronized node selection
  const handleSelectNode = useCallback(
    (node) => {
      setSelectedNode(node);
      if (node && !isDetailsOpen && !isMobile) {
        setIsDetailsOpen(true);
      }
      if (node && isMobile) {
        setMobileDrawer('details');
      }
    },
    [isDetailsOpen, isMobile]
  );

  // Global Accessible Keyboard Shortcuts: /, Esc, f, +, -
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      const isInput =
        activeTag === 'input' ||
        activeTag === 'textarea' ||
        activeTag === 'select' ||
        document.activeElement?.isContentEditable;

      if (isInput) {
        if (e.key === 'Escape') {
          document.activeElement.blur();
        }
        return;
      }

      if (e.key === 'Escape') {
        if (mobileDrawer) {
          setMobileDrawer(null);
        } else if (focusConfig.active) {
          handleClearFocus();
        } else if (selectedNode) {
          setSelectedNode(null);
        } else if (searchQuery) {
          setSearchQuery('');
        }
      } else if (e.key === '/') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Filter files"]');
        if (searchInput) searchInput.focus();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        if (window.cy) window.cy.fit(undefined, 40);
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        if (window.cy) window.cy.zoom(window.cy.zoom() * 1.25);
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        if (window.cy) window.cy.zoom(window.cy.zoom() * 0.8);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileDrawer, focusConfig.active, selectedNode, searchQuery, handleClearFocus]);

  // Loading Screen
  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-surface-app p-4">
        <StateMessage
          type="loading"
          title="Loading Repository"
          message="Fetching dependency graph and module metrics..."
        />
      </div>
    );
  }

  // Error Screen
  if (error || !graphData) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-surface-app p-4">
        <StateMessage
          type="error"
          title="Unable to Load Graph"
          message={error?.message || 'Could not retrieve repository dependency data.'}
          action={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={reload}>
                Retry
              </Button>
              <Button variant="ghost" size="sm" onClick={onNavigateHome}>
                Back to Home
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-surface-app text-content-primary">
      {/* Top Bar */}
      <TopBar
        repoUrl={graphData?.url || 'Repository'}
        nodeCount={visibleSubgraph?.visibleNodes?.length ?? (graphData?.nodes?.length || 0)}
        edgeCount={visibleSubgraph?.visibleEdges?.length ?? (graphData?.edges?.length || 0)}
        circularCount={graphData?.circular?.length || 0}
        isSidebarOpen={isMobile ? mobileDrawer === 'sidebar' : isSidebarOpen}
        isDetailsOpen={isMobile ? mobileDrawer === 'details' : isDetailsOpen}
        onToggleSidebar={toggleSidebar}
        onToggleDetails={toggleDetails}
        onNavigateHome={onNavigateHome}
      />

      {/* Scope Banner (Part 1 & Part 5) */}
      {visibleSubgraph && (
        <div className="bg-surface-raised/95 border-b border-border-subtle px-4 py-1.5 flex items-center justify-between text-xs backdrop-blur-xs select-none">
          <div className="flex items-center gap-2 min-w-0">
            {isDenseSafeguardActive && (
              <span className="text-[10px] font-mono uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded">
                Dense Graph Safeguard
              </span>
            )}
            <span className="text-content-secondary truncate">
              {formatScopeBanner(
                model?.nodes?.length || 0,
                visibleSubgraph.visibleNodes.length,
                visibleSubgraph.hiddenCounts
              )}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {visibleSubgraph.visibleNodes.length < (model?.nodes?.length || 0) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleShowAll}
                className="text-[11px] h-6 px-2 text-accent hover:text-accent font-medium hover:bg-accent/10"
              >
                Show all
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Main Workspace Body */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Desktop Left Sidebar */}
        {!isMobile && isSidebarOpen && (
          <>
            <div
              data-testid="sidebar-wrapper"
              style={{ width: `${sidebarWidth}px` }}
              className="shrink-0 h-full flex flex-col"
            >
              <Sidebar
                model={model}
                selectedNode={selectedNode}
                onSelectNode={handleSelectNode}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onHighlightCycle={setActiveCycle}
                activeCycle={activeCycle}
                onAiSearchResults={setAiSearchResults}
                viewScope={viewScope}
                visibleSubgraph={visibleSubgraph}
                onToggleCategory={handleToggleCategory}
                onToggleExtension={handleToggleExtension}
                onSetMinFanIn={handleSetMinFanIn}
                onToggleIsolated={handleToggleIsolated}
                onFocusFolder={handleFocusFolder}
                onHideFolder={handleHideFolder}
                onClearFolderExcludes={handleClearFolderExcludes}
                onResetScope={handleResetScope}
                className="h-full"
              />
            </div>
            <PanelSeparator
              position="left"
              size={sidebarWidth}
              minSize={220}
              maxSize={480}
              defaultSize={300}
              onResize={handleSidebarResize}
            />
          </>
        )}

        {/* Center Cytoscape Canvas */}
        <GraphCanvas
          model={model}
          selectedNode={selectedNode}
          onSelectNode={handleSelectNode}
          searchQuery={searchQuery}
          aiSearchResults={aiSearchResults}
          activeCycle={activeCycle}
          isSimulatingBlast={isSimulatingBlast}
          visibleSubgraph={visibleSubgraph}
          focusConfig={focusConfig}
          onClearFocus={handleClearFocus}
          layoutMode={layoutMode}
          onChangeLayout={handleChangeLayout}
        />

        {/* Desktop Right Details Panel */}
        {!isMobile && isDetailsOpen && (
          <>
            <PanelSeparator
              position="right"
              size={detailsWidth}
              minSize={280}
              maxSize={560}
              defaultSize={340}
              onResize={handleDetailsResize}
            />
            <div style={{ width: `${detailsWidth}px` }} className="shrink-0 h-full flex flex-col">
              <DetailsPanel
                repoId={repoId}
                selectedNode={selectedNode}
                model={model}
                onSelectNode={handleSelectNode}
                onClose={() => setIsDetailsOpen(false)}
                isSimulatingBlast={isSimulatingBlast}
                onToggleBlastRadius={() => setIsSimulatingBlast((prev) => !prev)}
                focusConfig={focusConfig}
                onSetFocus={handleSetFocus}
                onClearFocus={handleClearFocus}
                className="h-full"
              />
            </div>
          </>
        )}

        {/* Mobile Overlay Drawer: Backdrop */}
        {isMobile && mobileDrawer && (
          <div
            className="fixed inset-0 bg-black/60 z-40 backdrop-blur-xs transition-opacity duration-fast"
            onClick={() => setMobileDrawer(null)}
            aria-hidden="true"
          />
        )}

        {/* Mobile Left Drawer (Sidebar) */}
        {isMobile && mobileDrawer === 'sidebar' && (
          <div className="fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] bg-surface-panel shadow-2xl flex flex-col">
            <Sidebar
              model={model}
              selectedNode={selectedNode}
              onSelectNode={handleSelectNode}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onHighlightCycle={setActiveCycle}
              activeCycle={activeCycle}
              onAiSearchResults={setAiSearchResults}
              viewScope={viewScope}
              visibleSubgraph={visibleSubgraph}
              onToggleCategory={handleToggleCategory}
              onToggleExtension={handleToggleExtension}
              onSetMinFanIn={handleSetMinFanIn}
              onToggleIsolated={handleToggleIsolated}
              onFocusFolder={handleFocusFolder}
              onHideFolder={handleHideFolder}
              onClearFolderExcludes={handleClearFolderExcludes}
              onResetScope={handleResetScope}
              className="h-full"
            />
          </div>
        )}

        {/* Mobile Right Drawer (Details Panel) */}
        {isMobile && mobileDrawer === 'details' && selectedNode && (
          <div className="fixed inset-y-0 right-0 z-50 w-88 max-w-[85vw] bg-surface-panel shadow-2xl flex flex-col">
            <DetailsPanel
              repoId={repoId}
              selectedNode={selectedNode}
              model={model}
              onSelectNode={handleSelectNode}
              onClose={() => setMobileDrawer(null)}
              isSimulatingBlast={isSimulatingBlast}
              onToggleBlastRadius={() => setIsSimulatingBlast((prev) => !prev)}
              focusConfig={focusConfig}
              onSetFocus={handleSetFocus}
              onClearFocus={handleClearFocus}
              className="h-full"
            />
          </div>
        )}
      </div>
    </div>
  );
}
