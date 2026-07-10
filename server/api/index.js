import { createApp } from '../src/app.js';

let appPromise = null;

export default async function handler(request, response) {
  if (!appPromise) {
    appPromise = createApp();
  }

  const app = await appPromise;
  return app(request, response);
}
