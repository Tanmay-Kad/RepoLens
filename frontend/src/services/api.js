import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

export const analyzeRepository = async (url) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/analyze`, { url });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.error || 'Failed to analyze repository');
    }
    throw new Error('Network error. Ensure the server is running.');
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
    throw new Error('Network error. Ensure the server is running.');
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
    throw new Error('AI summary unavailable.');
  }
};

export const searchFilesAi = async ({ query, nodes }) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/ai/search`, { query, nodes });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.error || 'AI search failed.');
    }
    throw new Error('AI search failed.');
  }
};
