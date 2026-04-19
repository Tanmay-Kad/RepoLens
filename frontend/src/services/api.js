import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

export const analyzeRepository = async (url) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/analyze`, { url });
    return response.data;
  } catch (error) {
    if (error.response) {
      const apiErr = new Error(error.response.data.error || 'Failed to analyze repository');
      apiErr.details = error.response.data.details;
      apiErr.command = error.response.data.command;
      throw apiErr;
    }
    const diagnostic = error.code ? ` (${error.code})` : '';
    throw new Error(`Network error${diagnostic}. Ensure the server is running on port 5000.`);
  }
};

export const getGraphData = async (repoId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/graph/${repoId}`);
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.error || 'Failed to fetch graph data');
    }
    const diagnostic = error.code ? ` (${error.code})` : '';
    throw new Error(`Network error${diagnostic}. Ensure the server is running on port 5000.`);
  }
};

export const searchCodebase = async (repoId, query, filter) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/search/${repoId}`, {
      params: { q: query, filter }
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.error || 'Failed to execute search.');
    }
    const diagnostic = error.code ? ` (${error.code})` : '';
    throw new Error(`Network error${diagnostic}. Ensure the server is running on port 5000.`);
  }
};

export const semanticSearchCodebase = async (repoId, query) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/ai/semantic-search/${repoId}`, {
      params: { q: query }
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.error || 'Failed to execute AI search.');
    }
    const diagnostic = error.code ? ` (${error.code})` : '';
    throw new Error(`Network error${diagnostic}. Ensure the server is running.`);
  }
};

export const chatWithCodebase = async (repoId, messages) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/ai/chat/${repoId}`, {
      messages
    });
    return response.data.reply;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.error || 'Failed to chat with AI.');
    }
    const diagnostic = error.code ? ` (${error.code})` : '';
    throw new Error(`Network error${diagnostic}. Ensure the server is running.`);
  }
};

export const getOnboardingPath = async (repoId, mode) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/ai/onboarding/${repoId}`, {
      params: { mode }
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || 'Failed to fetch onboarding sequence.');
  }
};

export const getConfigData = async (repoId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/config/${repoId}`);
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.error || 'Failed to fetch config data');
    }
    const diagnostic = error.code ? ` (${error.code})` : '';
    throw new Error(`Network error${diagnostic}. Ensure the server is running on port 5000.`);
  }
};

export const getAiSummary = async ({ repoId, fileName, dependencies, dependents }) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/ai/summary`, {
      repoId,
      fileName,
      dependencies,
      dependents,
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.error || 'AI summary unavailable.');
    }
    const diagnostic = error.code ? ` (${error.code})` : '';
    throw new Error(`AI summary unavailable${diagnostic}.`);
  }
};
