let appPromise = null;

async function getApp() {
  if (!appPromise) {
    appPromise = import('../server/src/app.js').then(({ createApp }) => createApp());
  }

  return appPromise;
}

module.exports = async function handler(request, response) {
  const app = await getApp();
  return app(request, response);
};
