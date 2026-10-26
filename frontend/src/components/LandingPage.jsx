import React, { useState, useEffect, useRef } from 'react';
import {
  GitFork,
  Search,
  Loader2,
  ArrowRight,
  Network,
  RefreshCw,
  Activity,
  Sparkles,
  AlertCircle,
  X,
} from 'lucide-react';
import Button from './ui/Button';
import StateMessage from './ui/StateMessage';
import { parseAndValidateRepoUrl } from '../models/repoUrlInput';
import { mapApiError } from '../models/apiErrors';
import { analyzeRepository } from '../services/api';

const VERIFIED_EXAMPLES = [
  {
    name: 'expressjs/express',
    url: 'https://github.com/expressjs/express',
    desc: 'Medium Node.js framework (~142 source files)',
  },
  {
    name: 'sindresorhus/is-stream',
    url: 'https://github.com/sindresorhus/is-stream',
    desc: 'Small single-module utility (1 source file)',
  },
  {
    name: 'Tanmay-Kad/BhumiSetu',
    url: 'https://github.com/Tanmay-Kad/BhumiSetu',
    desc: 'TypeScript project with path aliases',
  },
];

const CAPABILITIES = [
  {
    title: 'Interactive Dependency Graph',
    description: 'Explore modular source files, imports, and connections across JavaScript and TypeScript codebases.',
    icon: Network,
  },
  {
    title: 'Architecture & Cycle Detection',
    description: 'Instantly surface circular dependency chains, candidate entry points, and high fan-in core modules.',
    icon: RefreshCw,
  },
  {
    title: 'Coupling & Blast Radius',
    description: 'Simulate blast radius heuristics to identify which upstream modules could break before making edits.',
    icon: Activity,
  },
  {
    title: 'AI File Insights & Search',
    description: 'Ask natural-language questions to find files and generate Gemini-powered architectural summaries.',
    icon: Sparkles,
  },
];

/**
 * Redesigned Landing Page
 */
export default function LandingPage({ onAnalyzeSuccess }) {
  const [urlInput, setUrlInput] = useState('');
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [clientError, setClientError] = useState(null);
  const [serverError, setServerError] = useState(null);
  const [loading, setLoading] = useState(false);

  const inputRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Autofocus input on desktop only (>= 1024px)
  useEffect(() => {
    if (window.innerWidth >= 1024 && inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Inline non-blocking validation while typing (only after first submit attempt)
  const handleInputChange = (e) => {
    const val = e.target.value;
    setUrlInput(val);
    if (serverError) {
      setServerError(null);
    }
    if (hasAttemptedSubmit) {
      const validation = parseAndValidateRepoUrl(val);
      if (!validation.isValid && val.trim() !== '') {
        setClientError(validation.error);
      } else {
        setClientError(null);
      }
    }
  };

  const handleExampleClick = (exampleUrl) => {
    setUrlInput(exampleUrl);
    setClientError(null);
    setServerError(null);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setHasAttemptedSubmit(true);
    setServerError(null);

    const validation = parseAndValidateRepoUrl(urlInput);
    if (!validation.isValid) {
      setClientError(validation.error);
      if (inputRef.current) {
        inputRef.current.focus();
      }
      return;
    }

    setClientError(null);
    setLoading(true);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const data = await analyzeRepository(validation.normalizedUrl, {
        signal: controller.signal,
      });

      if (data && data.repoId) {
        onAnalyzeSuccess(data.repoId);
      } else {
        throw new Error('Analysis completed without a valid repository identifier.');
      }
    } catch (err) {
      if (controller.signal.aborted || err.isCanceled || err.name === 'CanceledError') {
        return;
      }
      const mapped = mapApiError(err);
      setServerError(mapped);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-surface-app text-content-primary">
      {/* Top Header */}
      <header className="w-full border-b border-border-subtle bg-surface-panel/80 px-4 sm:px-8 py-3 flex items-center justify-between select-none">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-sm bg-accent/20 border border-accent/40 flex items-center justify-center">
            <GitFork className="w-4 h-4 text-accent" aria-hidden="true" />
          </div>
          <span className="font-bold text-base tracking-tight text-content-primary">
            RepoLens <span className="text-accent text-xs font-semibold ml-0.5">AI</span>
          </span>
        </div>
        <span className="text-xs text-content-muted hidden sm:inline">
          Repository Dependency Visualizer
        </span>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-12 max-w-4xl mx-auto w-full">
        {/* Hero Section */}
        <div className="text-center w-full max-w-2xl mb-8">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-content-primary mb-3">
            Understand unfamiliar codebases quickly.
          </h1>
          <p className="text-sm sm:text-base text-content-secondary leading-relaxed max-w-xl mx-auto">
            Explore interactive dependency graphs, identify architecture hotspots, and trace circular chains across JavaScript and TypeScript projects.
          </p>
        </div>

        {/* Input Form Card */}
        <div className="w-full max-w-2xl bg-surface-panel border border-border-default rounded-md p-4 sm:p-6 shadow-sm mb-6">
          <form onSubmit={handleSubmit} noValidate>
            <div className="flex flex-col gap-2">
              <label htmlFor="repo-url-input" className="text-xs font-semibold text-content-secondary uppercase tracking-wider">
                GitHub Repository URL
              </label>

              <div className="relative flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-content-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                  <input
                    ref={inputRef}
                    id="repo-url-input"
                    type="url"
                    value={urlInput}
                    onChange={handleInputChange}
                    disabled={loading}
                    placeholder="https://github.com/owner/repository"
                    className={`w-full h-10 pl-9 pr-3 text-sm font-mono bg-surface-raised border rounded-sm text-content-primary placeholder:text-content-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors duration-fast ${
                      clientError ? 'border-red-500/60 focus-visible:ring-red-500' : 'border-border-default focus:border-accent'
                    }`}
                  />
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={loading}
                  className="h-10 px-5 text-sm shrink-0"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-1.5" aria-hidden="true" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      Analyze
                      <ArrowRight className="w-4 h-4 ml-1.5" aria-hidden="true" />
                    </>
                  )}
                </Button>
              </div>

              {/* Client-side validation message */}
              {clientError && (
                <div className="flex items-center gap-1.5 text-xs text-red-400 mt-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{clientError}</span>
                </div>
              )}
            </div>
          </form>

          {/* Indeterminate Loading State */}
          {loading && (
            <div className="mt-4 p-3 bg-surface-raised border border-border-subtle rounded-sm flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <Loader2 className="w-4 h-4 text-accent animate-spin shrink-0" aria-hidden="true" />
                <span className="text-content-secondary leading-snug">
                  Cloning repository and building the dependency graph. Large repositories can take a minute.
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancel}
                className="text-xs text-content-muted hover:text-content-primary shrink-0"
              >
                Cancel
              </Button>
            </div>
          )}

          {/* Server Error Message */}
          {serverError && !loading && (
            <div className="mt-4 p-3.5 bg-red-500/10 border border-red-500/30 rounded-sm space-y-1">
              <div className="flex items-center justify-between text-xs font-semibold text-red-300">
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" aria-hidden="true" />
                  <span>{serverError.title}</span>
                </div>
                {serverError.retryAfter && (
                  <span className="text-[11px] font-mono text-red-400">
                    Retry in {serverError.retryAfter}s
                  </span>
                )}
              </div>
              <p className="text-xs text-red-200/90 leading-relaxed">
                {serverError.message}
              </p>
              {serverError.hint && (
                <p className="text-[11px] text-content-muted leading-relaxed">
                  {serverError.hint}
                </p>
              )}
            </div>
          )}

          {/* Example Repositories */}
          <div className="mt-5 pt-4 border-t border-border-subtle">
            <span className="text-[11px] font-semibold text-content-muted uppercase tracking-wider block mb-2">
              Verified Example Repositories
            </span>
            <div className="flex flex-wrap gap-2">
              {VERIFIED_EXAMPLES.map((ex) => (
                <button
                  key={ex.name}
                  type="button"
                  onClick={() => handleExampleClick(ex.url)}
                  disabled={loading}
                  title={ex.desc}
                  className="px-2.5 py-1 text-xs font-mono bg-surface-raised hover:bg-surface-overlay text-content-secondary hover:text-content-primary border border-border-default hover:border-border-strong rounded-sm transition-colors duration-fast focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-50"
                >
                  {ex.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Honest Scope Note */}
        <p className="text-xs text-content-muted text-center max-w-xl mb-12">
          Analyzes JavaScript and TypeScript imports. Public GitHub repositories only.
        </p>

        {/* Capabilities Grid */}
        <div className="w-full max-w-3xl grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CAPABILITIES.map((cap) => {
            const Icon = cap.icon;
            return (
              <div
                key={cap.title}
                className="p-4 bg-surface-panel/60 border border-border-subtle rounded-sm flex items-start gap-3"
              >
                <div className="w-8 h-8 rounded-sm bg-surface-raised border border-border-default flex items-center justify-center shrink-0 mt-0.5 text-accent">
                  <Icon className="w-4 h-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-semibold text-content-primary mb-1">
                    {cap.title}
                  </h3>
                  <p className="text-xs text-content-secondary leading-relaxed">
                    {cap.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-border-subtle bg-surface-panel/40 px-4 py-3 text-center text-xs text-content-muted select-none">
        RepoLens AI — Pure static architecture & dependency analysis for JavaScript and TypeScript.
      </footer>
    </div>
  );
}
