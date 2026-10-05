/**
 * Production. Same API as bipsy-web-app and the mobile apps: it used to point
 * to `/api`, which does not exist behind any proxy, so the deployed panel
 * could not talk to the backend.
 */
export const environment = {
  production: true,
  // For now the backend is not deployed anywhere: it runs on the machine of
  // whoever opens the panel. Swap for the public URL the day it is hosted.
  apiUrl: 'http://localhost:8080',
  /** Client website, used to open a business's public page. */
  webUrl: 'https://bipsy.es',
};
