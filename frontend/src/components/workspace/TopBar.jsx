import React from 'react';
import { ExternalLink, PanelLeft, PanelRight, GitFork, ArrowLeft } from 'lucide-react';
import IconButton from '../ui/IconButton';
import Button from '../ui/Button';

/**
 * Workspace top navigation bar
 */
export default function TopBar({
  repo,
  circularCount = 0,
  nodeCount = 0,
  edgeCount = 0,
  isSidebarOpen,
  isDetailsOpen,
  onToggleSidebar,
  onToggleDetails,
  onNavigateHome,
}) {
  const repoName = repo ? `${repo.owner}/${repo.name}` : null;
  const repoUrl = repo?.url || null;

  return (
    <header className="h-12 border-b border-border-subtle bg-surface-panel px-3 sm:px-4 flex items-center justify-between gap-3 shrink-0 select-none z-20">
      {/* Left side: Brand + Sidebar toggle + Repo identifier */}
      <div className="flex items-center gap-3 min-w-0">
        <IconButton
          icon={PanelLeft}
          aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          title={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          variant={isSidebarOpen ? 'secondary' : 'ghost'}
          size={20}
          onClick={onToggleSidebar}
        />

        <button
          type="button"
          onClick={onNavigateHome}
          className="flex items-center gap-2 hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded-sm px-1 py-0.5"
          title="Return to Home"
        >
          <div className="w-6 h-6 rounded-sm bg-accent/20 border border-accent/40 flex items-center justify-center shrink-0">
            <GitFork className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
          </div>
          <span className="font-bold text-sm tracking-tight text-content-primary hidden sm:inline">
            RepoLens <span className="text-accent font-semibold text-xs ml-0.5">AI</span>
          </span>
        </button>

        {repoName && (
          <div className="flex items-center gap-1.5 pl-2 sm:pl-3 border-l border-border-subtle min-w-0">
            <span className="text-xs font-mono font-medium text-content-secondary truncate max-w-[180px] sm:max-w-[280px] md:max-w-[360px]" title={repoName}>
              {repoName}
            </span>
            {repoUrl && (
              <a
                href={repoUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-content-muted hover:text-content-primary transition-colors p-1 rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent shrink-0"
                title={`Open ${repoName} on GitHub`}
                aria-label="Open repository on GitHub"
              >
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
            )}
          </div>
        )}
      </div>

      {/* Center: Compact real metrics summary */}
      <div className="hidden md:flex items-center gap-4 text-xs text-content-secondary border-x border-border-subtle px-4">
        <div className="flex items-center gap-1.5" title="Total source files in dependency graph">
          <span className="text-content-muted">Files:</span>
          <span className="font-mono font-semibold text-content-primary">{nodeCount}</span>
        </div>
        <div className="flex items-center gap-1.5" title="Total import connections">
          <span className="text-content-muted">Edges:</span>
          <span className="font-mono font-semibold text-content-primary">{edgeCount}</span>
        </div>
        <div className="flex items-center gap-1.5" title="Detected circular dependency cycles">
          <span className="text-content-muted">Cycles:</span>
          <span className={`font-mono font-semibold ${circularCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {circularCount}
          </span>
        </div>
      </div>

      {/* Right side: Action + Details panel toggle */}
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          variant="ghost"
          onClick={onNavigateHome}
          className="text-xs text-content-secondary hover:text-content-primary"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
          <span className="hidden sm:inline">Analyze another</span>
          <span className="sm:hidden">New</span>
        </Button>

        <IconButton
          icon={PanelRight}
          aria-label={isDetailsOpen ? 'Collapse details panel' : 'Expand details panel'}
          title={isDetailsOpen ? 'Collapse details panel' : 'Expand details panel'}
          variant={isDetailsOpen ? 'secondary' : 'ghost'}
          size={20}
          onClick={onToggleDetails}
        />
      </div>
    </header>
  );
}
