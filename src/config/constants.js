// Catálogo base del sistema. `npm run db:seed` lo inserta en la BD (es idempotente).
// Los módulos corresponden al menú del panel administrativo.

const ROLES = ['ADMINISTRADOR', 'VENDEDOR', 'COCINERO', 'DOMICILIARIO', 'CLIENTE'];

const PRIVILEGIOS = ['VER', 'CREAR', 'EDITAR', 'ELIMINAR'];

const MODULOS = [
  'ROLES_PERMISOS',
  'USUARIOS',
  // Compras
  'CATEGORIAS_INSUMOS',
  'INSUMOS',
  'PROVEEDORES',
  'COMPRAS',
  'PERDIDA_INSUMOS',
  // Producción
  'CATEGORIAS_PRODUCTO',
  'PRODUCTOS',
  'ORDENES_PRODUCCION',
  'PRODUCTO_NO_CONFORME',
  // Ventas
  'CLIENTES',
  'PEDIDOS',
  'VENTAS',
  'DEVOLUCIONES',
];

// Permisos iniciales (puntos de partida; se pueden cambiar desde /api/roles/:id/permisos).
// ADMINISTRADOR recibe todo automáticamente.
const PERMISOS_INICIALES = {
  VENDEDOR: {
    CLIENTES: ['VER', 'CREAR', 'EDITAR'],
    PEDIDOS: ['VER', 'CREAR', 'EDITAR'],
    VENTAS: ['VER', 'CREAR', 'EDITAR'],
    DEVOLUCIONES: ['VER', 'CREAR'],
    PRODUCTOS: ['VER'],
    CATEGORIAS_PRODUCTO: ['VER'],
  },
  COCINERO: {
    PRODUCTOS: ['VER'],
    CATEGORIAS_PRODUCTO: ['VER'],
    INSUMOS: ['VER'],
    ORDENES_PRODUCCION: ['VER', 'CREAR', 'EDITAR'],
    PRODUCTO_NO_CONFORME: ['VER', 'CREAR', 'EDITAR'],
    PERDIDA_INSUMOS: ['VER', 'CREAR'],
    PEDIDOS: ['VER', 'EDITAR'],
  },
  DOMICILIARIO: {
    PEDIDOS: ['VER', 'EDITAR'],
  },
  CLIENTE: {},
};

module.exports = { ROLES, PRIVILEGIOS, MODULOS, PERMISOS_INICIALES };
