import { useState } from 'react';
import { Search, Loader2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import FeatureCards from './FeatureCards';
import { analyzeRepository } from '../services/api';

export default function LandingPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleAnalyze = async (e) => {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    setError(null);

    try {
      const data = await analyzeRepository(url);
      navigate(`/dashboard/${data.repoId}`);
    } catch (err) {
      // If the error has extra clinical 'details', show them
      setError(err.message + (err.details ? `: ${err.details}` : ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-20 pb-12">
      {/* Background Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/30 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/30 blur-[120px] rounded-full pointer-events-none" />

      <main className="flex-1 flex flex-col items-center justify-center w-full z-10 px-4">
        
        {/* Hero Section */}
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-sm text-blue-300 font-medium mb-8">
            <SparkleIcon /> CodeAtlas AI v1.0
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8">
            Understand Codebases in <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 animate-gradient-x">
              Seconds, Not Days.
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-gray-400 mb-12 max-w-2xl mx-auto">
            Paste any public GitHub repository URL and let our AI engine analyze architecture, detect vulnerabilities, and assess code quality instantly.
          </p>

          {/* Form Area */}
          <form onSubmit={handleAnalyze} className="relative max-w-2xl mx-auto w-full group">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full blur opacity-25 group-hover:opacity-40 transition duration-500" />
            <div className="relative flex items-center bg-background border border-white/10 p-2 rounded-full shadow-2xl">
              <Search className="w-6 h-6 text-gray-500 ml-4 mr-2" />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://github.com/username/repository"
                className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500 text-lg py-2"
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-full font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Analyzing
                  </>
                ) : (
                  <>
                    Analyze <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </form>

          {error && (
            <div className="mt-6 text-red-400 bg-red-400/10 py-2 px-4 rounded-xl inline-block border border-red-400/20">
              {error}
            </div>
          )}

        </div>

        {/* Feature Cards below Hero */}
        <FeatureCards />
      </main>
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L15 9L22 12L15 15L12 22L9 15L2 12L9 9L12 2Z" fill="currentColor" />
    </svg>
  );
}
