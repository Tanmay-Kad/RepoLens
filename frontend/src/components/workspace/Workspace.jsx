import React, { useState, useEffect, useCallback } from 'react';
import TopBar from './TopBar';
import Sidebar from './Sidebar';
import GraphCanvas from './GraphCanvas';
import DetailsPanel from './DetailsPanel';
import PanelSeparator from './PanelSeparator';
import StateMessage from '../ui/StateMessage';
import { useRepoGraph } from './useRepoGraph';

const STORAGE_KEYS = {
  SIDEBAR_WIDTH: 'repolens:sidebar_width',
  DETAILS_WIDTH: 'repolens:details_width',
  SIDEBAR_OPEN: 'repolens:sidebar_open',
  DETAILS_OPEN: 'repolens:details_open',
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

/**
 * Three-panel workspace shell
 */
export default function Workspace({ repoId, onNavigateHome }) {
  const { loading, error, graphData, model, reload } = useRepoGraph(repoId);

  // Layout state
  const [sidebarWidth, setSidebarWidth] = useState(() => readStorage(STORAGE_KEYS.SIDEBAR_WIDTH, 300));
  const [detailsWidth, setDetailsWidth] = useState(() => readStorage(STORAGE_KEYS.DETAILS_WIDTH, 340));
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => readStorage(STORAGE_KEYS.SIDEBAR_OPEN, true));
  const [isDetailsOpen, setIsDetailsOpen] = useState(() => readStorage(STORAGE_KEYS.DETAILS_OPEN, false));

  // Mobile / small viewport drawer state (<1024px)
  const [isMobile, setIsMobile] = useState(false);
  const [mobileDrawer, setMobileDrawer] = useState(null); // 'sidebar' | 'details' | null

  // Selection & interaction state (reset per repoId)
  const [selectedNode, setSelectedNode] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [aiSearchResults, setAiSearchResults] = useState(null);
  const [activeCycle, setActiveCycle] = useState(null);
  const [isSimulatingBlast, setIsSimulatingBlast] = useState(false);

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

  // Persist layout preferences
  const handleSidebarResize = useCallback((w) => {
    setSidebarWidth(w);
    writeStorage(STORAGE_KEYS.SIDEBAR_WIDTH, w);
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

  // Handle escape key to close mobile drawers
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (mobileDrawer) {
          setMobileDrawer(null);
        } else if (selectedNode) {
          setSelectedNode(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileDrawer, selectedNode]);

  // When node is selected, open details panel if closed
  const handleSelectNode = useCallback((node) => {
    setSelectedNode(node);
    setIsSimulatingBlast(false);
    if (node) {
      if (isMobile) {
        setMobileDrawer('details');
      } else {
        setIsDetailsOpen(true);
      }
    }
  }, [isMobile]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col bg-surface-app">
        <header className="h-12 border-b border-border-subtle bg-surface-panel px-4 flex items-center justify-between">
          <div className="font-bold text-sm tracking-tight text-content-primary">
            RepoLens <span className="text-accent text-xs">AI</span>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center p-6">
          <StateMessage
            type="loading"
            title="Building Dependency Graph"
            message="Analyzing import structure and computing architecture metrics..."
            hint="Large repositories with hundreds of source files can take a few moments."
          />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-screen flex flex-col bg-surface-app">
        <header className="h-12 border-b border-border-subtle bg-surface-panel px-4 flex items-center justify-between">
          <div className="font-bold text-sm tracking-tight text-content-primary">
            RepoLens <span className="text-accent text-xs">AI</span>
          </div>
          <button
            type="button"
            onClick={onNavigateHome}
            className="text-xs text-content-secondary hover:text-content-primary"
          >
            ← Return to Home
          </button>
        </header>
        <div className="flex-1 flex items-center justify-center p-6">
          <StateMessage
            type="error"
            title={error.title || 'Failed to Load Repository'}
            message={error.message || 'An unexpected error occurred.'}
            hint={error.hint}
            actionLabel="Try Again"
            onAction={reload}
          />
        </div>
      </div>
    );
  }

  const nodes = model?.nodes || [];
  const edges = model?.rawEdges || [];
  const circular = model?.rawCircular || [];
  const analysis = model?.analysis || {};
  const repo = model?.repo || graphData?.repo || null;

  // Empty graph check: repository has 0 supported JS/TS files
  if (nodes.length === 0) {
    // Clean formatting of unsupported extensions
    const unsupportedList = Array.isArray(analysis.unsupported) ? analysis.unsupported : [];
    const languageBreakdown = unsupportedList
      .filter((u) => u.ext && u.ext.trim() !== '')
      .map((u) => `${u.ext} (${u.count})`)
      .slice(0, 6)
      .join(', ');

    return (
      <div className="h-screen w-screen flex flex-col bg-surface-app">
        <TopBar
          repo={repo}
          circularCount={0}
          nodeCount={0}
          edgeCount={0}
          isSidebarOpen={false}
          isDetailsOpen={false}
          onToggleSidebar={() => {}}
          onToggleDetails={() => {}}
          onNavigateHome={onNavigateHome}
        />
        <div className="flex-1 flex items-center justify-center p-6">
          <StateMessage
            type="unavailable"
            title="No JavaScript or TypeScript Source Files Found"
            message="This repository does not contain supported JavaScript or TypeScript source files with dependency connections."
            hint={
              languageBreakdown
                ? `Detected other file types: ${languageBreakdown}. RepoLens AI currently visualizes JS and TS module imports.`
                : 'Only public repositories with JavaScript and TypeScript source files are currently supported.'
            }
            actionLabel="Analyze Another Repository"
            onAction={onNavigateHome}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-surface-app overflow-hidden">
      {/* Top Bar */}
      <TopBar
        repo={repo}
        circularCount={circular.length}
        nodeCount={nodes.length}
        edgeCount={edges.length}
        isSidebarOpen={isMobile ? mobileDrawer === 'sidebar' : isSidebarOpen}
        isDetailsOpen={isMobile ? mobileDrawer === 'details' : isDetailsOpen}
        onToggleSidebar={toggleSidebar}
        onToggleDetails={toggleDetails}
        onNavigateHome={onNavigateHome}
      />

      {/* Main Workspace Body */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Desktop Left Sidebar */}
        {!isMobile && isSidebarOpen && (
          <>
            <div style={{ width: `${sidebarWidth}px` }} className="shrink-0 h-full flex flex-col">
              <Sidebar
                model={model}
                selectedNode={selectedNode}
                onSelectNode={handleSelectNode}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onHighlightCycle={setActiveCycle}
                activeCycle={activeCycle}
                onAiSearchResults={setAiSearchResults}
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

        {/* Mobile Overlay Drawer: Sidebar */}
        {isMobile && mobileDrawer === 'sidebar' && (
          <div
            className="fixed inset-y-0 left-0 w-[300px] max-w-[85vw] bg-surface-panel z-50 shadow-2xl flex flex-col"
            role="dialog"
            aria-label="Files and Architecture Health"
          >
            <Sidebar
              model={model}
              selectedNode={selectedNode}
              onSelectNode={(node) => {
                handleSelectNode(node);
                setMobileDrawer(null);
              }}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onHighlightCycle={(cycle) => {
                setActiveCycle(cycle);
                setMobileDrawer(null);
              }}
              activeCycle={activeCycle}
              onAiSearchResults={setAiSearchResults}
              className="h-full"
            />
          </div>
        )}

        {/* Mobile Overlay Drawer: Details */}
        {isMobile && mobileDrawer === 'details' && (
          <div
            className="fixed inset-y-0 right-0 w-[340px] max-w-[85vw] bg-surface-panel z-50 shadow-2xl flex flex-col"
            role="dialog"
            aria-label="Module Details"
          >
            <DetailsPanel
              repoId={repoId}
              selectedNode={selectedNode}
              model={model}
              onSelectNode={handleSelectNode}
              onClose={() => setMobileDrawer(null)}
              isSimulatingBlast={isSimulatingBlast}
              onToggleBlastRadius={() => setIsSimulatingBlast((prev) => !prev)}
              className="h-full"
            />
          </div>
        )}
      </div>
    </div>
  );
}
