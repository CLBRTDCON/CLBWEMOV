# Web: catálogos, episodios, recuperación y recomendaciones

Cambios sobre la base `51643eb48abf9735f96e301c1f520201ece576e3`.

- Los estantes piden `sort=recent`. Anime incorpora Estrenos y utiliza el catálogo ampliado de Netflix existente en el backend. La comprobación conserva el tipo explícito movie/series aunque la sección sea anime.
- Las comprobaciones de disponibilidad se envían en grupos de dos, con dos peticiones simultáneas. Las respuestas desconocidas siguen siendo desconocidas, sin bloquear la exploración de otras páginas. Los límites de exploración y de concurrencia del servidor se conservan.
- Los cambios de disponibilidad insertan o mueven tarjetas existentes sin reconstruir las portadas de toda la fila. Los complementos configurados se consultan concurrentemente y conservan el control de cancelación por episodio.
- En series se elige primero un episodio. Sus fuentes aparecen a la derecha en escritorio y debajo en pantallas pequeñas. La URL conserva temporada y episodio; al regresar se recuperan desplazamiento y foco del capítulo.
- Los archivos del complemento incluyen una clave opaca calculada en el servidor a partir de sus metadatos. La renovación exige una coincidencia única y la resolución vuelve a comprobar esa clave: un índice reordenado no puede abrir otra variante silenciosamente. No constituye una verificación criptográfica del contenido del vídeo.
- Ante un fallo de red recuperable, AVPlayer hace como máximo una renovación automática por apertura, conserva la posición y permite una recuperación manual posterior. Los errores de permisos, límites de peticiones, formatos y cambios ambiguos de archivo no disparan el reintento automático. Los iframes de terceros conservan sus controles y limitaciones.
- El progreso de los archivos de complementos se guarda con proveedor, episodio y clave de variante. No se guardan URLs temporales. La biblioteca conserva compatibilidad con sus registros anteriores.
- «Porque viste…» utiliza únicamente progreso confirmado de al menos cinco minutos o una reproducción terminada, normaliza géneros español/inglés y selecciona títulos del año actual/anterior ya comprobados en los estantes cargados. Sin historial suficiente no se muestra una personalización ficticia. No realiza nuevas peticiones de catálogo ni sincroniza dispositivos.

## Verificación

Ejecutar `npm run check` y `npm test`. Las regresiones cubren identidad de anime, tipos de contenido, cancelación de episodios, persistencia, coincidencia exacta de variantes, renovación y recomendaciones sin clics como evidencia de reproducción.

La revisión con Chromium en un servidor aislado comprobó la distribución a 375, 800, 1280 y 1920 píxeles, la elección del episodio y las recomendaciones con datos controlados. Una prueba de fallo simulada renovó una variante desplazada del índice 0 al 1, recuperó el segundo 60 y se detuvo tras el único reintento permitido. Una muestra sintética H.264 con AC-3/E-AC-3 comprobó el avance del motor real; no certifica todas las fuentes, dispositivos ni salida audible del equipo del usuario.

## Recuperación del despliegue

Respaldo local previo: `work/before-web-five-improvements.zip` (no se publica). Para deshacer esta entrega, revertir su commit en main y publicar la reversión; alternativamente, restaurar el deployment anterior desde Vercel. No borrar ni sobrescribir las variables privadas de entorno.
