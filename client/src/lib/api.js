const rawApiUrl = import.meta.env.VITE_API_URL || '';
const apiBaseUrl = rawApiUrl.replace(/\/+$/, '');

export function getApiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${apiBaseUrl}${normalizedPath}`;
}

export async function apiFetch(path, options = {}) {
  const { token, headers = {}, body, timeoutMs, ...fetchOptions } = options;
  const requestHeaders = {
    Accept: 'application/json',
    ...headers
  };

  let requestBody = body;
  if (body !== undefined && !(body instanceof FormData)) {
    requestHeaders['Content-Type'] = requestHeaders['Content-Type'] || 'application/json';
    requestBody = typeof body === 'string' ? body : JSON.stringify(body);
  }

  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  const controller = timeoutMs ? new AbortController() : null;
  const timeoutHandle = timeoutMs
    ? setTimeout(() => controller?.abort(), timeoutMs)
    : null;

  try {
    const response = await fetch(getApiUrl(path), {
      ...fetchOptions,
      headers: requestHeaders,
      body: requestBody,
      signal: controller?.signal
    });

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const message =
        typeof payload === 'string'
          ? payload
          : payload?.message || 'Yêu cầu chưa hoàn tất.';
      throw new Error(message);
    }

    return payload;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Yêu cầu quá thời gian chờ. Vui lòng thử lại.');
    }

    throw error;
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}
