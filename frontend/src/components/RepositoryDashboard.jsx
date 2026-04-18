import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Search, Loader2, ArrowLeft, ShieldCheck, Activity, RefreshCw, Layers, FileText, Share2, ShieldAlert } from 'lucide-react';
import GraphView from './GraphView';
import NodeDetailPanel from './NodeDetailPanel';
import FileManifest from './FileManifest';
import DependencyTree from './DependencyTree';
import SecurityAudit from './SecurityAudit';
import { getAiSummary, getGraphData } from '../services/api';

export default function RepositoryDashboard() {
  const { repoId } = useParams();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('Architecture Graph');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNode, setSelectedNode] = useState(null);
  
  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await getGraphData(repoId);
        setGraphData(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [repoId]);

  const handleNodeSelect = (node) => {
    setSelectedNode(node);
    
    if (node) {
      setAiSummary(null);
      setAiError(null);
      setAiLoading(true);
      
      getAiSummary({
        repoId,
        fileName: node.id || node.fullPath,
        dependencies: node.dependencies,
        dependents: node.dependents,
      }).then(res => {
        setAiSummary(res.summary);
      }).catch(err => {
        setAiError(err.message || 'AI summary unavailable.');
      }).finally(() => {
        setAiLoading(false);
      });
    } else {
      setAiSummary(null);
      setAiError(null);
    }
  };

  // Global Health Score calculation
  const healthScore = useMemo(() => {
    if (!graphData) return 80;
    const circularCount = graphData.circular?.length || 0;
    // Simple penalty: 5% off for every circular dependency cycle
    return Math.max(0, Math.min(100, 100 - (circularCount * 5)));
  }, [graphData]);

  // Handle derived metrics for the detail panel
  const impactScore = selectedNode
    ? Math.min(100, Math.round((selectedNode.dependents * 7) + (selectedNode.dependencies * 3)))
    : 0;

  const impactLabel = impactScore >= 70 ? 'High' : impactScore >= 35 ? 'Medium' : 'Low';
  const impactColor = impactScore >= 70 ? 'text-red-400' : impactScore >= 35 ? 'text-yellow-400' : 'text-emerald-400';
  const impactBarColor = impactScore >= 70 ? 'bg-red-500' : impactScore >= 35 ? 'bg-yellow-500' : 'bg-emerald-500';

  const menuItems = [
    { name: 'Architecture Graph', icon: <Layers className="w-4 h-4" /> },
    { name: 'File Manifest', icon: <FileText className="w-4 h-4" /> },
    { name: 'Dependency Tree', icon: <Share2 className="w-4 h-4" /> },
    { name: 'Security Audit', icon: <ShieldAlert className="w-4 h-4" /> }
  ];

  if (loading) {
    return (
      <div className="h-screen bg-[#020617] flex flex-col items-center justify-center text-blue-300">
        <Loader2 className="w-10 h-10 animate-spin mb-4" />
        <p className="font-medium animate-pulse">Synchronizing architectural data...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#020617] text-slate-200 overflow-hidden">
      
      {/* Top Navbar */}
      <header className="h-16 shrink-0 border-b border-white/5 bg-[#0f172a]/80 backdrop-blur-md px-6 flex items-center justify-between z-30">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/')}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              Repository Analysis
            </h1>
            <p className="text-[10px] text-slate-500 font-mono truncate max-w-[200px]">{repoId}</p>
          </div>
        </div>

        {/* Global Search in Navbar */}
        <div className="flex-1 max-w-xl mx-8">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
            <input
              type="text"
              placeholder="Search components or files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500/50 transition-all placeholder:text-slate-600"
            />
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 rounded-full border border-blue-500/20">
            <Activity className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[11px] font-bold text-blue-300">Health Score: {healthScore}%</span>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[11px] font-medium transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Re-analyze
          </button>
        </div>
      </header>

      {/* Main Layout Area */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Sidebar (20%) */}
        <aside className="w-1/5 shrink-0 border-r border-white/5 bg-[#0f172a]/40 p-6 flex flex-col gap-8 overflow-y-auto">
          
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
              <Layers className="w-3 h-3" />
              Exploration
            </h3>
            <div className="space-y-1">
              {menuItems.map(item => (
                <button 
                  key={item.name}
                  onClick={() => setActiveTab(item.name)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition-all ${activeTab === item.name ? 'bg-blue-500/10 text-blue-400 font-bold border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                >
                  {item.icon}
                  {item.name}
                </button>
              ))}
            </div>
          </section>

          <section className="mt-auto bg-gradient-to-br from-blue-600/10 to-purple-600/10 rounded-2xl p-5 border border-white/5">
            <h4 className="text-xs font-bold text-white mb-2">Onboarding</h4>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Use the sidebar to toggle between Graph and Manifest views. Selecting a file in any view triggers deep AI analysis.
            </p>
          </section>
        </aside>

        {/* Center area (Big Graph or Manifest) */}
        <main className="flex-1 relative bg-[#020617] h-full overflow-hidden">
          {activeTab === 'Architecture Graph' && (
            <GraphView 
              repoId={repoId} 
              initialData={graphData}
              searchQuery={searchQuery} 
              onNodeSelect={handleNodeSelect} 
            />
          )}

          {activeTab === 'File Manifest' && (
            <FileManifest 
              graphData={graphData}
              currentSelection={selectedNode}
              onSelect={handleNodeSelect}
              searchQuery={searchQuery}
            />
          )}

          {activeTab === 'Dependency Tree' && (
            <DependencyTree 
              graphData={graphData}
              onSelect={(nodeId) => {
                const node = graphData.nodes.find(n => n.id === nodeId);
                if (node) {
                  const deps = graphData.edges.filter(e => e.source === nodeId).length;
                  const dependents = graphData.edges.filter(e => e.target === nodeId).length;
                  handleNodeSelect({ ...node, dependencies: deps, dependents: dependents });
                }
              }}
            />
          )}

          {activeTab === 'Security Audit' && (
            <SecurityAudit 
              graphData={graphData}
              healthScore={healthScore}
              onSelect={handleNodeSelect}
            />
          )}
        </main>

        {/* Right Panel (20-25%) */}
        <aside className={`w-1/4 shrink-0 transition-all duration-300 ${selectedNode ? 'translate-x-0 opacity-100' : 'translate-x-12 opacity-0'}`}>
          {selectedNode && (
            <NodeDetailPanel 
              selectedNode={selectedNode}
              onClose={() => handleNodeSelect(null)}
              isCircular={selectedNode.isCircular}
              impactScore={impactScore}
              impactLabel={impactLabel}
              impactColor={impactColor}
              impactBarColor={impactBarColor}
              aiSummary={aiSummary}
              aiLoading={aiLoading}
              aiError={aiError}
            />
          )}
          {!selectedNode && (
            <div className="h-full border-l border-white/5 flex flex-col items-center justify-center p-8 text-center text-slate-600">
               <Layers className="w-12 h-12 mb-4 opacity-10" />
               <p className="text-xs italic">Select a module to view architectural context</p>
            </div>
          )}
        </aside>

      </div>
    </div>
  );
}
