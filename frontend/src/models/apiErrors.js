/**
 * Maps HTTP status codes, error payloads, and network failures to actionable user-facing messages.
 */

export function mapApiError(error) {
  if (!error) {
    return {
      status: null,
      title: 'Unknown Error',
      message: 'An unexpected error occurred.',
      hint: 'Please try again or check your connection.',
      retryAfter: null,
      isTransient: false,
    };
  }

  const status = error.status || error.response?.status || null;
  const rawMessage = error.message || error.response?.data?.error || '';
  const retryAfter = error.retryAfter || (error.response?.headers?.['retry-after'] ? parseInt(error.response.headers['retry-after'], 10) : null);

  // Network or server unreachable
  if (!status || rawMessage.toLowerCase().includes('network error') || rawMessage.includes('ECONNREFUSED')) {
    return {
      status: 0,
      title: 'Backend Unreachable',
      message: 'Could not connect to the RepoLens AI backend service.',
      hint: 'Ensure the backend server is running on port 5000 and MongoDB is active.',
      retryAfter: null,
      isTransient: true,
    };
  }

  switch (status) {
    case 400:
      return {
        status: 400,
        title: 'Invalid Repository URL',
        message: rawMessage || 'The provided GitHub repository URL is invalid or malformed.',
        hint: 'Use the format https://github.com/owner/repository. Only public GitHub repositories are supported.',
        retryAfter: null,
        isTransient: false,
      };

    case 404:
      return {
        status: 404,
        title: 'Repository Not Found',
        message: rawMessage || 'The repository could not be found or is private.',
        hint: 'Verify the repository owner and name, and ensure the repository is public on GitHub.',
        retryAfter: null,
        isTransient: false,
      };

    case 408:
    case 504:
      return {
        status,
        title: 'Analysis Timed Out',
        message: rawMessage || 'Cloning or analyzing the repository took longer than the configured timeout.',
        hint: 'Large repositories with thousands of source files may time out. Try a smaller repository or try again later.',
        retryAfter: null,
        isTransient: true,
      };

    case 413:
    case 422:
      return {
        status,
        title: 'Repository Limit Exceeded',
        message: rawMessage || 'The repository exceeds size or supported source file limits.',
        hint: 'RepoLens is designed for repositories with under 100MB cloned size and reasonable file counts.',
        retryAfter: null,
        isTransient: false,
      };

    case 429:
      return {
        status: 429,
        title: 'Rate Limit Reached',
        message: rawMessage || 'Too many requests were sent in a short period.',
        hint: retryAfter
          ? `Please wait ${retryAfter} second${retryAfter === 1 ? '' : 's'} before submitting another repository.`
          : 'Please wait a moment before trying again.',
        retryAfter,
        isTransient: true,
      };

    case 503:
      return {
        status: 503,
        title: 'Service Busy',
        message: rawMessage || 'The analyzer concurrency limit has been reached.',
        hint: retryAfter
          ? `All analysis workers are busy. Please retry in ${retryAfter} second${retryAfter === 1 ? '' : 's'}.`
          : 'Server is currently analyzing other repositories. Please retry shortly.',
        retryAfter,
        isTransient: true,
      };

    case 500:
    default:
      return {
        status: status || 500,
        title: 'Analysis Error',
        message: rawMessage || 'An unexpected server error occurred during analysis.',
        hint: 'If the problem persists, verify that the repository contains JavaScript or TypeScript code.',
        retryAfter: null,
        isTransient: false,
      };
  }
}
