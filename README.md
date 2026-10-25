# Parche Backend (minifood)

API en Node.js + Express con PostgreSQL (Neon). Organizada por los módulos del panel administrativo.

## Arranque rápido

```bash
npm install
# 1. Crea y edita .env:
#    PowerShell: Copy-Item .env.example .env
#    - DATABASE_URL  (cadena de Neon)
#    - JWT_SECRET    (node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
#    - ADMIN_EMAIL / ADMIN_PASSWORD (primer administrador)
#    - DEFAULT_PASSWORD_ADMINISTRADOR / DEFAULT_PASSWORD_EMPLEADO / DEFAULT_PASSWORD_DOMICILIARIO
npm run db:setup     # crea las 26 tablas + roles, privilegios, módulos, permisos y el admin
npm run dev
```

`npm run db:init` (solo esquema) y `npm run db:seed` (solo datos base) también existen. Ambos son idempotentes.

Configura contraseñas temporales diferentes en el `.env` para cada rol de personal
(y `DEFAULT_PASSWORD_<ROL>` para roles personalizados). Cada contraseña debe tener entre 8 y 72
caracteres e incluir una mayúscula, una minúscula y un número. El servidor las asigna al crear
usuarios de personal, devuelve la clave temporal solo en la respuesta de alta y exige cambiarla
en `PATCH /api/auth/me/contrasena-inicial` antes de permitir cualquier otra ruta autenticada.
Las cuentas de cliente conservan la contraseña que el cliente eligió.

## Cómo se usa la seguridad

1. `POST /api/auth/login` con `{ "correo", "contrasena" }` devuelve `token`, usuario, roles y permisos.
2. Todas las demás rutas (salvo `/health`, `/auth/login`, `/auth/registro`) exigen `Authorization: Bearer <token>`.
3. Cada ruta valida contra la BD que algún rol del usuario tenga el privilegio (`VER`, `CREAR`, `EDITAR`, `ELIMINAR`) en el módulo.
   Los permisos se leen en cada petición: si cambias un rol o desactivas a alguien, aplica de inmediato.

Los JWT duran 365 días por defecto (`JWT_EXPIRES_IN` permite cambiarlo). Esta vigencia es compartida por todos los módulos, incluido barrios. Si un token ya venció, inicia sesión de nuevo para recibir uno vigente; cambiar esta duración no renueva tokens emitidos anteriormente.

## Módulos y rutas

| Módulo del panel | Ruta | Estado |
|---|---|---|
| Roles y permisos | `/api/roles` (+ `/catalogo`, `PUT /:id/permisos`) | Listo |
| Usuarios | `/api/usuarios` (DELETE reasigna registros al administrador principal y elimina) | Listo |
| Categ. Insumos | `/api/categorias-insumos` | Listo |
| Insumos | `/api/insumos` | Listo |
| Proveedores | `/api/proveedores` (DELETE desactiva) | Listo |
| Compras | `/api/compras` | Pendiente (sube stock, transacción) |
| Pérdida Insumos | `/api/perdidas-insumos` | Pendiente (baja stock, transacción) |
| Categ. Producto | `/api/categorias-productos` | Listo |
| Productos | `/api/productos` | Listo |
| Órdenes de Prod. | `/api/ordenes-produccion` | Panel sincronizado; reposiciones transaccionales |
| Prod. No Conforme | `/api/productos-no-conformes` | Panel sincronizado; vínculo de reposición |
| Clientes | `/api/clientes` (solo lectura) | Listo |
| Pedidos | `/api/pedidos` | Pendiente |
| Ventas | `/api/ventas` | Pendiente |
| Devoluciones | `/api/devoluciones` | Pendiente |

Las tablas de los módulos pendientes ya existen en `sql/init.sql`.
Al registrar un producto no conforme que genera reposición, el panel usa
`POST /api/productos-no-conformes/con-reposicion`: registra la orden nueva y el
producto no conforme en una transacción, los vincula en la base de datos y,
cuando se informa la orden afectada, guarda también su cambio de estado dentro
de la misma transacción.

## Barrios y estimación de entrega

`npm run db:init` crea/actualiza el catálogo `barrios`, habilita los 18 barrios
suministrados por el negocio y agrega `id_barrio`, `tipo_entrega` y
`estimacion_inicial` a `pedidos`.
Ejecuta también `npm run db:seed` para incorporar el módulo y los permisos
administrativos `BARRIOS`. La lista es el catálogo inicial del negocio, no un
inventario oficial ni completo. Solo Santa Ana recibe la referencia inicial de
5 minutos (`es_cercano: true`); los otros tiempos quedan sin configurar hasta que
se validen y registren datos medidos. El `db:init` es idempotente y no reemplaza
los tiempos que ya haya configurado una persona administradora.

Endpoints autenticados:

| Método y ruta | Uso |
|---|---|
| `GET /api/barrios?buscar=ana` | Barrios activos de Bello, búsqueda parcial sin distinguir mayúsculas |
| `GET /api/barrios/admin` | Catálogo completo para administración (`BARRIOS:VER`) |
| `POST /api/barrios` | Crear candidato inactivo por defecto (`BARRIOS:CREAR`) |
| `PATCH /api/barrios/:id` | Activar/desactivar o configurar cercanía/tiempo (`BARRIOS:EDITAR`) |
| `POST /api/pedidos/estimacion` | Estimar domicilio con barrio y `tipo_entrega: "domicilio"`, o cocina con `tipo_entrega: "local"` / `"recoger"` |
| `POST /api/pedidos` | Crear pedido con modalidad en `tipo_entrega`; solo los domicilios requieren barrio y suman tarifa de envío |

La respuesta exitosa usa el formato general `{ "ok": true, "data": ... }`. La
estimación contiene `minimumMinutes` y `maximumMinutes` solo cuando hay al menos
cinco entregas válidas con marcas de salida y entrega para el barrio; incluye la
mediana histórica del tramo `En camino` → `Entregado`. La cocina respeta el orden
de creación PEPS, consulta los estados activos de los pedidos y usa la marca real
de entrada a `En cocina` para descontar el tiempo transcurrido. Cuando faltan
marcas, aplica la preparación base configurable de 15 minutos y la capacidad
configurable en `src/config/constants.js` (dos pedidos concurrentes inicialmente).
La espera se calcula por espacios de cocina disponibles, no suma 15 minutos por
cada pedido.
Para `tipo_entrega: "local"` o `"recoger"`, `estimatedMinutes` incluye la espera y
preparación de cocina; `deliveryCost` y `components.travelMinutes` son `null`.
Para domicilios, `estimatedMinutes` también incluye el desplazamiento y
`deliveryCost` se calcula según distancia. `source` indica `kitchen`, `distance`,
`history`, `baseline` o `unavailable`, y `isApproximate` advierte cuando la
estimación no es exacta.
El domicilio se calcula separadamente según la distancia geocodificada enviada
por el cliente: hasta 2 km cuesta $4.000, más de 2 y hasta 4 km $6.000, y más de
4 km $8.000. No hay un límite de distancia para entregar; las tarifas y sus
rangos se centralizan en `src/config/constants.js`.
El backend recalcula el valor, guarda `costo_domicilio_cop` por separado y suma
el costo al total solo para `tipo_entrega: "domicilio"`, sin modificar el
subtotal de productos. Para `"local"` y `"recoger"` guarda tarifa cero y el total
es igual al subtotal. En esos dos casos no se requiere barrio ni distancia.
La consulta de estimación de un domicilio debe incluir la distancia en
kilómetros para calcular la tarifa. Ejemplo:
`{ "tipo_entrega": "domicilio", "id_barrio": 1, "direccion": "Calle 1", "distancia_km": 1.5 }`.
Para tiempo solo de cocina:
`{ "tipo_entrega": "recoger" }`.
El checkout consulta la estimación cada 30 segundos para las tres modalidades.
El tiempo entre fin de preparación y salida no está registrado y no se inventa:
`components.dispatchWaitMinutes` será `null`, y `isApproximate` permanece en
`true` incluso cuando el tramo de desplazamiento usa historial.

Sin tiempo de zona ni historial suficiente, la estimación de un domicilio puede
indicar `source: "unavailable"` y `estimatedMinutes: null`; si la tarifa se pudo
calcular, el pedido aún puede crearse. Para `"local"` y `"recoger"` siempre se
estima cocina sin exigir barrio. La estimación inicial queda guardada como
snapshot y no se sobrescribe.

## Estructura

| Carpeta | Responsabilidad |
|---|---|
| `src/config` | Variables de entorno, conexión a BD (`withTransaction`), catálogo base (`constants.js`) |
| `src/routes` | Endpoints (una fábrica sirve a insumos/productos y otra a ambas categorías) |
| `src/controllers` | Request/response |
| `src/services` | Reglas de negocio |
| `src/models` | Consultas SQL |
| `src/validators` | Validación con Zod |
| `src/middlewares` | `authenticate`, `authorize(modulo, privilegio)`, validación, errores |
| `src/errors` | `AppError` |
| `src/utils` | `asyncHandler`, `initDb`, `seed` |
| `sql/` | Esquema PostgreSQL |
| `tests/` | Jest + Supertest |

## Cómo agregar un módulo (ej. compras)
1. `models/compra.model.js` (SQL; recibe un `client` si va dentro de una transacción)
2. `services/compra.service.js` (usa `withTransaction`)
3. `validators/compra.validator.js` → `controllers/compra.controller.js` → `routes/compra.routes.js`
4. Protege cada ruta con `authenticate` + `authorize('COMPRAS', 'CREAR')` y regístrala en `routes/index.js`.

## Notas
- Los permisos iniciales por rol están en `src/config/constants.js`; ajústalos o edítalos con `PUT /api/roles/:id/permisos`.
- Los `DECIMAL`/`BIGINT` se devuelven como número, no como texto.
- Las contraseñas se guardan con bcrypt; el hash nunca sale en las respuestas.
