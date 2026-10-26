import React, { useState, useEffect, lazy, Suspense, useCallback } from 'react';
import LandingPage from './components/LandingPage';
import StateMessage from './components/ui/StateMessage';

// Lazy-load Workspace shell to avoid bundling Cytoscape into landing page
const Workspace = lazy(() => import('./components/workspace/Workspace'));

/**
 * Extracts repoId from URL hash: #/r/<repoId>
 */
function getRepoIdFromHash() {
  const hash = window.location.hash || '';
  const match = hash.match(/^#\/r\/([a-f0-9]+)/i);
  return match ? match[1] : null;
}

export default function App() {
  const [activeRepoId, setActiveRepoId] = useState(() => getRepoIdFromHash());

  // Listen for hashchange (browser forward/back)
  useEffect(() => {
    const handleHashChange = () => {
      const id = getRepoIdFromHash();
      setActiveRepoId(id);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleAnalyzeSuccess = useCallback((repoId) => {
    window.location.hash = `/r/${repoId}`;
    setActiveRepoId(repoId);
  }, []);

  const handleNavigateHome = useCallback(() => {
    window.location.hash = '';
    setActiveRepoId(null);
  }, []);

  return (
    <div className="min-h-screen w-full bg-surface-app text-content-primary">
      {activeRepoId ? (
        <Suspense
          fallback={
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-surface-app">
              <StateMessage
                type="loading"
                title="Loading Workspace"
                message="Initializing Cytoscape and dependency visualizer..."
              />
            </div>
          }
        >
          {/* Keying by repoId ensures complete reset of workspace state when switching repos */}
          <Workspace
            key={activeRepoId}
            repoId={activeRepoId}
            onNavigateHome={handleNavigateHome}
          />
        </Suspense>
      ) : (
        <LandingPage onAnalyzeSuccess={handleAnalyzeSuccess} />
      )}
    </div>
  );
}
