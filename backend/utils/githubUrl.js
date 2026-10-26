/**
 * Validates and normalizes GitHub repository URLs.
 *
 * Rules:
 * - Scheme must be strictly HTTPS.
 * - Host must be strictly 'github.com' (case-insensitive).
 * - No credentials, no custom ports.
 * - Input length must not exceed 500 characters.
 * - Owner and repo must contain only [A-Za-z0-9_.-], must not start with '-', and must not be '.' or '..'.
 * - Optional .git suffix, trailing slash, and /tree/... or similar sub-paths are ignored.
 * - Normalizes to https://github.com/{owner}/{repo}.
 *
 * @param {string} rawUrl - Input URL string
 * @returns {{ isValid: boolean, owner?: string, repo?: string, normalizedUrl?: string, error?: string }}
 */
export const parseGitHubUrl = (rawUrl) => {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { isValid: false, error: 'GitHub repository URL is required.' };
  }

  const trimmed = rawUrl.trim();
  if (trimmed.length === 0) {
    return { isValid: false, error: 'GitHub repository URL cannot be empty.' };
  }

  if (trimmed.length > 500) {
    return { isValid: false, error: 'GitHub repository URL exceeds maximum allowed length.' };
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { isValid: false, error: 'Invalid URL format.' };
  }

  // Strictly HTTPS
  if (parsed.protocol !== 'https:') {
    return { isValid: false, error: 'Only secure HTTPS GitHub URLs are supported.' };
  }

  // Reject embedded credentials
  if (parsed.username || parsed.password) {
    return { isValid: false, error: 'URLs with embedded credentials are not allowed.' };
  }

  // Reject custom ports
  if (parsed.port) {
    return { isValid: false, error: 'Custom ports are not allowed for GitHub URLs.' };
  }

  // Hostname must be strictly 'github.com' (case-insensitive)
  if (parsed.hostname.toLowerCase() !== 'github.com') {
    return { isValid: false, error: 'Only github.com repository URLs are supported.' };
  }

  // Extract path segments
  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length < 2) {
    return { isValid: false, error: 'GitHub URL must contain both an owner and repository name.' };
  }

  const [rawOwner, rawRepo] = segments;

  // Clean .git extension from repository name if present
  const cleanRepo = rawRepo.endsWith('.git') ? rawRepo.slice(0, -4) : rawRepo;

  if (!rawOwner || !cleanRepo) {
    return { isValid: false, error: 'Owner and repository name cannot be empty.' };
  }

  // Reject '.' and '..' segments
  if (rawOwner === '.' || rawOwner === '..' || cleanRepo === '.' || cleanRepo === '..') {
    return { isValid: false, error: 'Invalid owner or repository name.' };
  }

  // Reject segments starting with '-' (flag injection prevention)
  if (rawOwner.startsWith('-') || cleanRepo.startsWith('-')) {
    return { isValid: false, error: 'Owner and repository names cannot start with a hyphen.' };
  }

  // Only characters [A-Za-z0-9_.-]
  const validSegmentPattern = /^[A-Za-z0-9_.-]+$/;
  if (!validSegmentPattern.test(rawOwner) || !validSegmentPattern.test(cleanRepo)) {
    return {
      isValid: false,
      error: 'Owner and repository names may only contain alphanumeric characters, periods, underscores, and hyphens.',
    };
  }

  // Length limits per segment
  if (rawOwner.length > 100 || cleanRepo.length > 100) {
    return { isValid: false, error: 'Owner or repository name exceeds maximum allowed length.' };
  }

  const normalizedUrl = `https://github.com/${rawOwner}/${cleanRepo}`;

  return {
    isValid: true,
    owner: rawOwner,
    repo: cleanRepo,
    normalizedUrl,
  };
};

export default parseGitHubUrl;
