const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
const { Pool } = require('pg');
const session = require("express-session");
const multer = require('multer');
const { error } = require('console');
const router = express.Router();
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Funciones de base de datos adaptadas para PostgreSQL
function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    pool.query(sql, params, (err, result) => {
      if (err) reject(err);
      else resolve(result.rows[0]);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    pool.query(sql, params, (err, result) => {
      if (err) reject(err);
      else resolve(result.rows);
    });
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    pool.query(sql, params, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

function verificarSesion(req, res, next) {
  if (req.session.usuario) {
    next();
  } else {
    res.redirect('/inicioSesion'); 
  }
}

function verificarAdmin(req, res, next) {
  const usuario = req.session.usuario;
  const correo = usuario?.correo;
  console.log('Correo del usuario:', correo);
  console.log('Usuario:', usuario);
  
  if (usuario && usuario.correo === 'mimitos@gmail.com') {
    next(); 
  } else {
    res.redirect('/inicioSesion');
  }
}


app.use('/Alimentos', express.static(path.join(__dirname, 'Alimentos')));
app.use(express.static(path.join(__dirname, '..', 'public')));



const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.resolve(__dirname, 'Alimentos'));

  },
  filename: (req, file, cb) => {
    const nombreUnico = Date.now() + path.extname(file.originalname);
    cb(null, nombreUnico);
  }
});


const upload = multer({ storage: storage });

app.post('/administrar', upload.single('imagen'), (req, res) => {
  console.log(req.file); 
  const { nombre, contenido, precio, oferta } = req.body;

   if (!req.file) {
    return res.status(400).send('No se subió ninguna imagen');
  }

  const imagen = req.file.filename;
  const ofertaFinal = oferta === '1' ? 1 : 0;
  const sql = 'INSERT INTO productos (nombre, contenido, precio, imagen, oferta) VALUES ($1, $2, $3, $4, $5) RETURNING idproducto';
  pool.query(sql, [nombre, contenido, parseInt(precio), imagen, ofertaFinal], (err, result) => {
    if (err) {
      console.error(err.message);
      res.send("Error al agregar producto");
    } else {
      
  
  console.log('Nombre:', nombre);
  console.log('Precio:', precio);
  console.log('Imagen:', imagen);
  console.log('Oferta:', oferta);
      res.redirect('/');
    }
  });
});

app.set('view engine', 'ejs'); // Le decís a Express que use EJS como motor de vistas
app.set('views', path.join(__dirname, 'Front'));


app.use('/Img', express.static(path.join(__dirname, 'Img')));





app.use(session({
  secret: "clave_secreta_segura",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Si estás en localhost (sin HTTPS)
}));


app.use(express.json());
app.use(express.urlencoded({ extended: true })); //Middleware para leer datos enviados por POST
app.use(express.static(path.join(__dirname, 'Front'))); //ruta para indicar al servidor donde esta guardada la pagina principal


  app.get('/registro.html', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'Front', 'registro.html')); //Ruta para ingresar a la pagina para crear una cuenta
  });

 
app.post('/eliminar', (req, res) => {
  const id = req.body.id;
  console.log("ID a eliminar:", id);

 
    pool.query('DELETE FROM productos WHERE idproducto = $1', [id], function (err, result) {
    if (err) {
      console.error(err.message);
      res.json({ ok: false });
    } else {
      res.json({ ok: true });
    }
  })
  });


  
  app.get('/', (req, res) => {
    pool.query('SELECT * FROM productos', [], (err, result) => {
      if (err) {
        console.error(err.message);
        res.send("Error al cargar productos");
      } else {
        res.set('Cache-Control', 'no-store');
        res.render('Inicio', {
          usuario: req.session.usuario,
          productos: result.rows  
        });
      }      
    });
  });
  
  app.get('/carrito', verificarSesion, async (req, res) => {

    const idUsuario = req.session.usuario?.idUsuario;
    const usuario = req.session.usuario;

    if (!idUsuario) {
      console.log('No hay idUsuario en la sesión');
      return res.redirect('/inicioSesion');
    }

    try {
      console.log('Buscando carrito para idUsuario:', idUsuario);

      const carrito = await dbAll(`
        SELECT c.idcarrito, c.cantidad, p.idproducto, p.nombre, p.precio, p.imagen, p.contenido
        FROM carrito c
        JOIN productos p ON c.idproducto = p.idproducto
        WHERE c.idusuario = $1
      `, [idUsuario]);
      console.log('Productos encontrados:', carrito);
      res.render('carrito', { carrito, usuario, mensaje:'' });
    } catch (error) {
      console.error('Error al obtener el carrito:', error);
      res.render('carrito', { carrito: [], usuario, mensaje:'' });
     
    }
    console.log('Usuario en sesión:', req.session.usuario);

  });


  app.post('/pagoExitoso', async (req, res) => {
   
    const idUsuario = req.session.usuario.idUsuario;

  
    try {
      const carrito = await dbAll(`
        SELECT c.idproducto, c.cantidad, p.precio
        FROM carrito c
        JOIN productos p ON c.idproducto = p.idproducto
        WHERE c.idusuario = $1`, [idUsuario]);
  
      console.log('Carrito:', carrito); // 🧪 revisar qué devuelve
  
      if (!Array.isArray(carrito) || carrito.length === 0) {
        const mensaje = 'El carrito está vacío.';
        const usuario  = req.session.usuario;
        const carrito = req.session.carrito;
        return res.render('carrito', { carrito, usuario, mensaje});
      }

  
      const montoTotal = carrito.reduce((total, item) => {
        return total + (item.precio * item.cantidad);
      }, 0);
  
      const fecha = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const result = await dbRun(
        `INSERT INTO pedidos (idusuario, montototal, fecha) VALUES ($1, $2, $3) RETURNING idpedido`,
        [idusuario, montototal, fecha]
      );

      function dbRun(sql, params = []) {
        return new Promise((resolve, reject) => {
          pool.query(sql, params, function (err, result) {
            if (err) reject(err);
            else resolve(result); 
          });
        });
      }
      
      const idPedido = result.rows[0].idPedido;
  
      for (const item of carrito) {
        await dbRun(
          `INSERT INTO detallePedido (idpedido, idproducto, cantidad, precio)
           VALUES ($1, $2, $3, $4)`,
          [idPedido, item.idProducto, item.cantidad, item.precio]
        );
      }
  
      await dbRun(`DELETE FROM carrito WHERE idusuario = $1`, [idUsuario]);
  
      res.redirect('/');
  
    } catch (error) {
      console.error('Error al confirmar pedido:', error);
      res.status(500).send('Hubo un error al procesar tu pedido.');
    }
  });
  
  
  
  app.get('/check-session', (req, res) => {
    res.json({ usuario: req.session.usuario || null });
  });
  

  app.get('/login', (req, res) => {
    if (req.session.usuario) {
      return res.redirect('/');
    }
    
  
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.render('iniciarSesion', { errorCorreo: null, errorContraseña: null });

  });
  
  app.get('/detalleProducto/:id', (req, res) => {
    const idProducto = req.params.id;
    pool.query('SELECT * FROM productos WHERE idproducto = $1', [idProducto], (err, result) => {
      if (err) {
        console.error(err.message);
        res.send("Error al cargar productos");
      } else if (!result.rows[0]) {
        res.send("Producto no encontrado");
      } else {
        res.set('Cache-Control', 'no-store');
        res.render('detalleProducto.ejs', {
          usuario: req.session.usuario,
          producto: result.rows[0]
        });
      }
    });
  });




  app.get('/detallePedido/:idPedido',  async (req, res) => {
    const correo = req.session.usuario?.correo;

    if (correo !== "mimitos@gmail.com") {
      
      return res.redirect('/');
    }
    const idPedido = req.params.idPedido;
    const usuario = req.session.Usuario;
    try {
      const detalles = await dbAll(`
        SELECT 
          p.idpedido,
          u.nombre AS nombreUsuario,
          u.apellido,
          u.correo,
          u.direccion,
          u.numero,
          pr.nombre AS nombreProducto,
          pr.contenido,
          pr.precio,
          dp.cantidad
        FROM usuarios u
        JOIN pedidos p ON u.idusuario = p.idusuario
        JOIN detallepedido dp ON p.idpedido = dp.idpedido
        JOIN productos pr ON dp.idproducto = pr.idproducto
        WHERE p.idpedido = $1
      `, [idPedido]);
    
      res.render('detallePedido.ejs', { detalles, usuario });
    } catch (error) {
      console.error('Error al obtener el detalle del pedido:', error);
      res.status(500).send('Error interno del servidor');
    }
  });

    app.get('/pedidos', async (req, res) => {
    
    const correo = req.session.usuario?.correo;

    if (correo !== "mimitos@gmail.com") {
      
      return res.redirect('/');
    }
    const usuario = req.session.usuario;
    const pedidos = await dbAll(`
      SELECT u.idusuario, u.nombre, u.apellido, SUM(p.montototal) AS montoTotal, p.fecha, p.idpedido
      FROM pedidos p
      JOIN usuarios u ON p.idusuario = u.idusuario
      GROUP BY p.idPedido, u.idusuario, u.nombre, u.apellido
    `);
    res.render('pedidos.ejs', { pedidos, usuario });
  });
  


  app.post('/login', (req, res) => {
    const { correo, contraseña } = req.body;
  
    if (!correo || !contraseña) {
      res.send("Faltan datos para iniciar sesión.");
      return;
    }
  
    const Correo = correo.trim().toLowerCase();
    const Contraseña = contraseña.trim();
    const idUsuario = req.session.usuario?.idUsuario;

    const sql = "SELECT * FROM usuarios WHERE LOWER(correo) = $1"; 
  
    pool.query(sql, [Correo], (err, result) => {
      if (err) {
        console.error("Error al buscar usuario:", err.message);
        res.send("Ocurrió un error.");
      } else if (result.rows.length === 0) {
        res.render('iniciarSesion', { errorCorreo: 'Este correo no existe', errorContraseña: null });
      } else if (result.rows[0].contraseña !== Contraseña) { 
        res.render('iniciarSesion', { errorCorreo: null, errorContraseña: 'Contraseña incorrecta' });
      } else {
        const row = result.rows[0];
        req.session.usuario = {
          correo: row.correo,
          nombre: row.nombre,
          idUsuario: row.idusuario, // PostgreSQL suele devolver todo en minúscula
        };
        console.log("Sesión actual:", req.session.usuario);
  
        res.redirect("/");
      }
    });
  });
  

 
app.get('/inicioSesion', (req, res) => {

  res.render("iniciarSesion", {errorContraseña: null, errorCorreo: null} )
});


app.get('/pedidosEntregados', verificarAdmin, async (req, res) => {
  const usuario = req.session.usuario;
  const pedidos = await dbAll('SELECT  u.nombre, u.apellido, u.correo, u.idusuario, pe.montototal, pe.fecha, pe.identregado FROM pedidoEntregado pe JOIN usuarios u ON pe.idusuario = u.idusuario;');
  res.render('pedidosEntregados.ejs', { pedidos, usuario });
});

app.get('/pedidosCancelados', verificarAdmin, async (req, res) => {
  const usuario = req.session.usuario;
  const pedidos = await dbAll('SELECT  u.nombre, u.apellido, u.correo, u.idusuario, pc.montototal, pc.fecha, pc.idcancelado FROM pedidocancelado pc JOIN usuarios u ON pc.idusuario = u.idusuario;');
  res.render('pedidosCancelados.ejs', { pedidos, usuario });
});

app.get('/detallePedidoCancelado/:idCancelado', verificarAdmin, async (req, res) => {
  const idCancelado = req.params.idCancelado;
  const usuario = req.session.usuario;
  const detalles = await dbAll(`
        SELECT 
          pc.idpedido,
          u.nombre AS nombreUsuario,
          u.apellido,
          u.correo,
          u.direccion,
          u.numero,
          pr.nombre AS nombreProducto,
          pr.contenido,
          pr.precio,
          dc.cantidad
        FROM usuarios u
        JOIN pedidoCancelado pc ON u.idusuario = pc.idusuario
        JOIN detalleCancelado dc ON pc.idcancelado = dc.idcancelado
        JOIN productos pr ON dc.idproducto = pr.idproducto
        WHERE pc.idCancelado = $1
      `, [idCancelado]);
  
  res.render('detallePedidoCancelado.ejs', { detalles, usuario });
});


app.get('/detallePedidoEntregado/:idEntregado', verificarAdmin, async (req, res) => {
  const idEntregado = req.params.idEntregado;
  const usuario = req.session.usuario;
  const idUsuario = req.session.usuario?.idUsuario;
  
  const detalles = await dbAll(`
        SELECT 
          pe.idpedido,
          u.nombre AS nombreUsuario,
          u.apellido,
          u.correo,
          u.direccion,
          u.numero,
          pr.nombre AS nombreProducto,
          pr.contenido,
          pr.precio,
          dp.cantidad
        FROM usuarios u
        JOIN pedidoEntregado pe ON u.idusuario = pe.idusuario
        JOIN detalleEntregado dp ON pe.identregado = dp.identregado
        JOIN productos pr ON dp.idproducto = pr.idproducto
        WHERE pe.idEntregado = $1
      `, [idEntregado]);
  
      res.render('detallePedidoEntregado.ejs', { detalles, usuario });
  
});



app.post('/Registros', (req, res) => { //Datos recibidos del post "Registros"
const nombre = req.body.nombre;
const apellido = req.body.apellido;
const correo = req.body.correo;
const contraseña = req.body.contraseña;
const direccion = req.body.direccion;
const numero = req.body.numero;
console.log('Datos recibidos: ', nombre, apellido, correo, direccion, numero, contraseña);
pool.query('INSERT INTO usuarios ("nombre", "apellido", "correo", "direccion", "numero", "contraseña") VALUES ($1, $2, $3, $4, $5, $6) RETURNING idUsuario', [nombre, apellido, correo, direccion, numero, contraseña], function(err, result) {
    if (err) {
      console.error(err.message);
      res.send('Error al registrar usuario');
    } else {
      const Correo = correo.trim().toLowerCase();
      const sql = "SELECT * FROM usuarios WHERE LOWER(correo) = $1";
      pool.query(sql, [correo], (err, result2) => {
        if (err) {
          console.error("Error al buscar usuario después del registro:", err.message);
          res.send("Usuario registrado, pero ocurrió un error al iniciar sesión.");
        } else {
          const row = result2.rows[0];
          req.session.usuario = {
            correo: row.correo,
            nombre: row.nombre,
            idUsuario: row.idusuario
          };
          res.redirect("/"); // Redirige ya con la sesión iniciada
        }
      });
    }
  }
);
}); 

app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Error al cerrar sesión:', err);
      return res.send('Error al cerrar sesión');
    }
    res.redirect('/'); // Redirige al inicio u otra página pública
  });
});


app.post('/productos/:id/descripcion', (req, res) => {
  const productoId = req.params.id;
  const descripcion = req.body.descripcion;

  const sql = `UPDATE productos SET descripcion = $1 WHERE idproducto = $2`;
  pool.query(sql, [descripcion, productoId], function (err, result) {
    if (err) {
      console.error('Error al actualizar la descripción:', err);
      return res.status(500).send('Error del servidor');
    }
    res.redirect(`/detalleProducto/${productoId}`); // Redirigís a la vista del producto
  });
});





app.post('/compra', async (req, res) => {
const idusuario = req.session.usuario.idusuario;
const idproducto = req.body.idproducto
const cantidad = req.body.cantidad

if (!idUsuario){
  return res.redirect('/login')


}

await pool.query('INSERT INTO carrito (idusuario, idproducto, cantidad) VALUES ($1, $2, $3)', [idusuario, idproducto, cantidad]);

res.redirect(`/detalleProducto/${idProducto}`);// Redirige al carrito o a la misma página
});

app.post('/eliminar-del-carrito', async (req, res) => {
  const idUsuario = req.session.usuario?.idUsuario;
  const idCarrito = req.body.idCarrito;
  

  if (!idUsuario) {
    return res.json({ success: false, message: 'No hay sesión activa' });
  }

  try {
    await pool.query('DELETE FROM carrito WHERE idcarrito = $1 AND idusuario = $2', [idCarrito, idUsuario]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar del carrito:', error);
    res.json({ success: false, message: 'Error al eliminar el producto' });
  }
});


app.post('/pedidoEntregado', async (req, res) => {
  const idPedido = req.body.idPedido;
  const idUsuarioSesion = req.session.usuario?.idUsuario;

  if (!idUsuarioSesion) {
    return res.json({ success: false, message: 'No hay sesión activa' });
  }
  try {
    console.log('idPedido recibido:', idPedido);
   
    const pedidoInfo = await dbGet('SELECT idpedido, idusuario, montototal, fecha FROM pedidos WHERE idpedido = $1', [idPedido]);
    
    if (!pedidoInfo) {
  return res.status(404).send('Pedido no encontrado');
}
  console.log('🧾 idUsuario que hizo el pedido:', pedidoInfo.idUsuario);

  const result = await pool.query(
    `INSERT INTO pedidoEntregado (idpedido, idusuario, montototal, fecha)
     VALUES ($1, $2, $3, $4) RETURNING identregado`,
    [pedidoInfo.idPedido, pedidoInfo.idUsuario, pedidoInfo.montoTotal, pedidoInfo.fecha]
  );

  const idEntregado = result.rows[0].idEntregado;

  const detalles = await dbAll ('SELECT dp.idproducto, dp.cantidad, dp.precio FROM detallePedido dp WHERE dp.idpedido = $1', [idPedido]);
    console.log('detalles', detalles);
  
  for (const item of detalles) {
    await pool.query(
      `INSERT INTO detalleEntregado (identregado, idproducto, cantidad, precio)
       VALUES ($1, $2, $3, $4)`,
      [idEntregado, item.idProducto, item.cantidad, item.precio]
    );
  }

await pool.query('DELETE FROM pedidos WHERE idpedido = $1 AND idusuario = $2', [idPedido, pedidoInfo.idUsuario]);
res.redirect('/pedidos');

} catch (error) {
  console.error('Error al eliminar el pedido:', error);
  res.json({ success: false, message: 'Error al eliminar el pedido' });
}
});


app.post('/pedidoCancelado', async (req, res) => {
  const idPedido = req.body.idPedido;
  const idUsuarioSesion = req.session.usuario?.idUsuario;

  if (!idUsuarioSesion) {
    return res.json({ success: false, message: 'No hay sesión activa' });
  }
  try {
    console.log('idPedido recibido:', idPedido);
   
    const pedidoInfo = await dbGet('SELECT idpedido, idusuario, montototal, fecha FROM pedidos WHERE idpedido = $1', [idPedido]);
    
    if (!pedidoInfo) {
  return res.status(404).send('Pedido no encontrado');
}
  console.log('🧾 idUsuario que hizo el pedido:', pedidoInfo.idUsuario);

  const result = await pool.query(
    `INSERT INTO pedidoCancelado (idpedido, idusuario, montototal, fecha)
     VALUES ($1, $2, $3, $4) RETURNING idCancelado`,
    [pedidoInfo.idPedido, pedidoInfo.idUsuario, pedidoInfo.montoTotal, pedidoInfo.fecha]
  );

  const idCancelado = result.rows[0].idcancelado;

  const detalles = await dbAll ('SELECT dp.idproducto, dp.cantidad, dp.precio FROM detallePedido dp WHERE dp.idpedido = $1', [idPedido]);
  console.log('detalles', detalles);

for (const item of detalles) {
  await pool.query(
    `INSERT INTO detalleCancelado (idCancelado, idproducto, cantidad, precio)
     VALUES ($1, $2, $3, $4)`,
    [idCancelado, item.idProducto, item.cantidad, item.precio]
  );
}

await pool.query('DELETE FROM pedidos WHERE idpedido = $1 AND idusuario = $2', [idPedido, pedidoInfo.idUsuario]);
res.redirect('/pedidos');

} catch (error) {
  console.error('Error al eliminar el pedido:', error);
  res.json({ success: false, message: 'Error al eliminar el pedido' });
}
});



app.listen(PORT, () => {  // funcion para confirmar que el servidor esta funcionando en el puerto 3000
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
