-- =====================================================
-- MINIFOOD - Esquema para PostgreSQL (Neon) - 26 tablas
-- Convertido desde el script MySQL/SQL Server original.
-- En Neon ya existe la base de datos (neondb), por eso no hay CREATE DATABASE / USE.
-- Es idempotente: se puede ejecutar varias veces (npm run db:init).
-- =====================================================

-- 1. ROLES
CREATE TABLE IF NOT EXISTS roles (
    id_rol      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre_rol  VARCHAR(100) NOT NULL UNIQUE
);
ALTER TABLE roles ADD COLUMN IF NOT EXISTS descripcion TEXT;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO';
ALTER TABLE roles DROP CONSTRAINT IF EXISTS ck_roles_estado;
ALTER TABLE roles ADD CONSTRAINT ck_roles_estado CHECK (estado IN ('ACTIVO', 'INACTIVO'));

-- 2. PRIVILEGIOS
CREATE TABLE IF NOT EXISTS privilegios (
    id_privilegio      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre_privilegio  VARCHAR(100) NOT NULL UNIQUE
);

-- 3. MODULOS
CREATE TABLE IF NOT EXISTS modulos (
    id_modulo      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre_modulo  VARCHAR(100) NOT NULL UNIQUE
);

-- 4. USUARIOS
CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    correo      VARCHAR(255) NOT NULL UNIQUE,
    contrasena  VARCHAR(255) NOT NULL,          -- guardar SIEMPRE el hash (bcrypt), nunca la clave
    estado      VARCHAR(30) NOT NULL DEFAULT 'ACTIVO'
);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS es_administrador_principal BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS requiere_cambio_contrasena BOOLEAN NOT NULL DEFAULT FALSE;

-- 5. PROVEEDORES
CREATE TABLE IF NOT EXISTS proveedores (
    id_proveedor  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre        VARCHAR(150) NOT NULL,
    correo        VARCHAR(255),
    telefono      VARCHAR(30),
    contacto      VARCHAR(150),
    tipo          VARCHAR(50),
    estado        VARCHAR(30) NOT NULL DEFAULT 'ACTIVO'
);
-- Datos extra que pide el panel admin (empresa + persona de contacto)
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS nit VARCHAR(30);
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS direccion VARCHAR(200);
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS insumos TEXT;  -- nombres de insumos que suministra, separados por coma
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS contacto_tipo_documento VARCHAR(30);
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS contacto_documento VARCHAR(50);
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS contacto_telefono VARCHAR(30);
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS contacto_correo VARCHAR(255);
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS contacto_cargo VARCHAR(100);

-- 6. CATEGORIAS  (tipo separa "Categ. Insumos" de "Categ. Producto")
CREATE TABLE IF NOT EXISTS categorias (
    id_categoria      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre_categoria  VARCHAR(100) NOT NULL
);
ALTER TABLE categorias ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) NOT NULL DEFAULT 'INSUMO';
ALTER TABLE categorias DROP CONSTRAINT IF EXISTS ck_categorias_tipo;
ALTER TABLE categorias ADD CONSTRAINT ck_categorias_tipo CHECK (tipo IN ('INSUMO', 'PRODUCTO'));
ALTER TABLE categorias DROP CONSTRAINT IF EXISTS categorias_nombre_categoria_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_categorias_nombre_tipo ON categorias(nombre_categoria, tipo);
ALTER TABLE categorias ADD COLUMN IF NOT EXISTS descripcion TEXT;
ALTER TABLE categorias ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO';
ALTER TABLE categorias DROP CONSTRAINT IF EXISTS ck_categorias_estado;
ALTER TABLE categorias ADD CONSTRAINT ck_categorias_estado CHECK (estado IN ('ACTIVO', 'INACTIVO'));

-- 7. PROCESOS
CREATE TABLE IF NOT EXISTS procesos (
    id_proceso      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre_proceso  VARCHAR(150) NOT NULL
);

-- 8. INSUMOS Y PRODUCTOS
CREATE TABLE IF NOT EXISTS insumos_productos (
    id_insumo_producto   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre               VARCHAR(150) NOT NULL,
    tipo                 VARCHAR(50),
    medida               VARCHAR(50),
    stock                DECIMAL(12,3) NOT NULL DEFAULT 0,
    minimo               DECIMAL(12,3) NOT NULL DEFAULT 0,
    maximo               DECIMAL(12,3),
    id_categoria         BIGINT NOT NULL,
    costo                DECIMAL(12,2) NOT NULL DEFAULT 0,
    precio               DECIMAL(12,2) NOT NULL DEFAULT 0,
    tiene_ficha_tecnica  BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT fk_insumos_categoria
        FOREIGN KEY (id_categoria) REFERENCES categorias(id_categoria)
);
-- Datos que muestra el menú del cliente (solo productos)
ALTER TABLE insumos_productos ADD COLUMN IF NOT EXISTS descripcion TEXT;
ALTER TABLE insumos_productos ADD COLUMN IF NOT EXISTS etiqueta VARCHAR(30);
ALTER TABLE insumos_productos ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO';
ALTER TABLE insumos_productos DROP CONSTRAINT IF EXISTS ck_insumos_productos_estado;
ALTER TABLE insumos_productos ADD CONSTRAINT ck_insumos_productos_estado CHECK (estado IN ('ACTIVO', 'INACTIVO'));

-- 9. PERSONAS
CREATE TABLE IF NOT EXISTS personas (
    id_persona      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_usuario      BIGINT NOT NULL UNIQUE,
    tipo_documento  VARCHAR(30),
    documento       VARCHAR(50) UNIQUE,
    nombre          VARCHAR(150) NOT NULL,
    tipo            VARCHAR(50),

    CONSTRAINT fk_personas_usuario
        FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
);
-- Clientes registrados desde el panel (ej. "cliente de local") no tienen cuenta: id_usuario puede ser NULL
ALTER TABLE personas ALTER COLUMN id_usuario DROP NOT NULL;
ALTER TABLE personas ADD COLUMN IF NOT EXISTS telefono VARCHAR(30);
ALTER TABLE personas ADD COLUMN IF NOT EXISTS direccion VARCHAR(200);
ALTER TABLE personas ADD COLUMN IF NOT EXISTS correo VARCHAR(255);   -- solo si no tiene cuenta (si la tiene, manda usuarios.correo)
ALTER TABLE personas ADD COLUMN IF NOT EXISTS de_local BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE personas ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO';
ALTER TABLE personas DROP CONSTRAINT IF EXISTS ck_personas_estado;
ALTER TABLE personas ADD CONSTRAINT ck_personas_estado CHECK (estado IN ('ACTIVO', 'INACTIVO'));

-- 10. ROLES DE USUARIO
CREATE TABLE IF NOT EXISTS roles_usuario (
    id_rol_usuario  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_usuario      BIGINT NOT NULL,
    id_rol          BIGINT NOT NULL,

    CONSTRAINT fk_roles_usuario_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
    CONSTRAINT fk_roles_usuario_rol     FOREIGN KEY (id_rol)     REFERENCES roles(id_rol),
    CONSTRAINT uq_roles_usuario UNIQUE (id_usuario, id_rol)
);
-- El superadministrador siempre es admin@minifood.com (debe coincidir con superAdminEmail en src/config/env.js)
UPDATE usuarios
   SET es_administrador_principal = (lower(correo) = 'admin@minifood.com')
 WHERE es_administrador_principal IS DISTINCT FROM (lower(correo) = 'admin@minifood.com');
CREATE UNIQUE INDEX IF NOT EXISTS uq_usuario_administrador_principal
    ON usuarios (es_administrador_principal)
 WHERE es_administrador_principal = TRUE;

-- 11. PERMISOS
CREATE TABLE IF NOT EXISTS permisos (
    id_permiso     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_rol         BIGINT NOT NULL,
    id_modulo      BIGINT NOT NULL,
    id_privilegio  BIGINT NOT NULL,

    CONSTRAINT fk_permisos_rol        FOREIGN KEY (id_rol)        REFERENCES roles(id_rol),
    CONSTRAINT fk_permisos_modulo     FOREIGN KEY (id_modulo)     REFERENCES modulos(id_modulo),
    CONSTRAINT fk_permisos_privilegio FOREIGN KEY (id_privilegio) REFERENCES privilegios(id_privilegio),
    CONSTRAINT uq_permisos UNIQUE (id_rol, id_modulo, id_privilegio)
);

-- 12. FICHAS TECNICAS
CREATE TABLE IF NOT EXISTS fichas_tecnicas (
    id_ficha_tecnica  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_proceso        BIGINT NOT NULL,

    CONSTRAINT fk_ficha_proceso FOREIGN KEY (id_proceso) REFERENCES procesos(id_proceso)
);

-- 13. INSUMOS DE FICHAS TECNICAS
CREATE TABLE IF NOT EXISTS ficha_tecnica_insumos (
    id_ficha_tecnica_insumo  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_ficha_tecnica         BIGINT NOT NULL,
    id_insumo_producto       BIGINT NOT NULL,
    tipo                     VARCHAR(50),
    medida                   VARCHAR(50),
    cantidad                 DECIMAL(12,3) NOT NULL,

    CONSTRAINT fk_ficha_insumo_ficha    FOREIGN KEY (id_ficha_tecnica)   REFERENCES fichas_tecnicas(id_ficha_tecnica),
    CONSTRAINT fk_ficha_insumo_producto FOREIGN KEY (id_insumo_producto) REFERENCES insumos_productos(id_insumo_producto)
);

-- 14. COMPRAS
CREATE TABLE IF NOT EXISTS compras (
    id_compra       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_proveedor    BIGINT NOT NULL,
    fecha           DATE NOT NULL,
    fecha_registro  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    iva             DECIMAL(12,2) NOT NULL DEFAULT 0,
    total           DECIMAL(12,2) NOT NULL DEFAULT 0,
    estado          VARCHAR(30) NOT NULL DEFAULT 'REGISTRADA',

    CONSTRAINT fk_compras_proveedor FOREIGN KEY (id_proveedor) REFERENCES proveedores(id_proveedor)
);
ALTER TABLE compras ADD COLUMN IF NOT EXISTS subtotal DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE compras DROP CONSTRAINT IF EXISTS ck_compras_estado;
ALTER TABLE compras ADD CONSTRAINT ck_compras_estado CHECK (estado IN ('REGISTRADA', 'ANULADA'));

-- 15. DETALLE DE COMPRAS
CREATE TABLE IF NOT EXISTS detalle_compras (
    id_detalle_compra   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_compra           BIGINT NOT NULL,
    id_insumo_producto  BIGINT NOT NULL,
    medida              VARCHAR(50),
    cantidad            DECIMAL(12,3) NOT NULL,
    costo_unitario      DECIMAL(12,2) NOT NULL,
    subtotal            DECIMAL(12,2) NOT NULL,

    CONSTRAINT fk_detalle_compra_compra   FOREIGN KEY (id_compra)          REFERENCES compras(id_compra),
    CONSTRAINT fk_detalle_compra_producto FOREIGN KEY (id_insumo_producto) REFERENCES insumos_productos(id_insumo_producto)
);

-- 16. VENTAS
CREATE TABLE IF NOT EXISTS ventas (
    id_venta        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_usuario      BIGINT NOT NULL,
    fecha           DATE NOT NULL,
    subtotal        DECIMAL(12,2) NOT NULL DEFAULT 0,
    iva             DECIMAL(12,2) NOT NULL DEFAULT 0,
    total           DECIMAL(12,2) NOT NULL DEFAULT 0,
    estado          VARCHAR(30) NOT NULL DEFAULT 'REGISTRADA',
    monto_devolver  DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT fk_ventas_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
);

-- 17. DETALLE DE VENTAS
CREATE TABLE IF NOT EXISTS detalle_ventas (
    id_detalle_venta    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_venta            BIGINT NOT NULL,
    id_insumo_producto  BIGINT NOT NULL,
    cantidad            DECIMAL(12,3) NOT NULL,
    precio_unitario     DECIMAL(12,2) NOT NULL,
    subtotal            DECIMAL(12,2) NOT NULL,

    CONSTRAINT fk_detalle_venta_venta    FOREIGN KEY (id_venta)           REFERENCES ventas(id_venta),
    CONSTRAINT fk_detalle_venta_producto FOREIGN KEY (id_insumo_producto) REFERENCES insumos_productos(id_insumo_producto)
);

-- 18. IMAGENES
CREATE TABLE IF NOT EXISTS imagenes (
    id_imagen    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_producto  BIGINT NOT NULL,
    url          TEXT NOT NULL,

    CONSTRAINT fk_imagen_producto FOREIGN KEY (id_producto) REFERENCES insumos_productos(id_insumo_producto)
);

-- 19. ORDENES DE PRODUCCION
CREATE TABLE IF NOT EXISTS ordenes_produccion (
    id_orden_produccion    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    fecha_inicio           DATE NOT NULL,
    tipo_orden_produccion  VARCHAR(80),
    numero_orden           VARCHAR(50) UNIQUE,
    estado                 VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
    observacion            TEXT
);

-- 20. ESTADOS DE ORDENES DE PRODUCCION
CREATE TABLE IF NOT EXISTS estados_orden_produccion (
    id_estado_orden      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_orden_produccion  BIGINT NOT NULL,
    estado               VARCHAR(50) NOT NULL,
    fecha                TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_estado_orden_produccion FOREIGN KEY (id_orden_produccion) REFERENCES ordenes_produccion(id_orden_produccion)
);

-- 21. PRODUCTOS NO CONFORMES
CREATE TABLE IF NOT EXISTS producto_no_conforme (
    id_producto_no_conforme  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    fecha                    DATE NOT NULL,
    id_usuario               BIGINT NOT NULL,
    id_insumo_producto       BIGINT NOT NULL,
    medida                   VARCHAR(50),
    cantidad                 DECIMAL(12,3) NOT NULL,
    motivo                   VARCHAR(150),
    observacion              TEXT,
    id_orden_produccion      BIGINT NOT NULL,
    tipo                     VARCHAR(50),
    estado                   VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',

    CONSTRAINT fk_pnc_usuario  FOREIGN KEY (id_usuario)          REFERENCES usuarios(id_usuario),
    CONSTRAINT fk_pnc_producto FOREIGN KEY (id_insumo_producto)  REFERENCES insumos_productos(id_insumo_producto),
    CONSTRAINT fk_pnc_orden    FOREIGN KEY (id_orden_produccion) REFERENCES ordenes_produccion(id_orden_produccion)
);

-- 22. ACCIONES
CREATE TABLE IF NOT EXISTS acciones (
    id_accion           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_detalle_venta    BIGINT NOT NULL,
    cantidad            DECIMAL(12,3) NOT NULL,
    accion              VARCHAR(100) NOT NULL,
    id_insumo_producto  BIGINT NOT NULL,
    monto               DECIMAL(12,2) NOT NULL DEFAULT 0,
    monto_actual        DECIMAL(12,2) NOT NULL DEFAULT 0,
    observaciones       TEXT,

    CONSTRAINT fk_accion_detalle_venta FOREIGN KEY (id_detalle_venta)   REFERENCES detalle_ventas(id_detalle_venta),
    CONSTRAINT fk_accion_producto      FOREIGN KEY (id_insumo_producto) REFERENCES insumos_productos(id_insumo_producto)
);

-- =====================================================
-- TABLAS NUEVAS (módulos del panel que el esquema original no cubría)
-- =====================================================

-- 23. PERDIDA DE INSUMOS
CREATE TABLE IF NOT EXISTS perdidas_insumos (
    id_perdida          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_insumo_producto  BIGINT NOT NULL,
    id_usuario          BIGINT NOT NULL,
    fecha               DATE NOT NULL DEFAULT CURRENT_DATE,
    cantidad            DECIMAL(12,3) NOT NULL CHECK (cantidad > 0),
    motivo              VARCHAR(150),
    observacion         TEXT,
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_perdida_insumo  FOREIGN KEY (id_insumo_producto) REFERENCES insumos_productos(id_insumo_producto),
    CONSTRAINT fk_perdida_usuario FOREIGN KEY (id_usuario)         REFERENCES usuarios(id_usuario)
);
-- id_usuario = quien la registró; responsable = persona a cargo (texto libre del panel)
ALTER TABLE perdidas_insumos ADD COLUMN IF NOT EXISTS responsable VARCHAR(150);

-- 24. PEDIDOS (ciclo: PENDIENTE > APROBADO > EN_PREPARACION > LISTO > EN_CAMINO > ENTREGADO | RECHAZADO | CANCELADO)
-- Al entregarse un pedido se genera la venta (id_venta).
CREATE TABLE IF NOT EXISTS pedidos (
    id_pedido          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_cliente         BIGINT NOT NULL,
    id_domiciliario    BIGINT,
    id_venta           BIGINT,
    estado             VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
    direccion_entrega  TEXT,
    telefono_contacto  VARCHAR(30),
    observacion        TEXT,
    subtotal           DECIMAL(12,2) NOT NULL DEFAULT 0,
    iva                DECIMAL(12,2) NOT NULL DEFAULT 0,
    total              DECIMAL(12,2) NOT NULL DEFAULT 0,
    creado_en          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_pedido_cliente      FOREIGN KEY (id_cliente)      REFERENCES usuarios(id_usuario),
    CONSTRAINT fk_pedido_domiciliario FOREIGN KEY (id_domiciliario) REFERENCES usuarios(id_usuario),
    CONSTRAINT fk_pedido_venta        FOREIGN KEY (id_venta)        REFERENCES ventas(id_venta)
);
-- Datos del checkout de la tienda y del flujo del panel. 'estado' guarda la etiqueta que muestra la app
-- (Por confirmar, Recibido, Confirmado, En cocina, En camino, Entregado, Cancelado).
ALTER TABLE pedidos ALTER COLUMN estado SET DEFAULT 'Recibido';
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS nombre_contacto VARCHAR(150);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS metodo_pago VARCHAR(30);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS estado_pago VARCHAR(40) NOT NULL DEFAULT 'Pendiente';
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS motivo_rechazo_pago TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS comprobante TEXT;  -- imagen del pago (data URL JPEG, ~100-300 KB)
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS produccion_autorizada BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS registros_produccion JSONB NOT NULL DEFAULT '[]';  -- órdenes que generó el panel

-- 25. DETALLE DE PEDIDOS (precio_unitario queda congelado al confirmar el pedido)
CREATE TABLE IF NOT EXISTS pedido_detalle (
    id_pedido_detalle   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_pedido           BIGINT NOT NULL,
    id_insumo_producto  BIGINT NOT NULL,
    cantidad            DECIMAL(12,3) NOT NULL CHECK (cantidad > 0),
    precio_unitario     DECIMAL(12,2) NOT NULL,
    subtotal            DECIMAL(12,2) NOT NULL,
    observacion         TEXT,   -- salsas, adiciones, bebida elegida, etc.

    CONSTRAINT fk_pedido_detalle_pedido   FOREIGN KEY (id_pedido)          REFERENCES pedidos(id_pedido),
    CONSTRAINT fk_pedido_detalle_producto FOREIGN KEY (id_insumo_producto) REFERENCES insumos_productos(id_insumo_producto)
);

-- 26. HISTORIAL DE ESTADOS DE PEDIDOS (la hora real de cada fase que muestra la app)
CREATE TABLE IF NOT EXISTS historial_estados_pedido (
    id_historial  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_pedido     BIGINT NOT NULL,
    estado        VARCHAR(30) NOT NULL,
    fecha         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_usuario    BIGINT,

    CONSTRAINT fk_historial_pedido  FOREIGN KEY (id_pedido)  REFERENCES pedidos(id_pedido),
    CONSTRAINT fk_historial_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
);

-- =====================================================
-- INDICES
-- (en PostgreSQL las FK NO crean índice automático, por eso agrego los de las FK más consultadas)
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_ventas_usuario                ON ventas(id_usuario);
CREATE INDEX IF NOT EXISTS idx_compras_proveedor             ON compras(id_proveedor);
CREATE INDEX IF NOT EXISTS idx_detalle_compras_compra        ON detalle_compras(id_compra);
CREATE INDEX IF NOT EXISTS idx_detalle_ventas_venta          ON detalle_ventas(id_venta);
CREATE INDEX IF NOT EXISTS idx_producto_no_conforme_orden    ON producto_no_conforme(id_orden_produccion);
CREATE INDEX IF NOT EXISTS idx_ficha_tecnica_insumos_ficha   ON ficha_tecnica_insumos(id_ficha_tecnica);
CREATE INDEX IF NOT EXISTS idx_insumos_categoria             ON insumos_productos(id_categoria);
CREATE INDEX IF NOT EXISTS idx_imagenes_producto             ON imagenes(id_producto);
CREATE INDEX IF NOT EXISTS idx_estados_orden_produccion      ON estados_orden_produccion(id_orden_produccion);
CREATE INDEX IF NOT EXISTS idx_perdidas_insumo               ON perdidas_insumos(id_insumo_producto);
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente               ON pedidos(id_cliente);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado                ON pedidos(estado);
CREATE INDEX IF NOT EXISTS idx_pedido_detalle_pedido         ON pedido_detalle(id_pedido);
CREATE INDEX IF NOT EXISTS idx_historial_pedido              ON historial_estados_pedido(id_pedido);
CREATE INDEX IF NOT EXISTS idx_roles_usuario_usuario         ON roles_usuario(id_usuario);
CREATE INDEX IF NOT EXISTS idx_permisos_rol                  ON permisos(id_rol);

-- Vistas de solo lectura para revisar la tabla insumos_productos por separado (ej. en el panel de Neon)
CREATE OR REPLACE VIEW vista_insumos AS
  SELECT i.id_insumo_producto AS id, i.nombre, c.nombre_categoria AS categoria, i.medida, i.costo, i.stock, i.minimo, i.estado
    FROM insumos_productos i JOIN categorias c ON c.id_categoria = i.id_categoria
   WHERE i.tipo = 'INSUMO';
CREATE OR REPLACE VIEW vista_productos AS
  SELECT i.id_insumo_producto AS id, i.nombre, c.nombre_categoria AS categoria, i.precio, i.descripcion, i.etiqueta, i.estado
    FROM insumos_productos i JOIN categorias c ON c.id_categoria = i.id_categoria
   WHERE i.tipo = 'PRODUCTO';

-- =====================================================
-- MÓDULOS DEL PANEL CON LÓGICA EN LA APP (ventas, producción, no conformes, devoluciones)
-- Cada registro guarda sus datos principales en columnas y la fila completa del panel en datos_panel,
-- para que el panel la recupere tal cual (historial de estados, líneas, consumo de stock...).
-- =====================================================
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS codigo VARCHAR(30);
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS cliente VARCHAR(150);
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS tipo_venta VARCHAR(30);
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS metodo_pago VARCHAR(30);
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS pedido_asociado VARCHAR(30);
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS datos_panel JSONB;

ALTER TABLE ordenes_produccion ADD COLUMN IF NOT EXISTS productos TEXT;
ALTER TABLE ordenes_produccion ADD COLUMN IF NOT EXISTS cantidad DECIMAL(12,3);
ALTER TABLE ordenes_produccion ADD COLUMN IF NOT EXISTS prioridad INT;
ALTER TABLE ordenes_produccion ADD COLUMN IF NOT EXISTS datos_panel JSONB;

-- En el panel un no conforme puede tener varios productos y no siempre una orden: se enlaza cuando se puede
ALTER TABLE producto_no_conforme ALTER COLUMN id_insumo_producto DROP NOT NULL;
ALTER TABLE producto_no_conforme ALTER COLUMN id_orden_produccion DROP NOT NULL;
ALTER TABLE producto_no_conforme ADD COLUMN IF NOT EXISTS codigo VARCHAR(30);
ALTER TABLE producto_no_conforme ADD COLUMN IF NOT EXISTS productos TEXT;
ALTER TABLE producto_no_conforme ADD COLUMN IF NOT EXISTS datos_panel JSONB;

-- 27. DEVOLUCIONES (las del panel: venta asociada, cliente y motivo Reembolso/Reposición)
CREATE TABLE IF NOT EXISTS devoluciones (
    id_devolucion  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo         VARCHAR(30),
    codigo_venta   VARCHAR(30),
    id_venta       BIGINT,
    cliente        VARCHAR(150),
    motivo         VARCHAR(50),
    fecha          DATE NOT NULL DEFAULT CURRENT_DATE,
    id_usuario     BIGINT NOT NULL,
    datos_panel    JSONB,
    creado_en      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_devolucion_venta   FOREIGN KEY (id_venta)   REFERENCES ventas(id_venta),
    CONSTRAINT fk_devolucion_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
);

-- Pedidos creados a mano en el panel (ej. cliente de local sin cuenta): sin id_cliente, con la fila del panel
ALTER TABLE pedidos ALTER COLUMN id_cliente DROP NOT NULL;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS codigo VARCHAR(30);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS datos_panel JSONB;

-- Ficha técnica de cada producto o insumo (receta en ficha_tecnica_insumos)
ALTER TABLE fichas_tecnicas ALTER COLUMN id_proceso DROP NOT NULL;
ALTER TABLE fichas_tecnicas ADD COLUMN IF NOT EXISTS id_insumo_producto BIGINT;
ALTER TABLE fichas_tecnicas ADD COLUMN IF NOT EXISTS nombre VARCHAR(150);
ALTER TABLE fichas_tecnicas ADD COLUMN IF NOT EXISTS version VARCHAR(30);
ALTER TABLE fichas_tecnicas ADD COLUMN IF NOT EXISTS insumos_principales TEXT;
ALTER TABLE fichas_tecnicas ADD COLUMN IF NOT EXISTS preparacion TEXT;
ALTER TABLE fichas_tecnicas DROP CONSTRAINT IF EXISTS fk_ficha_insumo_producto_item;
ALTER TABLE fichas_tecnicas ADD CONSTRAINT fk_ficha_insumo_producto_item
    FOREIGN KEY (id_insumo_producto) REFERENCES insumos_productos(id_insumo_producto);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ficha_por_item ON fichas_tecnicas(id_insumo_producto);

-- Direcciones guardadas del cliente (la primera también queda en personas.direccion)
ALTER TABLE personas ADD COLUMN IF NOT EXISTS direcciones JSONB NOT NULL DEFAULT '[]';

-- 28. CONSUMOS DE PRODUCCION: insumos que se descontaron al pasar una orden a "En cocina" (una vez por orden)
CREATE TABLE IF NOT EXISTS consumos_produccion (
    id_consumo    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    numero_orden  VARCHAR(50) NOT NULL UNIQUE,
    detalle       JSONB NOT NULL,   -- [{ insumo, cantidad }]
    id_usuario    BIGINT,
    creado_en     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_consumo_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
);

-- Las hamburguesas se llaman "Hamburguesa <nombre>" (ej. "Hamburguesa Doble", no solo "Doble"); no repite si ya empieza así
UPDATE insumos_productos ip
   SET nombre = 'Hamburguesa ' || ip.nombre
  FROM categorias c
 WHERE c.id_categoria = ip.id_categoria
   AND c.nombre_categoria = 'Hamburguesas'
   AND ip.nombre NOT ILIKE 'hamburguesa %';

-- 29. RECUPERACIÓN DE CONTRASEÑA: un código de 6 dígitos por usuario (se guarda su hash), vence a los 15 min
CREATE TABLE IF NOT EXISTS recuperaciones_contrasena (
    id_usuario   BIGINT PRIMARY KEY,
    codigo_hash  VARCHAR(64) NOT NULL,
    expira       TIMESTAMPTZ NOT NULL,
    intentos     INT NOT NULL DEFAULT 0,
    creado_en    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_recuperacion_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE
);

-- Cliente mostrador: anónimo para registrar ventas a quien no quiere dar sus datos (no se edita ni se anula)
INSERT INTO personas (nombre, tipo, tipo_documento, documento, de_local, estado)
SELECT 'Cliente mostrador', 'CLIENTE', 'Cédula de Ciudadanía', '000000000', TRUE, 'ACTIVO'
 WHERE NOT EXISTS (SELECT 1 FROM personas WHERE tipo = 'CLIENTE' AND documento = '000000000');

-- Datos de contacto del personal (usuarios que no son clientes)
ALTER TABLE personas ADD COLUMN IF NOT EXISTS barrio VARCHAR(100);
ALTER TABLE personas ADD COLUMN IF NOT EXISTS telefono_emergencia VARCHAR(30);
