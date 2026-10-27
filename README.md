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
El selector de entrega obtiene los barrios habilitados desde `GET /api/barrios`;
la ruta requiere sesión y devuelve el catálogo de Bello bajo `data`.
El checkout también consulta `POST /api/pedidos/estimacion` para calcular el
tiempo y, en domicilios, el costo de envío según la distancia.

## Cómo se usa la seguridad

1. `POST /api/auth/login` con `{ "correo", "contrasena" }` devuelve `token`, usuario, roles y permisos.
2. Todas las demás rutas (salvo `/health`, `/auth/login`, `/auth/registro`) exigen `Authorization: Bearer <token>`.
3. Cada ruta valida contra la BD que algún rol del usuario tenga el privilegio (`VER`, `CREAR`, `EDITAR`, `ELIMINAR`) en el módulo.
   Los permisos se leen en cada petición: si cambias un rol o desactivas a alguien, aplica de inmediato.

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
