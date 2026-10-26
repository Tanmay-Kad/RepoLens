/**
 * Client-side GitHub repository URL validation and normalization.
 * Mirrors server-side rules in backend/utils/githubUrl.js.
 */

export function parseAndValidateRepoUrl(input) {
  if (!input || typeof input !== 'string') {
    return {
      isValid: false,
      error: 'GitHub repository URL is required.',
      normalizedUrl: null,
      owner: null,
      repo: null,
    };
  }

  let trimmed = input.trim();
  if (trimmed.length === 0) {
    return {
      isValid: false,
      error: 'GitHub repository URL cannot be empty.',
      normalizedUrl: null,
      owner: null,
      repo: null,
    };
  }

  // Prepend https:// if user entered something starting with github.com or www.github.com
  if (/^(?:https?:\/\/)?(?:www\.)?github\.com\b/i.test(trimmed)) {
    if (!/^https?:\/\//i.test(trimmed)) {
      trimmed = `https://${trimmed}`;
    }
  }

  if (trimmed.length > 500) {
    return {
      isValid: false,
      error: 'GitHub repository URL exceeds maximum allowed length.',
      normalizedUrl: null,
      owner: null,
      repo: null,
    };
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      isValid: false,
      error: 'Invalid URL format.',
      normalizedUrl: null,
      owner: null,
      repo: null,
    };
  }

  // Strictly HTTPS
  if (parsed.protocol !== 'https:') {
    return {
      isValid: false,
      error: 'Only secure HTTPS GitHub URLs are supported.',
      normalizedUrl: null,
      owner: null,
      repo: null,
    };
  }

  // Reject embedded credentials
  if (parsed.username || parsed.password) {
    return {
      isValid: false,
      error: 'URLs with embedded credentials are not allowed.',
      normalizedUrl: null,
      owner: null,
      repo: null,
    };
  }

  // Reject custom ports
  if (parsed.port) {
    return {
      isValid: false,
      error: 'Custom ports are not allowed for GitHub URLs.',
      normalizedUrl: null,
      owner: null,
      repo: null,
    };
  }

  // Hostname must be strictly 'github.com' (case-insensitive)
  if (parsed.hostname.toLowerCase() !== 'github.com') {
    return {
      isValid: false,
      error: 'Only github.com repository URLs are supported.',
      normalizedUrl: null,
      owner: null,
      repo: null,
    };
  }

  // Extract path segments
  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length < 2) {
    return {
      isValid: false,
      error: 'GitHub URL must contain both an owner and repository name.',
      normalizedUrl: null,
      owner: null,
      repo: null,
    };
  }

  const [rawOwner, rawRepo] = segments;

  // Clean .git extension from repository name if present
  const cleanRepo = rawRepo.endsWith('.git') ? rawRepo.slice(0, -4) : rawRepo;

  if (!rawOwner || !cleanRepo) {
    return {
      isValid: false,
      error: 'Owner and repository name cannot be empty.',
      normalizedUrl: null,
      owner: null,
      repo: null,
    };
  }

  // Reject '.' and '..' segments
  if (rawOwner === '.' || rawOwner === '..' || cleanRepo === '.' || cleanRepo === '..') {
    return {
      isValid: false,
      error: 'Invalid owner or repository name.',
      normalizedUrl: null,
      owner: null,
      repo: null,
    };
  }

  // Reject segments starting with '-' (flag injection prevention)
  if (rawOwner.startsWith('-') || cleanRepo.startsWith('-')) {
    return {
      isValid: false,
      error: 'Owner and repository names cannot start with a hyphen.',
      normalizedUrl: null,
      owner: null,
      repo: null,
    };
  }

  // Only characters [A-Za-z0-9_.-]
  const validSegmentPattern = /^[A-Za-z0-9_.-]+$/;
  if (!validSegmentPattern.test(rawOwner) || !validSegmentPattern.test(cleanRepo)) {
    return {
      isValid: false,
      error: 'Owner and repository names may only contain alphanumeric characters, periods, underscores, and hyphens.',
      normalizedUrl: null,
      owner: null,
      repo: null,
    };
  }

  // Length limits per segment
  if (rawOwner.length > 100 || cleanRepo.length > 100) {
    return {
      isValid: false,
      error: 'Owner or repository name exceeds maximum allowed length.',
      normalizedUrl: null,
      owner: null,
      repo: null,
    };
  }

  const normalizedUrl = `https://github.com/${rawOwner}/${cleanRepo}`;

  return {
    isValid: true,
    owner: rawOwner,
    repo: cleanRepo,
    normalizedUrl,
    error: null,
  };
}
