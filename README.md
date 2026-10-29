# CLB Web · Vercel

Código de la web CLB, con interfaz HTML/CSS/JavaScript y APIs Node.js. Proyecto separado de las APK y de la web local de desarrollo.

## Conectar con Vercel

1. En Vercel, selecciona **Add New → Project → Import Git Repository** e importa `CLBRTDCON/CLBWEMOV`.
2. Usa la raíz del repositorio. Framework: **Other**. No establezcas un directorio `public` como Output Directory. La configuración de `vercel.json` construye una única función Node.js y dirige todas las rutas hacia ella.
3. Antes del despliegue, añade estas variables en **Environment Variables**, para Production y Preview:

   | Variable | Valor |
   | --- | --- |
   | `CLB_ACCESS_USER` | El usuario de acceso que elijas, sin `:` |
   | `CLB_ACCESS_PASSWORD` | Una contraseña larga que elijas |
   | `CLB_ALLOWED_HOSTS` | Opcional: dominios personalizados, separados por comas, sin `https://` |

4. Mantén disponibles las variables de sistema de Vercel. Se aceptan `VERCEL_URL`, `VERCEL_BRANCH_URL` y `VERCEL_PROJECT_PRODUCTION_URL`. Si un alias devuelve `Host no permitido`, añádelo a `CLB_ALLOWED_HOSTS` y despliega de nuevo; no uses comodines.
5. Despliega y abre la dirección HTTPS. El navegador solicitará usuario/contraseña. Si las credenciales no están configuradas, la aplicación devuelve **503**; nunca queda abierta por defecto en Vercel.
6. Producción: rama `main`. Los siguientes pushes a esa rama actualizarán el despliegue conectado; las otras ramas pueden producir previews.

No subas credenciales al repositorio ni las incluyas en parámetros de URL. Un repositorio privado y una web privada son controles distintos: este repositorio puede ser público, pero la web exige el acceso configurado en el servidor.

## Arquitectura de despliegue

- `api/index.mjs`: entrada Vercel sin `listen()` ni dependencia de localhost.
- `server.mjs`: rutas existentes, APIs y cabeceras de la web.
- `web-access.mjs`: validación de host y autenticación HTTP Basic sobre HTTPS para páginas, APIs y recursos.
- `public/`: interfaz y recursos locales de AVPlayer, incluidos los WASM verificados por su manifiesto.
- `mobile/`: módulos compartidos con ciertas vistas web; no contiene un proyecto Android.
- `vercel.json`: una función para todas las rutas. No publica `public/` por separado, para no saltarse la autenticación ni las cabeceras de seguridad.

La aplicación no actúa como proxy de películas: el navegador solicita el vídeo a las fuentes externas. El motor y sus recursos conservan las cabeceras COOP/COEP, CSP y MIME de WebAssembly. Los recursos servidos por la función son menores que 4.5 MB; la muestra técnica local de 12 MB se excluye y su botón está deshabilitado en esta distribución. No se modifica el reproductor normal.

La autenticación usa un usuario compartido para acceso privado sencillo. No ofrece cuentas individuales, recuperación de contraseñas ni sincronización. Las respuestas se marcan `private, no-store`; cambiar las credenciales requiere actualizar variables y desplegar de nuevo.

## Límites conocidos

- Mi lista e historial permanecen en el navegador, por origen. No migran automáticamente desde `localhost` ni se sincronizan entre dispositivos.
- La fuente de archivos CATALOG//NET depende de un servicio externo con dirección temporal. Puede dejar de responder aunque el despliegue de CLB esté sano.
- Los catálogos y proveedores pueden rechazar IP de centros de datos, imponer límites o cambiar sus formatos. Deben probarse desde el despliegue real.
- Las cachés son en memoria y pueden perderse al reciclar las funciones. No se usan como almacenamiento persistente.
- El gasto en Vercel depende del uso de funciones y transferencia de recursos; revisa Usage en el panel. No se garantiza disponibilidad ni compatibilidad audiovisual de cada archivo.

## Desarrollo y comprobación

Node.js 24 LTS. Sin dependencias npm de ejecución adicionales.

```sh
npm ci
npm run check
npm test
npm start
```

El servidor de desarrollo usa `http://127.0.0.1:4190` para no alterar la web original de 4173. `PORT` permite cambiarlo. Fuera de Vercel, el acceso local puede funcionar sin variables de contraseña; si defines credenciales, también se exigen localmente. `npm start` no lee archivos `.env` automáticamente: configura variables en tu terminal.

Prueba después de desplegar: inicio sin credenciales → 401; usuario correcto → catálogo; `/series`, `/anime`, `/ficha`, `/reproductor`, búsqueda y APIs; recursos WASM con MIME correcto. Prueba un título y episodio que ya funcionaban y confirma imagen, audio y pantalla completa. La validación local no sustituye esa comprobación desde Vercel.

## Créditos

AVPlayer / libmedia 1.3.1, LGPLv3: licencias, procedencia y manifiesto en `public/vendor/libmedia/`. HLS.js 1.7.3, Apache-2.0: licencia y procedencia junto a su distribución. Los módulos de terceros se conservan sin modificaciones. Los proveedores determinan disponibilidad e idiomas.

No se incluyen APK, claves de firma, contraseñas, respaldos ni contenido audiovisual de películas o series.
