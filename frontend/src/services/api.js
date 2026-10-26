import axios from 'axios';

const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
    const cleanHost = envUrl.trim().replace(/\/+$/, '');
    return `${cleanHost}/api`;
  }
  if (import.meta.env.DEV) {
    return 'http://localhost:5000/api';
  }
  console.error('RepoLens configuration error: VITE_API_URL is not configured for production build.');
  throw new Error('API not configured. Please set VITE_API_URL in your environment.');
};

const createApiError = (error, defaultMsg) => {
  if (error.message?.includes('API not configured')) {
    return error;
  }
  if (axios.isCancel(error)) {
    const cancelErr = new Error('Request was canceled');
    cancelErr.name = 'CanceledError';
    cancelErr.isCanceled = true;
    return cancelErr;
  }
  const status = error.response?.status || null;
  const retryAfterHeader = error.response?.headers?.['retry-after'];
  const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : null;
  const message = error.response?.data?.error || (error.response ? defaultMsg : 'Network error. Ensure the server is running.');

  const err = new Error(message);
  err.status = status;
  err.retryAfter = retryAfter;
  return err;
};

export const analyzeRepository = async (url, options = {}) => {
  try {
    const baseUrl = getApiBaseUrl();
    const response = await axios.post(`${baseUrl}/analyze`, { url }, options);
    return response.data;
  } catch (error) {
    throw createApiError(error, 'Failed to analyze repository');
  }
};

export const getGraphData = async (repoId, options = {}) => {
  try {
    const baseUrl = getApiBaseUrl();
    const response = await axios.get(`${baseUrl}/graph/${repoId}`, options);
    return response.data;
  } catch (error) {
    throw createApiError(error, 'Failed to fetch graph data');
  }
};

export const getAiSummary = async ({ repoId, fileName, dependencies, dependents }, options = {}) => {
  try {
    const baseUrl = getApiBaseUrl();
    const response = await axios.post(`${baseUrl}/ai/summary`, {
      repoId,
      fileName,
      dependencies,
      dependents,
    }, options);
    return response.data;
  } catch (error) {
    throw createApiError(error, 'AI summary unavailable.');
  }
};

export const searchFilesAi = async ({ query, nodes }, options = {}) => {
  try {
    const baseUrl = getApiBaseUrl();
    const response = await axios.post(`${baseUrl}/ai/search`, { query, nodes }, options);
    return response.data;
  } catch (error) {
    throw createApiError(error, 'AI search failed.');
  }
};

export const getRepoAudit = async (repoId, options = {}) => {
  try {
    const baseUrl = getApiBaseUrl();
    const response = await axios.get(`${baseUrl}/audit/${repoId}`, options);
    return response.data;
  } catch (error) {
    throw createApiError(error, 'Failed to fetch security audit');
  }
};
