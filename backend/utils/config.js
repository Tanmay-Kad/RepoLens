import dotenv from 'dotenv';
import path from 'path';
dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isDev = nodeEnv === 'development' || nodeEnv === 'test';

export const parsePositiveInt = (value, defaultValue, name) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Configuration error: ${name} must be a positive integer. Received: ${value}`);
  }
  return parsed;
};

const port = parsePositiveInt(process.env.PORT, 5000, 'PORT');

const getMongoUri = () => {
  const raw = process.env.MONGODB_URI;
  if (raw && raw.trim()) {
    return raw.trim();
  }
  if (nodeEnv === 'production') {
    throw new Error('Configuration error: MONGODB_URI is required when NODE_ENV is set to "production".');
  }
  console.warn('Configuration warning: MONGODB_URI not set. Using local development fallback (mongodb://127.0.0.1:27017/repolens).');
  return 'mongodb://127.0.0.1:27017/repolens';
};

const mongoUri = getMongoUri();
const geminiApiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : '';
const geminiModel = process.env.GEMINI_MODEL ? process.env.GEMINI_MODEL.trim() : 'gemini-2.5-flash';
const githubToken = process.env.GITHUB_TOKEN ? process.env.GITHUB_TOKEN.trim() : '';

const cloneRoot = process.env.CLONE_ROOT
  ? path.resolve(process.env.CLONE_ROOT.trim())
  : path.resolve(process.cwd(), 'cloned-repos');

const cloneTimeoutMs = parsePositiveInt(process.env.CLONE_TIMEOUT_MS, 120000, 'CLONE_TIMEOUT_MS');
const maxRepoSizeMb = parsePositiveInt(process.env.MAX_REPO_SIZE_MB, 200, 'MAX_REPO_SIZE_MB');
const maxRepoFiles = parsePositiveInt(process.env.MAX_REPO_FILES, 50000, 'MAX_REPO_FILES');
const maxConcurrentAnalyses = parsePositiveInt(process.env.MAX_CONCURRENT_ANALYSES, 2, 'MAX_CONCURRENT_ANALYSES');
const cloneTtlHours = parsePositiveInt(process.env.CLONE_TTL_HOURS, 24, 'CLONE_TTL_HOURS');
const cleanupIntervalMinutes = parsePositiveInt(process.env.CLEANUP_INTERVAL_MINUTES, 30, 'CLEANUP_INTERVAL_MINUTES');
const rateLimitAnalyzePerHour = parsePositiveInt(process.env.RATE_LIMIT_ANALYZE_PER_HOUR, 10, 'RATE_LIMIT_ANALYZE_PER_HOUR');
const rateLimitAiPerHour = parsePositiveInt(process.env.RATE_LIMIT_AI_PER_HOUR, 60, 'RATE_LIMIT_AI_PER_HOUR');
const analysisMaxMemoryMb = parsePositiveInt(process.env.ANALYSIS_MAX_MEMORY_MB, 512, 'ANALYSIS_MAX_MEMORY_MB');
const analysisTimeoutMs = parsePositiveInt(process.env.ANALYSIS_TIMEOUT_MS, 60000, 'ANALYSIS_TIMEOUT_MS');
export const ANALYZER_VERSION = 1;

const trustProxy = process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1';

const parseCorsOrigins = (raw) => {
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);
};

const corsOrigins = parseCorsOrigins(process.env.CORS_ORIGINS);

/**
 * Pure function to decide if a given request Origin header is allowed.
 * @param {string|undefined} origin - Origin header from request
 * @param {string[]} allowedOrigins - Configured allowed origins from CORS_ORIGINS
 * @param {boolean} devMode - Whether running in development/test mode
 * @returns {boolean}
 */
export const isOriginAllowed = (origin, allowedOrigins = [], devMode = false) => {
  // Requests with no Origin header (e.g. curl, server-to-server, health checks) are allowed
  if (!origin) return true;

  if (devMode) {
    const devAllowList = [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:4173',
      'http://127.0.0.1:4173',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ];
    if (devAllowList.includes(origin) || allowedOrigins.includes(origin)) {
      return true;
    }
    try {
      const parsed = new URL(origin);
      if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }

  // Production: strictly match configured CORS_ORIGINS
  return allowedOrigins.includes(origin);
};

export const config = {
  port,
  mongoUri,
  geminiApiKey,
  geminiModel,
  githubToken,
  nodeEnv,
  isDev,
  corsOrigins,
  cloneRoot,
  cloneTimeoutMs,
  maxRepoSizeMb,
  maxRepoFiles,
  maxConcurrentAnalyses,
  cloneTtlHours,
  cleanupIntervalMinutes,
  rateLimitAnalyzePerHour,
  rateLimitAiPerHour,
  trustProxy,
  analysisMaxMemoryMb,
  analysisTimeoutMs,
  analyzerVersion: ANALYZER_VERSION,
  hasGeminiKey: Boolean(geminiApiKey && geminiApiKey.length > 0),
};

export default config;
