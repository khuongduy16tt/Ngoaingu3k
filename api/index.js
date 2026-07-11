const handler = require('./[...path].js');

module.exports = function apiIndex(request, response) {
  const parsedUrl = new URL(request.url, 'http://localhost');
  const pathQuery = request.query?.path ?? parsedUrl.searchParams.get('path');
  const path = Array.isArray(pathQuery) ? pathQuery.join('/') : pathQuery;

  if (path && (request.url === '/api' || request.url.startsWith('/api?'))) {
    const searchParams = parsedUrl.searchParams;
    searchParams.delete('path');

    const queryString = searchParams.toString();
    request.url = `/api/${path}${queryString ? `?${queryString}` : ''}`;
  }

  return handler(request, response);
};
