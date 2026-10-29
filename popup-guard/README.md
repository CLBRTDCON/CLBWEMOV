# Cierre de pestañas para Cine local

Extensión opcional para Chrome y Edge de escritorio. No está instalada. El navegador integrado de Codex no ofrece carga de esta extensión.

1. Abre `chrome://extensions` en Chrome o `edge://extensions` en Edge.
2. Activa **Modo de desarrollador** y elige **Cargar descomprimida**.
3. Selecciona esta carpeta `popup-guard`, que contiene `manifest.json`.
4. Abre la app en `http://127.0.0.1:4173` en ese mismo navegador.
5. El icono muestra **ON**. Pulsarlo alterna ON/OFF. Si necesitas una fuente que rechaza el sandbox, puedes desmarcar **Bloquear nuevas pestañas del reproductor** en la app; la extensión trabaja independientemente del iframe.

La extensión usa `tabs.onCreated`, comprueba el origen de la pestaña abridora y cierra la pestaña nueva si el origen es exactamente `http://127.0.0.1:4173` o `http://localhost:4173`. No inyecta scripts en reproductores, no modifica sus peticiones ni evade sus controles. No pide el permiso global `tabs`, historial ni acceso a sitios externos; solo almacenamiento para ON/OFF y permiso de host para ver la URL de nuestra app local. Cualquier otro programa servido en esos mismos orígenes quedaría sujeto al mismo comportamiento mientras esté activa.

**Límites:** cierra después de crear la pestaña; puede verse un destello y el sitio puede iniciar una petición antes del cierre. Requiere que el navegador incluya `openerTabId` y que la pestaña abridora conserve el origen local. No distingue anuncios de enlaces legítimos abiertos desde la app: también cerrará esos enlaces; usa OFF temporalmente si necesitas abrirlos. No bloquea anuncios dentro del vídeo ni redirecciones dentro de la pestaña actual. La extensión no comunica su estado a la app y el indicador ON no prueba que un reproductor específico haya sido ensayado.

**Verificación manual pendiente:** con ON, abre una pestaña desde la app y comprueba que se cierra. Con OFF debe permanecer. Abre una pestaña desde un sitio ajeno a Cine local y comprueba que no se cierra. Después prueba un reproductor real. Las pruebas automatizadas del proyecto simulan los eventos de Chrome; no sustituyen esta comprobación de instalación.

Para retirarla, pulsa **Quitar** en el administrador de extensiones.
