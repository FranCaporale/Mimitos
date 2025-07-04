
CREATE TABLE IF NOT EXISTS Productos (
	nombre	TEXT,
	contenido	TEXT,
	precio	INTEGER,
	imagen	TEXT,
	descripcion	TEXT,
	oferta	INTEGER,
	idProducto SERIAL PRIMARY KEY

);
CREATE TABLE IF NOT EXISTS carrito (
	idUsuario	INTEGER,
	idProducto	INTEGER,
	cantidad	INTEGER,
	idCarrito SERIAL PRIMARY KEY

);
CREATE TABLE IF NOT EXISTS detallePedido (
	idPedido	INTEGER,
	idProducto	INTEGER,
	cantidad	INTEGER,
	precio	INTEGER,
	idDetalle SERIAL PRIMARY KEY

);
CREATE TABLE IF NOT EXISTS Pedidos (
	idUsuario	INTEGER,
	montoTotal	INTEGER,
	fecha	TIMESTAMP,
	idPedido SERIAL PRIMARY KEY

);
CREATE TABLE IF NOT EXISTS Usuarios (
	Nombre	TEXT,
	Apellido	TEXT,
	Correo	TEXT,
	Contraseña	TEXT,
	direccion	TEXT,
	numero	NUMERIC,
	idUsuario SERIAL PRIMARY KEY

);
CREATE TABLE IF NOT EXISTS pedidoEntregado (
	idPedido	INTEGER,
	idUsuario	INTEGER,
	fecha	TIMESTAMP,
	montoTotal	INTEGER,
	idEntregado SERIAL PRIMARY KEY

);
CREATE TABLE IF NOT EXISTS detalleEntregado (
	idEntregado	INTEGER,
	idProducto	INTEGER,
	cantidad	INTEGER,
	precio	INTEGER,
	idDetalleEntregado SERIAL PRIMARY KEY

);
CREATE TABLE IF NOT EXISTS pedidoCancelado (
	idPedido	INTEGER,
	idUsuario	INTEGER,
	fecha	TIMESTAMP,
	montoTotal	INTEGER,
	idCancelado SERIAL PRIMARY KEY

);
CREATE TABLE IF NOT EXISTS detalleCancelado (
	idCancelado	INTEGER,
	idProducto	INTEGER,
	cantidad	INTEGER,
	precio	INTEGER,
	idDetalleCancelado SERIAL PRIMARY KEY

);


