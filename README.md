# Combustible Demo

Versión pública de mi tablero de combustible, preparada para mostrar el código sin publicar información de una empresa. Conserva la interfaz de consulta, los filtros y la exportación a Excel.

**Todos los datos son ficticios.** Los registros se generan con fórmulas fijas: cuatro vehículos `DEMO-01` a `DEMO-04`, conductores inventados, dos sedes de ejemplo y movimientos entre mayo y octubre de 2026. El período inicial es octubre de 2026.

## Qué se puede probar

- Resumen de gasto, combustible y recorridos.
- Filtros por fechas, sede, vehículo y origen.
- Gráficos, comparativas y tablas con búsqueda y paginación.
- Consulta de odómetros y detalle de documentos simulados.
- Exportación a Excel con la identificación de datos ficticios.
- Tema claro y oscuro.

La demo es de solo lectura. No requiere credenciales, base de datos ni servicios externos. Las rutas de datos generan respuestas en el propio servidor local; no consultan n8n, SharePoint ni sistemas de una organización. Las etiquetas de validación documental representan casos de ejemplo, no validaciones de facturas reales.

## Ejecutar

Requisitos: **Node.js 24** y npm.

```sh
npm ci
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000). Se usa Next.js para ejecutar la interfaz de React y las rutas locales de la demo.

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm start
```

La instalación inicial descarga paquetes de npm. Después de compilar, la demo no necesita conectarse a una fuente de datos externa. Los filtros fuera del período de muestra devuelven tablas vacías.

## Qué cambió para publicarla

Se creó un repositorio con historial nuevo. No se copiaron los registros originales, documentos, scripts de extracción, metadatos de hosting, configuraciones de acceso ni el historial del proyecto privado.

La interfaz y sus utilidades de presentación se conservaron. El acceso a servicios se sustituyó por `app/lib/demo.ts`, que genera la muestra y sus resúmenes. Se retiraron las funciones de edición y migración; los endpoints de escritura responden con estado 405.

El proyecto original permanece privado. Esta copia muestra mi trabajo en el tablero y no es una herramienta lista para operar una flota real.

**Tecnologías:** React, TypeScript, Next.js y ExcelJS.

**Contacto:** [luistzncan@gmail.com](mailto:luistzncan@gmail.com).
