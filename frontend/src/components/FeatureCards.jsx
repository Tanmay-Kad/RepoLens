import { Sparkles, Code2, ShieldAlert, Activity } from 'lucide-react';

const features = [
  {
    title: 'Architecture Overview',
    description: 'Get an instant visual representation of the entire repository structure and stack.',
    icon: <Code2 className="w-6 h-6 text-blue-400" />,
  },
  {
    title: 'Vulnerability Scanning',
    description: 'Automatically detects common security pitfalls and outdated dependencies.',
    icon: <ShieldAlert className="w-6 h-6 text-purple-400" />,
  },
  {
    title: 'Code Quality Metrics',
    description: 'Deep analysis of code complexity, test coverage, and maintainability scores.',
    icon: <Activity className="w-6 h-6 text-emerald-400" />,
  },
  {
    title: 'AI Improvements',
    description: 'Smart AI suggestions for modernizing code and optimizing performance.',
    icon: <Sparkles className="w-6 h-6 text-pink-400" />,
  }
];

export default function FeatureCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-7xl mx-auto mt-20 px-6">
      {features.map((feature, idx) => (
        <div key={idx} className="glass-panel p-6 hover:-translate-y-2 transition-transform duration-300 cursor-pointer group">
          <div className="bg-white/10 w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            {feature.icon}
          </div>
          <h3 className="text-xl font-semibold mb-2 text-white/90">{feature.title}</h3>
          <p className="text-gray-400 leading-relaxed text-sm">
            {feature.description}
          </p>
        </div>
      ))}
    </div>
  );
}
