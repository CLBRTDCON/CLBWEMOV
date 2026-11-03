# CLB Web · Vercel

Código de la web CLB, con interfaz HTML/CSS/JavaScript y APIs Node.js. Proyecto separado de las APK y de la web local de desarrollo.

## Conectar con Vercel

1. En Vercel, selecciona **Add New → Project → Import Git Repository** e importa `CLBRTDCON/CLBWEMOV`.
2. Usa la raíz del repositorio. Framework: **Other**. No establezcas un directorio `public` como Output Directory. La configuración de `vercel.json` construye una única función Node.js y dirige todas las rutas hacia ella.
3. El acceso está temporalmente **sin usuario ni contraseña**, a petición del propietario. Para volver a protegerlo, añade estas variables en **Environment Variables**, para Production y Preview:

   | Variable | Valor |
   | --- | --- |
   | `CLB_REQUIRE_AUTH` | `true` para exigir acceso; omitida o `false` permite entrar sin credenciales |
   | `CLB_ACCESS_USER` | El usuario de acceso que elijas, sin `:` |
   | `CLB_ACCESS_PASSWORD` | Una contraseña larga que elijas |
   | `CLB_ALLOWED_HOSTS` | Opcional: dominios personalizados, separados por comas, sin `https://` |

4. Mantén disponibles las variables de sistema de Vercel. Se aceptan `VERCEL_URL`, `VERCEL_BRANCH_URL` y `VERCEL_PROJECT_PRODUCTION_URL`. Si un alias devuelve `Host no permitido`, añádelo a `CLB_ALLOWED_HOSTS` y despliega de nuevo; no uses comodines.
5. Despliega y abre la dirección HTTPS. Actualmente entra sin credenciales. Si activas `CLB_REQUIRE_AUTH=true`, el navegador solicitará usuario/contraseña; con protección activada y credenciales incompletas, devuelve **503**. Cambiar variables requiere un nuevo despliegue.
6. Producción: rama `main`. Los siguientes pushes a esa rama actualizarán el despliegue conectado; las otras ramas pueden producir previews.

No subas credenciales al repositorio ni las incluyas en parámetros de URL. Un repositorio privado y una web privada son controles distintos: el acceso web está temporalmente abierto a cualquiera que tenga la dirección. Puedes reactivar la protección con `CLB_REQUIRE_AUTH=true` sin cambiar el código ni borrar las credenciales guardadas.

## Arquitectura de despliegue

- `api/index.mjs`: entrada Vercel sin `listen()` ni dependencia de localhost.
- `server.mjs`: rutas existentes, APIs y cabeceras de la web.
- `web-access.mjs`: validación de host y autenticación HTTP Basic opcional sobre HTTPS para páginas, APIs y recursos.
- `public/`: interfaz y recursos locales de AVPlayer, incluidos los WASM verificados por su manifiesto.
- `mobile/`: módulos compartidos con ciertas vistas web; no contiene un proyecto Android.
- `vercel.json`: una función para todas las rutas. No publica `public/` por separado, para no saltarse la autenticación ni las cabeceras de seguridad.

La aplicación no actúa como proxy de películas: el navegador solicita el vídeo a las fuentes externas. El motor y sus recursos conservan las cabeceras COOP/COEP, CSP y MIME de WebAssembly. Los recursos servidos por la función son menores que 4.5 MB; la muestra técnica local de 12 MB se excluye y su botón está deshabilitado en esta distribución. No se modifica el reproductor normal.

Cuando se activa, la autenticación usa un usuario compartido para acceso privado sencillo. No ofrece cuentas individuales, recuperación de contraseñas ni sincronización. Las respuestas se marcan `private, no-store`; cambiar las credenciales requiere actualizar variables y desplegar de nuevo.

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

El servidor de desarrollo usa `http://127.0.0.1:4190` para no alterar la web original de 4173. `PORT` permite cambiarlo. Fuera de Vercel, el acceso local puede funcionar sin variables de contraseña; si estableces `CLB_REQUIRE_AUTH=true`, también se exigen localmente. `npm start` no lee archivos `.env` automáticamente: configura variables en tu terminal.

Prueba después de desplegar: temporalmente sin credenciales → catálogo (200). Si reactivas la protección, sin credenciales → 401; usuario correcto → catálogo; `/series`, `/anime`, `/ficha`, `/reproductor`, búsqueda y APIs; recursos WASM con MIME correcto. Prueba un título y episodio que ya funcionaban y confirma imagen, audio y pantalla completa. La validación local no sustituye esa comprobación desde Vercel.

## Créditos

AVPlayer / libmedia 1.3.1, LGPLv3: licencias, procedencia y manifiesto en `public/vendor/libmedia/`. HLS.js 1.7.3, Apache-2.0: licencia y procedencia junto a su distribución. Los módulos de terceros se conservan sin modificaciones. Los proveedores determinan disponibilidad e idiomas.

No se incluyen APK, claves de firma, contraseñas, respaldos ni contenido audiovisual de películas o series.


## Internet Archive experimental (02/11/2026)

En la ficha aparece una consulta opcional a Archive, independiente de CATALOG//NET. El backend consulta archive-addon.onrender.com y contrasta los resultados con metadatos de archive.org. Películas: coincidencia IMDb explícita o título y año. Series: IMDb explícito y SxxExx exacto en el nombre del archivo. Solo MP4/WebM; archivos con altura declarada superior a1080 se excluyen. No convierte audio ni actúa como proxy de vídeo; los controles son los nativos del navegador. Se descartan resultados ambiguos, restringidos o sin un archivo correspondiente. Estas comprobaciones no certifican identidad audiovisual, totalidad, idioma ni disponibilidad.

CATALOG//NET conserva su integración por si vuelve; los errores de conexión ahora indican indisponibilidad del servicio (503) en vez de confundirse con ausencia de archivos. No se cambió su URL por una dirección no verificada. Los reproductores anteriores y AVPlayer permanecen.

Archive solo se consulta al pulsar el botón. Límite2consultas concurrentes, cuatro elementos de Archive contrastados por búsqueda, respuestasJSON2MB, tiempo35s, caché120s y fallo30s. Orígenes de consulta fijos; no se aceptan URLs externas desde el cliente. No se ejecuta código del complemento. Cerrar/cambiar episodio elimina el vídeo y cancela la consulta. Kids no muestra esta opción. Probar desde el despliegue real: el acceso desde una computadora no demuestra acceso desde Vercel.

Respaldo local anterior work/before-archive-20261102-133635.zip (184archivos cotejados). El commit previo de rollback es4eaf560f43d6ef6d1d25b3cda8a9e61a55de47e3. Sin cambios en APKs ni servidor local4173.


## Acceso Latinobrid por dispositivo

El menú común incluye **Acceso Latinobrid**, que abre `/activar`. La activación no solicita la clave TorBox al visitante. Desde `/administracion/accesos`, el administrador genera códigos de un solo uso, válidos para canjear durante diez minutos. Cada canje autoriza ese navegador durante 30 días. Borrar cookies, cambiar de navegador o de dispositivo exige otra activación. El administrador puede revocar dispositivos y códigos pendientes.

Variables de Production, guardadas como secretos en Vercel:

- `CLB_LATINOBRID_MANIFEST`: manifest personal completo. Nunca versionarlo ni devolverlo al navegador.
- `CLB_ADMIN_PASSWORD_HASH`: hash scrypt generado por la configuración local. No es la contraseña en texto.
- Redis REST: `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`, o `KV_REST_API_URL` y `KV_REST_API_TOKEN`. Esta instalación también acepta el prefijo de integración `clbweb_KV_REST_API_URL` y `clbweb_KV_REST_API_TOKEN`. No usar el token de solo lectura.

La integración Upstash se conecta a Production; guardar variables requiere un nuevo despliegue. Sin almacenamiento o hash de administrador, la API de accesos responde 503. No hay respaldo en memoria ni escritura al disco efímero de Vercel. La contraseña solo se crea localmente; Production permite iniciar sesión con ella. Los códigos locales no se trasladan automáticamente a Redis.

Las sesiones usan cookies HttpOnly, Secure en Vercel y SameSite Strict. Los códigos y tokens se almacenan mediante hashes. El canje es atómico mediante CAS de Redis para evitar usos simultáneos. Los intentos de acceso están limitados. El límite global de intentos puede bloquear temporalmente accesos legítimos ante abuso; esta versión está pensada para uso reducido.

En Vercel, los archivos salen del CDN de TorBox y no pasan por una función de vídeo. La resolución exige un enlace HTTPS del CDN esperado y CORS compatible. Un visitante autorizado puede inspeccionar su enlace temporal; revocar el acceso impide emitir otros enlaces pero no invalida los ya emitidos por TorBox. No se garantiza revocación inmediata de una reproducción existente.

## Visibilidad del catálogo según archivos

Los catálogos y búsqueda consultan automáticamente `/api/availability/check` y muestran candidatos con archivos HTTP anunciados hasta 1080p. Hay caché, deduplicación y consultas limitadas; un fallo de proveedor se registra como desconocido y no como ausencia confirmada. Esto verifica opciones anunciadas, no certifica decodificación ni idioma. Para series se comprueba el primer episodio, no todas las temporadas. Las fichas por enlace directo siguen accesibles. La verificación usa el manifest exclusivamente del servidor y no entrega sus credenciales.

Validación de publicación: `/activar` y `/administracion/accesos` devuelven la interfaz común; `/api/access/status` responde sin errores de configuración; una consulta Latinobrid sin cookie devuelve 401. Iniciar sesión como administrador, crear un código, canjearlo en otro navegador y comprobar vigencia, segundo canje rechazado y revocación. Los tests automatizados cubren canje concurrente, expiración, autorización y CAS. La prueba real de reproducción se realiza aparte con un título conocido.

Rollback: volver al despliegue anterior desde Vercel. Conservar Redis y los secretos; nunca publicar el contenido de `work/`, `.env` o enlaces personales para resolver un despliegue fallido.


## Filas por plataforma

La navegación web predeterminada de Películas y Series separa Apple TV+, Netflix, HBO Max, Disney+ y Prime Video por tipo de contenido. Se consulta Streaming Catalogs con rutas `/catalog/movie/…` o `/catalog/series/…`, sin deducir pertenencia por el título ni mezclar ambos tipos. Cada fila tiene paginación independiente, deduplicación, carga cerca de la pantalla y comprobación automática de archivos. La búsqueda por texto mantiene la búsqueda amplia anterior; el filtro de año se aplica también a las filas. Las recomendaciones de películas conservan el año actual y el anterior.

Anime muestra Crunchyroll, Netflix · Anime, AniList y Kitsu. En Netflix se admite solo animación con Japón como primer país informado por la fuente. Es una clasificación conservadora por metadatos: excluye animación occidental y acción real, pero puede omitir coproducciones o fichas incompletas. No equivale a una clasificación editorial infalible. Los títulos Crunchyroll/Netflix conservan su identidad IMDb de serie dentro de la sección Anime, para que capítulos y comprobación de archivos usen la API correcta.

Las plataformas describen la clasificación del catálogo externo; no se reproducen desde cuentas de Netflix/Apple. La disponibilidad de vídeo sigue dependiendo de los archivos/proveedores de CLB. Las filas recorren el catálogo que expone la fuente, no prometen un inventario completo mundial ni regional.

Se retiraron de la ficha el botón de comprobación manual y el panel experimental de Internet Archive. La comprobación de proveedores continúa automáticamente. Esto no retira los documentales que ya utilizan Archive por una integración independiente.

Las filas intentan reunir 24 opciones comprobadas de manera progresiva, recorriendo hasta tres páginas de la fuente automáticamente. Si hay fallos de verificación se detiene el llenado automático; el botón Cargar más permite continuar. Este límite evita consultas sin fin y no garantiza un mínimo cuando no hay archivos. Las recomendaciones de series también se limitan al año actual y el anterior.


### Catálogos web (noviembre de 2026)

Dramas se retiró de la navegación, búsquedas y rutas HTTP. Las rutas antiguas devuelven 410 sin consultar proveedores. Documentales usa una sola cuadrícula de películas y docuseries, con búsqueda, año y carga progresiva automática, sin agrupar por fuente. La consulta conjunta no pide Archive, cuyos archivos no pasan el filtro de enlaces por calidad.

Películas y Series comienzan con «Estrenos»: combina las cinco plataformas y metadatos recientes, deduplica por IMDb y ordena por fecha de estreno del título (año cuando no existe fecha). Sin filtro de año usa el actual y anterior, excluyendo fechas futuras. No representa nuevas temporadas ni episodios. La agregación y las consultas por plataforma comparten caché de cinco minutos y peticiones en curso. El filtro de archivos disponibles se mantiene.


Los catálogos públicos usan `catalog-runtime.js`: caché de metadatos de dos minutos en la sesión, deduplicación de solicitudes y cancelación independiente por consumidor. Se excluyen activaciones, configuración personal, respuestas de complementos y URLs de vídeo. Los resultados de presencia de archivos se conservan 30 minutos para positivos y cinco para negativos, con dos lotes simultáneos; un error permanece como desconocido y puede reintentarse. El servidor limita las consultas del complemento a dos y atiende antes la selección de reproducción en espera.

`auto-pagination.js` reemplaza los controles de cargar más por carga al aproximarse al final de la lista o de una fila horizontal. Los errores mantienen Reintentar. Las flechas de cada plataforma permiten continuar explorando; las consultas automáticas se acotan para no recorrer indefinidamente páginas vacías o repetidas. Los recursos y controladores de APK no se publican mediante una compilación Android en este cambio.

### Ventana flotante de AVPlayer

El parche local del componente Pip de libmedia 1.3.1 mueve únicamente el contenedor del reproductor. La clase `clb-player-pip` elimina márgenes, alturas mínimas, bordes y scroll de la ventana secundaria. Los cambios de tamaño se agrupan cada 150 ms al terminar la ráfaga, se ignoran dimensiones repetidas/cero y se restaura el nodo en su posición original al cerrar. No se captura ni recodifica el vídeo y no se crea un segundo motor. El cierre y la destrucción cancelan los temporizadores pendientes. El hash del recurso modificado se registra en MANIFEST.json.

Las pruebas del componente cubren restauración de DOM, ráfagas de resize, limpieza y errores de apertura. El rendimiento al arrastrar la ventana nativa depende también del compositor y GPU del navegador; esas pruebas no certifican ausencia de tirones en todos los equipos.
