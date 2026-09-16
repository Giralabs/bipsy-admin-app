/**
 * Production. Same API as bipsy-web-app and the mobile apps: it used to point
 * to `/api`, which does not exist behind any proxy, so the deployed panel
 * could not talk to the backend.
 */
export const environment = {
  production: true,
  apiUrl: 'https://gipsi-api.onrender.com',
  /** Client website, used to open a business's public page. */
  webUrl: 'https://bipsy.es',
};
