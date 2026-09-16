/**
 * Producción. Misma API que bipsy-web-app y las apps: antes apuntaba a
 * `/api`, que no existe detrás de ningún proxy, y el panel desplegado no
 * podía hablar con el backend.
 */
export const environment = {
  production: true,
  apiUrl: 'https://gipsi-api.onrender.com',
  /** Web de clientes, para abrir la ficha pública de un negocio. */
  webUrl: 'https://bipsy.es',
};
