# CLB - Bloquear pestañas emergentes (1.1.0)

Extensión opcional para Chrome, Edge y Brave de escritorio. Descargar el ZIP no la instala. Los navegadores habituales de móviles y Smart TV no permiten instalar esta extensión.

1. Descomprime el ZIP en una carpeta permanente.
2. Abre chrome://extensions, edge://extensions o brave://extensions.
3. Activa Modo de desarrollador y pulsa Cargar descomprimida.
4. Selecciona la carpeta donde descomprimiste el ZIP: manifest.json debe estar directamente dentro de ella.
5. Abre https://clbwemov.vercel.app/ en ese navegador. El icono ON indica que está activada; pulsarlo alterna ON/OFF.

Funciona solo para los orígenes exactos https://clbwemov.vercel.app, http://127.0.0.1:4173 y http://localhost:4173. Usa tabs.onCreated y cierra pestañas cuyo openerTabId corresponda a CLB. No pide acceso general al historial, no inyecta scripts ni envía datos. Solo guarda ON/OFF localmente.

Límites: cierra la pestaña después de abrirse; puede verse un destello e iniciarse una petición. Depende de que el navegador entregue openerTabId y que la pestaña abridora siga en CLB. También cierra enlaces legítimos abiertos desde CLB: desactívala temporalmente para utilizarlos. No elimina anuncios dentro del vídeo ni bloquea redirecciones de la pestaña actual. La web no detecta si está instalada. ON no confirma una prueba real con cada proveedor.

Prueba manual: con ON abre una pestaña desde CLB; debe cerrarse. Con OFF debe permanecer. Las pestañas abiertas desde otros sitios deben mantenerse. Prueba después un proveedor real. Las pruebas automatizadas simulan Chrome y no sustituyen esta comprobación.

Para desinstalarla pulsa Quitar en el administrador de extensiones.
