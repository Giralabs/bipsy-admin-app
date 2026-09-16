# Bipsy Admin

Panel interno del equipo de Bipsy. Angular 22 (standalone, zoneless, signals), mismo sistema de diseño que `bipsy-web-app` y `bipsy-business-web-app` (modo «lift»: superficies planas, Bricolage Grotesque + Plus Jakarta Sans, Material Symbols, tema claro y oscuro).

## Arrancar

```bash
npm install
npm start            # http://localhost:4300  (las webs usan :4200)
```

Necesita el backend en `http://localhost:8080` (`src/environments/environment.development.ts`). En producción apunta a `https://gipsi-api.onrender.com`, la misma API que las apps.

Solo entran cuentas con rol `ADMIN`. El alcance (`adminScope` en `actor`) decide qué se puede tocar:

| Scope      | Puede                                                                 |
|------------|-----------------------------------------------------------------------|
| `FULL`     | Todo                                                                  |
| `SUPPORT`  | Consultar todo y gestionar tickets de soporte                         |
| `READONLY` | Solo consultar                                                        |

La sesión se renueva sola con el refresh token (`POST /auth/refresh`) cuando caduca el access token de 30 min.

## Secciones

- **Resumen**: lo que pide atención (tickets sin atender, reportes pendientes, altas a medias, baneos), cifras clave, reparto de reservas y tickets, últimos tickets y actividad del equipo.
- **Clientes**: búsqueda, filtro por reputación, CSV. Ficha con negocios visitados, sanciones (suspensión con duración o baneo, IPs extra), cobros y tarjetas, restablecer cuenta e historial de acciones.
- **Negocios**: búsqueda, filtro de baneo, CSV. Ficha con datos fiscales, referidos, suscripciones (asignar plan con fecha fin, cancelar), ofertas de acceso, sus tickets, historial, enlace a su página pública y baneo.
- **Soporte**: bandeja por estado (y por negocio). Ticket como conversación con adjuntos, respuestas rápidas, «enviar y resolver», estado, prioridad y notas internas.
- **Reportes**: bandeja de denuncias; revisar, descartar o reabrir.
- **Planes y ofertas**: catálogo de planes con sus funciones y todas las ofertas (globales o por negocio); crear y revocar.
- **Categorías**: crear, editar, ocultar y activar.
- **Explorar**: umbrales de destacados, franjas de distancia y días de «nuevo».
- **Referidos**: ranking de negocios por clientes traídos.
- **Auditoría**: todas las escrituras del panel, agrupadas por día.
- **Buscador** (`Ctrl K` o `/`): clientes, negocios y tickets; `#42` abre el ticket 42.
- **Mejoras**: solicitudes de mejora de los negocios con plan Quality (tickets `IMPROVEMENT`), separadas de soporte.
- **Reseñas**: todas las publicadas; retirarlas con motivo.
- **Equipo del panel**: crear cuentas de administración, cambiar permisos y contraseña, desactivar. Nadie puede quitarse permisos a sí mismo y siempre queda un admin con acceso completo.
- **Ficha de negocio**: además de lo anterior, sus clientes, citas (cancelar), equipo e invitaciones, servicios y horario, reseñas, fotos del portfolio (retirar), cobros y enviar un aviso push.
- **Ficha de cliente**: citas (cancelar), reseñas y enviar un aviso push.
- **Cobros**: todo lo cobrado a clientes (tarifas por cancelar, cambiar la hora o no acudir, y pagos de cita), con totales, filtros y fechas. Ficha de cada cobro: devolver todo o una parte (a la tarjeta con Stripe, o registrar una devolución hecha por otra vía), reintentar un cobro fallido y cobrar una tarifa de una cita. Pestañas de devoluciones y facturas de plan de los negocios.
- **Bienvenidas**: negocios recién llegados, sobre todo en cortesía o prueba, ordenados por lo que les queda antes de pagar. Soporte registra cada llamada (resultado, notas, cuándo volver a llamar) y el menú cuenta los que tocan.
- **Legal**: los textos publicados (copiados de las webs en `core/legal/`), con búsqueda, atajos a lo más consultado, copiar un apartado y datos del titular.
- **Tiempo real**: el panel pregunta cada 6 s por `GET /admin/live` y recarga en silencio solo las pantallas cuyos datos han cambiado.

## Mi cuenta: diseño y accesibilidad

Se guardan en el navegador (`localStorage`), así que cada puesto puede tener lo suyo:

- **Diseño**: panel lateral o **bloques** (pantalla de inicio con un bloque grande por sección, para pantallas grandes o táctiles).
- Tema, tamaño de letra, animaciones, alto contraste, subrayar enlaces, botones más grandes y foco muy visible.

## Endpoints del backend

Usa los controladores `Admin*` existentes y estos, añadidos para el panel (solo altas, nada existente cambia):

- `GET /admin/reports`, `PUT /admin/reports/{id}/status`
- `GET /admin/grants?businessId=`, `GET /admin/features`
- `GET /admin/audit-log/entity?entityType=&entityId=`
- `GET /admin/businesses/{id}/access`: lo que ve la app del negocio (estado, plan, días)
- `POST /admin/businesses/{id}/free-plan`: regalar un plan hasta una fecha o sin fin
- `POST /admin/businesses/{id}/revoke-access`: quitar lo regalado (sin plan de pago, va al muro de pago)
- `PUT /admin/businesses/{id}/super-access`: cuenta que nunca se bloquea
- `PUT /admin/subscriptions/{id}/period-end`: alargar o acortar un plan regalado
- `GET /admin/subscriptions?source=&status=`: todas las suscripciones
- `GET /admin/businesses/{id}/overview | customers | workers | invitations | services | schedule | portfolio | bookings | payments`
- `DELETE /admin/portfolio/{imageId}`, `GET /admin/reviews`, `DELETE /admin/reviews/{id}`
- `GET /admin/support/tickets/by-kind?kind=&status=&businessId=`
- `GET /admin/customers/{id}/bookings`, `POST /admin/bookings/{id}/cancel`, `POST /admin/actors/{id}/notify`
- `GET|POST /admin/team`, `PUT /admin/team/{id}`, `PUT /admin/team/{id}/password`, `PUT /admin/team/{id}/enabled`
- `GET /admin/payments?kind=&status=&businessId=&customerId=&bookingId=&from=&to=&q=`, `GET /admin/payments/summary | refunds | invoices`, `GET /admin/payments/{id}`, `POST /admin/payments/{id}/refund | retry`, `POST /admin/payments/charge`
- `GET /admin/support/onboarding?days=`, `GET|POST /admin/support/onboarding/{businessId}/contacts` (bajo `/support` para que el scope Soporte pueda registrar llamadas; se guardan en la auditoría como `ONBOARDING_CALL`)
- `GET /admin/live`: huella por área para el tiempo real

Cancelar una cita desde el panel avisa a las dos partes y libera la tarjeta, pero no cobra penalizaciones ni devuelve lo prepagado. Los avisos push necesitan Firebase configurado en el backend.

Lo contratado en Stripe o en las tiendas no se toca desde el panel: cancelarlo aquí solo cambiaría la fila y la pasarela seguiría cobrando. Sin cobro configurado en el backend nadie se bloquea, y el panel lo avisa.

Si el backend desplegado aún no los tiene, el panel lo indica en la sección afectada y el resto sigue funcionando (`GET /admin/reports` cae a `GET /reports`).

Todas las llamadas están en `src/app/core/services/admin-api.service.ts` y los contratos en `src/app/core/models/admin.models.ts`.

## Comprobar

```bash
npm run build
npm test -- --watch=false
```
