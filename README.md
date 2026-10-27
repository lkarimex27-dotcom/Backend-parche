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
npm run db:setup     # crea las 27 tablas + roles, privilegios, módulos, permisos y el admin
npm run dev
```

`npm run db:init` (solo esquema) y `npm run db:seed` (solo datos base) también existen. Ambos son idempotentes.

Configura contraseñas temporales diferentes en el `.env` para cada rol de personal
(y `DEFAULT_PASSWORD_<ROL>` para roles personalizados). Cada contraseña debe tener entre 8 y 72
caracteres e incluir una mayúscula, una minúscula y un número. El servidor las asigna al crear
usuarios de personal, devuelve la clave temporal solo en la respuesta de alta y exige cambiarla
en `PATCH /api/auth/me/contrasena-inicial` antes de permitir cualquier otra ruta autenticada.
Las cuentas de cliente conservan la contraseña que el cliente eligió.
El selector de entrega obtiene los barrios habilitados desde `GET /api/barrios`;
la ruta requiere sesión y devuelve el catálogo de Bello bajo `data`.
El checkout también consulta `POST /api/pedidos/estimacion` para calcular el
tiempo y, en domicilios, el costo de envío según la distancia.

## Cómo se usa la seguridad

1. `POST /api/auth/login` con `{ "correo", "contrasena" }` devuelve `token`, usuario, roles y permisos.
2. Todas las demás rutas (salvo `/health`, `/auth/login`, `/auth/registro`) exigen `Authorization: Bearer <token>`.
3. Cada ruta valida contra la BD que algún rol del usuario tenga el privilegio (`VER`, `CREAR`, `EDITAR`, `ELIMINAR`) en el módulo.
   Los permisos se leen en cada petición: si cambias un rol o desactivas a alguien, aplica de inmediato.
   Las rutas públicas de autenticación para registro y recuperación se detallan a continuación.

### Registro y recuperación de contraseña

El registro envía un PIN aleatorio de seis dígitos al correo indicado. La cuenta solo se crea
después de validar el PIN, que vence en 15 minutos y permite hasta cinco intentos. El endpoint
`POST /api/auth/registro` también inicia el mismo flujo de verificación.

Para recuperar la contraseña, usa `POST /api/auth/recuperar`, luego valida el PIN con
`POST /api/auth/recuperar/verificar` y envía el token devuelto junto con la nueva contraseña a
`POST /api/auth/restablecer`. El token temporal vence a los 10 minutos. Configura `MAIL_USER`
y `MAIL_PASS` en `.env` para habilitar el envío de correo; en Gmail, `MAIL_PASS` debe ser una
contraseña de aplicación. Ejecuta `npm run db:init` para aplicar la tabla temporal de registros
y las columnas de verificación de recuperación.

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
| Domicilios | `/api/domicilios` (CRUD de direcciones asociadas a pedidos) | Listo |
| Pedidos | `/api/pedidos` | Pendiente |
| Ventas | `/api/ventas` | Pendiente |
| Devoluciones | `/api/devoluciones` | Pendiente |

Las tablas de los módulos pendientes ya existen en `sql/init.sql`.
Los cambios de `/api/domicilios` se guardan en la dirección del pedido, por lo que también aparecen en las respuestas de `/api/pedidos/mios` que consulta el cliente. El CRUD requiere los privilegios `VER`, `CREAR`, `EDITAR` y `ELIMINAR` del módulo `DOMICILIOSS`.
Al registrar un producto no conforme que genera reposición, el panel usa
`POST /api/productos-no-conformes/con-reposicion`: registra la orden nueva y el
producto no conforme en una transacción, los vincula en la base de datos y,
cuando se informa la orden afectada, guarda también su cambio de estado dentro
de la misma transacción.

## Barrios y estimación de entrega

`npm run db:init` crea/actualiza el catálogo `barrios`, agrega `id_barrio` y
`estimacion_inicial` a `pedidos`. Ejecuta también `npm run db:seed` para incorporar
el módulo y los permisos administrativos `BARRIOS`.
Los nombres candidatos suministrados para Bello se insertan inactivos: una persona
administradora debe validar cobertura antes de habilitarlos. No se consideran una
lista oficial o completa. El tiempo de desplazamiento queda sin configurar salvo
que el administrador marque explícitamente una zona como cercana (`es_cercano: true`,
referencia inicial de 5 minutos) o indique su tiempo medido.

Endpoints autenticados:

| Método y ruta | Uso |
|---|---|
| `GET /api/barrios?buscar=ana` | Barrios activos de Bello, búsqueda parcial sin distinguir mayúsculas |
| `GET /api/barrios/admin` | Catálogo completo para administración (`BARRIOS:VER`) |
| `POST /api/barrios` | Crear candidato inactivo por defecto (`BARRIOS:CREAR`) |
| `PATCH /api/barrios/:id` | Activar/desactivar o configurar cercanía, tiempo y `costo_domicilio_cop` (`BARRIOS:EDITAR`) |
| `POST /api/pedidos/estimacion` | Estimar con `{ "id_barrio": 1, "direccion": "..." }` |
| `POST /api/pedidos` | Crear pedido con `id_barrio`; el backend valida y almacena la estimación inicial |

Configura `costo_domicilio_cop` por barrio mediante `PATCH /api/barrios/:id`.
No se asigna una tarifa predeterminada: si el barrio no tiene costo configurado,
la estimación devuelve `deliveryCost: null` y el pedido no se crea. Cuando la
tarifa está configurada, el backend suma el costo al subtotal y persiste el
detalle del domicilio y el total del pedido. El umbral de aprobación sigue
evaluándose con el subtotal de productos.

La respuesta exitosa usa el formato general `{ "ok": true, "data": ... }`. La
estimación contiene `minimumMinutes` y `maximumMinutes` solo cuando hay al menos
cinco entregas válidas con marcas de salida y entrega para el barrio; incluye la
mediana histórica del tramo `En camino` → `Entregado`. Los pedidos actuales solo
registran esos estados en `historial_estados_pedido`, no el fin de preparación,
por lo que cocina se estima con 15 minutos base y capacidad configurable en
`src/config/constants.js` (dos pedidos concurrentes inicialmente). La espera se
estima por lotes y no añade 15 minutos por cada pedido.
El tiempo entre fin de preparación y salida no está registrado y no se inventa:
`components.dispatchWaitMinutes` será `null`, y `isApproximate` permanece en
`true` incluso cuando el tramo de desplazamiento usa historial.

Sin tiempo de zona ni historial suficiente, la respuesta indica
`source: "unavailable"`, `estimatedMinutes: null` y un mensaje “Por confirmar”;
el pedido puede crearse si el barrio sigue activo, dentro de cobertura y con
costo de domicilio configurado. La estimación inicial se conserva como snapshot
y no se sobrescribe con consultas posteriores.

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
