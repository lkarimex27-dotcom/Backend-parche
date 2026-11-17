-- Stock fraccionado exacto: de 3 a 6 decimales.
-- Un insumo que se guarda en paquetes y se gasta por unidades (1 salchicha de un paquete de 30 = 0,033333 paq)
-- perdía precisión con DECIMAL(12,3). DECIMAL(15,6) mantiene los mismos 9 dígitos enteros: ningún valor
-- existente se recorta. Todo en una transacción: si algo falla no cambia nada.
-- Ejecutar una sola vez:  psql "$DATABASE_URL" -f sql/2026-11-17-stock-6-decimales.sql

BEGIN;

-- La vista usa stock y minimo: se quita y se vuelve a crear igual
DROP VIEW IF EXISTS vista_insumos;

ALTER TABLE insumos_productos
  ALTER COLUMN stock  TYPE DECIMAL(15,6),
  ALTER COLUMN minimo TYPE DECIMAL(15,6);

ALTER TABLE movimientos_stock
  ALTER COLUMN cantidad         TYPE DECIMAL(15,6),
  ALTER COLUMN stock_resultante TYPE DECIMAL(15,6);

ALTER TABLE detalle_compras ALTER COLUMN cantidad TYPE DECIMAL(15,6);

CREATE OR REPLACE VIEW vista_insumos AS
  SELECT i.id_insumo_producto AS id, i.nombre, c.nombre_categoria AS categoria, i.medida, i.costo, i.stock, i.minimo, i.estado
    FROM insumos_productos i JOIN categorias c ON c.id_categoria = i.id_categoria
   WHERE i.tipo = 'INSUMO';

COMMIT;
