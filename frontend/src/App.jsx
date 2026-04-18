import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import RepositoryDashboard from './components/RepositoryDashboard';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-[#020617]">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard/:repoId" element={<RepositoryDashboard />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
