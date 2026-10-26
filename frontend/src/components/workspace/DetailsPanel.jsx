import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Copy,
  Check,
  Activity,
  AlertTriangle,
  Sparkles,
  Loader2,
  ArrowRight,
  ArrowDownLeft,
  Info,
} from 'lucide-react';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import IconButton from '../ui/IconButton';
import { getAiSummary } from '../../services/api';
import { KIND_DEFINITIONS, NODE_KINDS } from '../../models/graphModel';

/**
 * Right details panel component
 */
export default function DetailsPanel({
  repoId,
  selectedNode,
  model,
  onSelectNode,
  onClose,
  isSimulatingBlast,
  onToggleBlastRadius,
  className = '',
}) {
  const [copied, setCopied] = useState(false);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  const nodeId = selectedNode?.id;

  // Retrieve incoming and outgoing lists from indexed model
  const incoming = useMemo(() => model?.dependents?.get(nodeId) || [], [model, nodeId]);
  const outgoing = useMemo(() => model?.dependencies?.get(nodeId) || [], [model, nodeId]);
  const cycles = useMemo(() => model?.cycleMembership?.get(nodeId) || [], [model, nodeId]);

  const fanIn = incoming.length;
  const fanOut = outgoing.length;

  // Exact impact score calculation from Part 1 inventory:
  // Math.min(100, Math.round((dependents * 7) + (dependencies * 3)))
  const impactScore = Math.min(100, Math.round(fanIn * 7 + fanOut * 3));
  let impactLabel = 'Low';
  let impactColor = 'text-emerald-400';
  let impactBarColor = 'bg-emerald-500';

  if (impactScore >= 70) {
    impactLabel = 'High';
    impactColor = 'text-rose-400';
    impactBarColor = 'bg-rose-500';
  } else if (impactScore >= 35) {
    impactLabel = 'Medium';
    impactColor = 'text-amber-400';
    impactBarColor = 'bg-amber-500';
  }

  // Trigger AI summary whenever selectedNode changes
  useEffect(() => {
    if (!nodeId || !repoId) return;

    let isSubscribed = true;
    const controller = new AbortController();

    Promise.resolve()
      .then(() => {
        if (!isSubscribed) return;
        setAiSummary(null);
        setAiError(null);
        setAiLoading(true);

        return getAiSummary(
          {
            repoId,
            fileName: nodeId,
            dependencies: outgoing,
            dependents: incoming,
          },
          { signal: controller.signal }
        );
      })
      .then((res) => {
        if (!isSubscribed || !res) return;
        setAiSummary(res.summary);
      })
      .catch((err) => {
        if (!isSubscribed || err?.isCanceled || err?.name === 'CanceledError') return;
        if (err.status === 429) {
          setAiError('Gemini API rate limit reached. Please wait a moment.');
        } else if (err.status === 503) {
          setAiError('Gemini service is currently unavailable or API key is not configured.');
        } else {
          setAiError(err.message || 'AI summary unavailable.');
        }
      })
      .finally(() => {
        if (isSubscribed) {
          setAiLoading(false);
        }
      });

    return () => {
      isSubscribed = false;
      controller.abort();
    };
  }, [nodeId, repoId, incoming, outgoing]);

  const handleCopyPath = () => {
    if (!nodeId) return;
    navigator.clipboard?.writeText(nodeId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleRetryAi = () => {
    if (!nodeId || !repoId) return;
    setAiSummary(null);
    setAiError(null);
    setAiLoading(true);
    getAiSummary({
      repoId,
      fileName: nodeId,
      dependencies: outgoing,
      dependents: incoming,
    })
      .then((res) => {
        setAiSummary(res.summary);
      })
      .catch((err) => {
        setAiError(err.message || 'AI summary unavailable.');
      })
      .finally(() => {
        setAiLoading(false);
      });
  };

  if (!selectedNode) {
    return (
      <aside className={`flex flex-col bg-surface-panel border-l border-border-subtle p-6 items-center justify-center text-center select-none ${className}`}>
        <div className="w-10 h-10 rounded-sm bg-surface-raised border border-border-default flex items-center justify-center mb-3 text-content-muted">
          <Info className="w-5 h-5" aria-hidden="true" />
        </div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-content-primary mb-1">
          No File Selected
        </h4>
        <p className="text-xs text-content-secondary max-w-xs leading-relaxed mb-3">
          Click any file node in the canvas or select a module from the file tree to inspect coupling, impact, dependencies, and AI insights.
        </p>
        <div className="text-[11px] text-content-muted max-w-xs space-y-1 text-left bg-surface-raised p-2.5 rounded-sm border border-border-subtle">
          <p>• <strong>Click node:</strong> Open inspector</p>
          <p>• <strong>Click canvas:</strong> Deselect</p>
          <p>• <strong>Simulate blast radius:</strong> Preview affected upstream files</p>
        </div>
      </aside>
    );
  }

  const kind = selectedNode.nodeKind || NODE_KINDS.NORMAL;
  const kindDef = KIND_DEFINITIONS[kind] || KIND_DEFINITIONS[NODE_KINDS.NORMAL];

  return (
    <aside className={`flex flex-col bg-surface-panel border-l border-border-subtle overflow-y-auto select-none ${className}`}>
      {/* Header */}
      <div className="p-3.5 border-b border-border-subtle bg-surface-panel flex items-start justify-between gap-2 shrink-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: kindDef.colorHex }}
              aria-hidden="true"
            />
            <h3 className="text-sm font-semibold text-content-primary truncate font-mono" title={selectedNode.label || nodeId}>
              {selectedNode.label || nodeId.split('/').pop()}
            </h3>
          </div>
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-mono text-content-muted truncate break-all" title={nodeId}>
              {nodeId}
            </p>
            <IconButton
              icon={copied ? Check : Copy}
              aria-label="Copy file path"
              title={copied ? 'Copied!' : 'Copy path'}
              size={16}
              onClick={handleCopyPath}
              className={copied ? 'text-emerald-400' : ''}
            />
          </div>
        </div>

        <IconButton
          icon={X}
          aria-label="Close details panel"
          title="Close details"
          size={16}
          onClick={onClose}
        />
      </div>

      <div className="p-3.5 space-y-4">
        {/* Badges / Metadata */}
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="default" title="Physical lines of code">
            {selectedNode.loc != null ? `${selectedNode.loc} lines` : '— lines'}
          </Badge>

          <Badge variant={kind} title={kindDef.description}>
            {kindDef.label}
          </Badge>

          {selectedNode.isEntryCandidate && (
            <Badge variant="entry" title={selectedNode.entryReason || 'Top-level entry point'}>
              Entry Candidate
            </Badge>
          )}

          {selectedNode.isTest && (
            <Badge variant="test" title="Detected test file heuristic">
              Test Module
            </Badge>
          )}
        </div>

        {/* Circular Dependency Alert */}
        {cycles.length > 0 && (
          <div className="p-2.5 rounded-sm bg-rose-500/10 border border-rose-500/30 text-rose-300 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" aria-hidden="true" />
              <span>In {cycles.length} Circular Dependency Cycle{cycles.length > 1 ? 's' : ''}</span>
            </div>
            <p className="text-[11px] text-rose-200/80 leading-relaxed">
              This module is part of cyclic import chains. Changes here may cause runtime import resolution bugs.
            </p>
          </div>
        )}

        {/* Couplings Cards */}
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="bg-surface-raised p-2.5 rounded-sm border border-border-subtle" title="Files this module directly imports">
            <div className="text-xl font-bold font-mono text-content-primary">{fanOut}</div>
            <div className="text-[10px] uppercase tracking-wider text-content-muted mt-0.5">Dependencies (Out)</div>
          </div>
          <div className="bg-surface-raised p-2.5 rounded-sm border border-border-subtle" title="Files that directly import this module">
            <div className="text-xl font-bold font-mono text-accent">{fanIn}</div>
            <div className="text-[10px] uppercase tracking-wider text-content-muted mt-0.5">Dependents (In)</div>
          </div>
        </div>

        {/* Impact Score Card */}
        <div className="bg-surface-raised p-3 rounded-sm border border-border-subtle space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold uppercase tracking-wider text-content-muted text-[11px]">
              Impact Score
            </span>
            <span className={`font-mono font-bold ${impactColor}`}>
              {impactLabel} ({impactScore}/100)
            </span>
          </div>

          <div className="w-full h-1.5 bg-surface-overlay rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${impactBarColor}`}
              style={{ width: `${impactScore}%` }}
            />
          </div>

          <p className="text-[11px] text-content-muted leading-tight">
            Heuristic based on fan-in (70%) and fan-out (30%): (dependents × 7) + (dependencies × 3). Identifies modules with highest blast risk.
          </p>
        </div>

        {/* Blast Radius Simulation Toggle */}
        <div>
          <button
            type="button"
            onClick={onToggleBlastRadius}
            className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-sm text-xs font-semibold uppercase tracking-wider border transition-colors duration-fast focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ${
              isSimulatingBlast
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 shadow-sm'
                : 'bg-surface-raised border-border-default text-rose-400 hover:bg-surface-overlay hover:border-rose-500/40'
            }`}
          >
            <Activity className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{isSimulatingBlast ? 'Clear Blast Radius' : 'Simulate Blast Radius'}</span>
          </button>
        </div>

        {/* Dependencies List (Outgoing) */}
        <div>
          <div className="flex items-center justify-between mb-1 text-xs">
            <span className="font-semibold text-content-secondary">
              Dependencies ({fanOut})
            </span>
            <span className="text-[11px] text-content-muted">Files imported by this</span>
          </div>

          {outgoing.length === 0 ? (
            <p className="text-[11px] text-content-muted italic bg-surface-raised p-2 rounded-sm border border-border-subtle">
              No outgoing imports.
            </p>
          ) : (
            <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
              {outgoing.map((depId) => {
                const targetNode = model?.nodeMap?.get(depId);
                return (
                  <button
                    key={depId}
                    type="button"
                    onClick={() => onSelectNode(targetNode || { id: depId })}
                    className="w-full flex items-center justify-between p-1.5 rounded-sm hover:bg-surface-raised text-xs text-left text-content-secondary hover:text-content-primary transition-colors duration-fast"
                    title={`Inspect ${depId}`}
                  >
                    <span className="truncate font-mono text-[11px]">{depId}</span>
                    <ArrowRight className="w-3 h-3 text-content-muted shrink-0 ml-1.5" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Dependents List (Incoming) */}
        <div>
          <div className="flex items-center justify-between mb-1 text-xs">
            <span className="font-semibold text-content-secondary">
              Dependents ({fanIn})
            </span>
            <span className="text-[11px] text-content-muted">Files importing this</span>
          </div>

          {incoming.length === 0 ? (
            <p className="text-[11px] text-content-muted italic bg-surface-raised p-2 rounded-sm border border-border-subtle">
              No incoming dependents (potential entry point or isolated file).
            </p>
          ) : (
            <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
              {incoming.map((depId) => {
                const sourceNode = model?.nodeMap?.get(depId);
                return (
                  <button
                    key={depId}
                    type="button"
                    onClick={() => onSelectNode(sourceNode || { id: depId })}
                    className="w-full flex items-center justify-between p-1.5 rounded-sm hover:bg-surface-raised text-xs text-left text-content-secondary hover:text-content-primary transition-colors duration-fast"
                    title={`Inspect ${depId}`}
                  >
                    <span className="truncate font-mono text-[11px]">{depId}</span>
                    <ArrowDownLeft className="w-3 h-3 text-accent shrink-0 ml-1.5" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* AI Summary Card */}
        <div className="p-3 rounded-sm bg-purple-500/5 border border-purple-500/20 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" aria-hidden="true" />
              <span className="text-xs font-semibold text-purple-300">Gemini Architecture Summary</span>
            </div>
            {aiSummary && !aiLoading && (
              <span className="text-[10px] text-purple-400 font-mono">Gemini 1.5</span>
            )}
          </div>

          {aiLoading && (
            <div className="flex items-center gap-2 text-xs text-content-muted py-2">
              <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" aria-hidden="true" />
              <span>Analyzing module purpose and risk...</span>
            </div>
          )}

          {aiError && !aiLoading && (
            <div className="space-y-2">
              <p className="text-xs text-rose-400 italic leading-relaxed">{aiError}</p>
              <Button size="sm" variant="secondary" onClick={handleRetryAi} className="h-6 text-xs">
                Retry Summary
              </Button>
            </div>
          )}

          {aiSummary && !aiLoading && !aiError && (
            <div className="space-y-2.5 text-xs">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-400 block mb-0.5">
                  Purpose
                </span>
                <p className="text-content-secondary leading-relaxed">{aiSummary.purpose}</p>
              </div>

              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-accent block mb-0.5">
                  Why It Matters
                </span>
                <p className="text-content-secondary leading-relaxed">{aiSummary.importance}</p>
              </div>

              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400 block mb-0.5">
                  Coupling Risk If Changed
                </span>
                <p className="text-content-secondary leading-relaxed">{aiSummary.riskIfChanged}</p>
              </div>
            </div>
          )}

          {!aiSummary && !aiLoading && !aiError && (
            <p className="text-xs text-content-muted italic leading-relaxed">
              AI analysis will appear here.
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}
