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

-- 10. ROLES DE USUARIO
CREATE TABLE IF NOT EXISTS roles_usuario (
    id_rol_usuario  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_usuario      BIGINT NOT NULL,
    id_rol          BIGINT NOT NULL,

    CONSTRAINT fk_roles_usuario_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
    CONSTRAINT fk_roles_usuario_rol     FOREIGN KEY (id_rol)     REFERENCES roles(id_rol),
    CONSTRAINT uq_roles_usuario UNIQUE (id_usuario, id_rol)
);

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
