// perfil.routes.js
// Rutas del panel "Mi cuenta" de LogoMarket.
//
// Instalar dependencias:   npm install bcrypt jsonwebtoken
// Variable de entorno:     JWT_SECRET=una_clave_larga_y_secreta
//
// Uso en tu server.js (db es tu pool de mysql2/promise):
//   const rutasPerfil = require("./perfil.routes");
//   app.use("/api/perfil", rutasPerfil(db));

const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

/* ---------------------------------------------------------
   Middleware: verifica el token y deja el usuario en req.usuario
   El id sale SIEMPRE del token, nunca del cuerpo de la petición.
   --------------------------------------------------------- */
function verificarSesion(req, res, next) {
    const cabecera = req.headers.authorization || "";
    const token = cabecera.startsWith("Bearer ") ? cabecera.slice(7) : null;

    if (!token) return res.status(401).json({ error: "No has iniciado sesión." });

    try {
        req.usuario = jwt.verify(token, process.env.JWT_SECRET); // { id, rol }
        next();
    } catch (e) {
        return res.status(401).json({ error: "Tu sesión expiró. Inicia sesión de nuevo." });
    }
}

module.exports = function (db) {
    const router = express.Router();
    router.use(verificarSesion);

    // Datos del usuario logueado
    router.get("/", async (req, res) => {
        try {
            const [filas] = await db.query(
                "SELECT id_usuario, nombre, correo, rol, fecha_registro FROM usuarios WHERE id_usuario = ?",
                [req.usuario.id]
            );
            if (filas.length === 0) return res.status(404).json({ error: "Usuario no encontrado." });
            res.json(filas[0]);
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: "No pudimos cargar tus datos." });
        }
    });

    // Actualizar nombre
    router.put("/", async (req, res) => {
        const nombre = (req.body.nombre || "").trim();
        if (nombre.length < 2 || nombre.length > 100) {
            return res.status(400).json({ error: "El nombre debe tener entre 2 y 100 caracteres." });
        }
        try {
            await db.query("UPDATE usuarios SET nombre = ? WHERE id_usuario = ?", [nombre, req.usuario.id]);
            res.json({ ok: true });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: "No pudimos guardar los cambios." });
        }
    });

    // Cambiar contraseña
    router.put("/password", async (req, res) => {
        const { actual, nueva } = req.body;

        if (!actual || !nueva) return res.status(400).json({ error: "Completa todos los campos." });
        if (nueva.length < 8) return res.status(400).json({ error: "La contraseña nueva debe tener al menos 8 caracteres." });
        if (actual === nueva) return res.status(400).json({ error: "La contraseña nueva debe ser diferente a la actual." });

        try {
            const [filas] = await db.query("SELECT password FROM usuarios WHERE id_usuario = ?", [req.usuario.id]);
            if (filas.length === 0) return res.status(404).json({ error: "Usuario no encontrado." });

            const coincide = await bcrypt.compare(actual, filas[0].password);
            if (!coincide) return res.status(400).json({ error: "La contraseña actual es incorrecta." });

            const hash = await bcrypt.hash(nueva, 10);
            await db.query("UPDATE usuarios SET password = ? WHERE id_usuario = ?", [hash, req.usuario.id]);
            res.json({ ok: true });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: "No pudimos cambiar la contraseña." });
        }
    });

    // Compras del usuario (tabla compras + logos)
    router.get("/compras", async (req, res) => {
        try {
            const [filas] = await db.query(
                `SELECT c.id_compra, c.fecha_compra, l.nombre_logo, l.precio, l.imagen
                 FROM compras c
                 JOIN logos l ON l.id_logo = c.id_logo
                 WHERE c.id_usuario = ?
                 ORDER BY c.fecha_compra DESC`,
                [req.usuario.id]
            );
            res.json(filas);
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: "No pudimos cargar tus compras." });
        }
    });

    // Logos publicados por el usuario (solo diseñador y admin)
    router.get("/logos", async (req, res) => {
        if (req.usuario.rol !== "disenador" && req.usuario.rol !== "admin") {
            return res.status(403).json({ error: "No tienes permiso para ver esta sección." });
        }
        try {
            const [filas] = await db.query(
                `SELECT l.id_logo, l.nombre_logo, l.precio, l.imagen, l.estado, c.nombre_categoria
                 FROM logos l
                 LEFT JOIN categorias c ON c.id_categoria = l.id_categoria
                 WHERE l.id_usuario = ?
                 ORDER BY l.id_logo DESC`,
                [req.usuario.id]
            );
            res.json(filas);
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: "No pudimos cargar tus logos." });
        }
    });

    return router;
};

/* =========================================================
   CAMBIO NECESARIO EN TU LOGIN
   Al iniciar sesión correctamente, genera un token y devuélvelo
   junto con los datos del usuario:

   const token = jwt.sign(
       { id: usuario.id_usuario, rol: usuario.rol },
       process.env.JWT_SECRET,
       { expiresIn: "2h" }
   );
   res.json({
       id_usuario: usuario.id_usuario,
       nombre: usuario.nombre,
       rol: usuario.rol,
       token
   });

   En el frontend, tu Login.html ya guarda esa respuesta con
   localStorage.setItem("usuario", JSON.stringify(respuesta)).
   ========================================================= */