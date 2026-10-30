try { require("dotenv").config(); } catch (e) { /* dotenv es opcional */ }

const express = require("express");
const mysql = require("mysql2");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const rutasPerfil = require("./perfil.rutas.js");
const rutasCompras = require("./compras.rutas.js");
const asegurarVisibilidadLogos = require("./logos.schema");



if (!process.env.JWT_SECRET) {
    if (process.env.NODE_ENV === "production") {
        console.error("Falta la variable de entorno JWT_SECRET.");
        process.exit(1);
    }
    console.warn("Aviso: JWT_SECRET no está definida, se usa una clave de desarrollo.");
    process.env.JWT_SECRET = "clave-solo-para-desarrollo-cambiala";
}

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "7mb" }));
app.use(express.static(path.join(__dirname, "PUBLIC")));
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "PUBLIC", "index.htm"));
});

const conexion = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD ||"",
    database: process.env.DB_NAME || "LogoMARKET1",
    ssl: process.env.DB_CA ? { ca: process.env.DB_CA } : undefined,
    waitForConnections: true,
    connectionLimit: 5
});


const db = conexion.promise();

conexion.getConnection((error, conn) => {
    if(error){
        console.error("Error de conexion", error.message);
    }else{
        console.log("Conexión exitosa en la base de datos");
        conn.release();
    }
});


app.use("/api/perfil", rutasPerfil(db));
app.use("/api/compras", rutasCompras(db));

// Logos activos de diseñadores para el catálogo público.
app.get("/api/catalogo/logos", async (req, res) => {
    try {
        await asegurarVisibilidadLogos(db);
        const [logos] = await db.query(
            `SELECT l.id_logo, l.nombre_logo, l.descripcion, l.precio, l.imagen,
                    u.nombre AS nombre_disenador
             FROM logos l
             LEFT JOIN usuarios u ON u.id_usuario = l.id_usuario
             WHERE l.estado = 'disponible'
               AND l.visible_catalogo = 1
               AND l.imagen LIKE '/uploads/logos/%'
             ORDER BY l.id_logo DESC`
        );
        res.json(logos);
    } catch (error) {
        console.error("Error al cargar logos del catálogo:", error);
        res.status(500).json({ error: "No se pudieron cargar los logos publicados." });
    }
});

// Publicación de logos: el propietario siempre se toma de la sesión verificada.
const verificarSesion = require("./verificarsesion");
app.get("/api/disenador/logos", verificarSesion, async (req, res) => {
    if (req.usuario.rol !== "disenador") return res.status(403).json({ error: "Acceso solo para diseñadores." });
    try {
        await asegurarVisibilidadLogos(db);
        const [logos] = await db.query(
            `SELECT id_logo, nombre_logo, descripcion, precio, imagen,
                    CASE WHEN estado = 'vendido' THEN 'vendido'
                         WHEN visible_catalogo = 0 THEN 'no_disponible'
                         ELSE 'disponible' END AS estado
             FROM logos WHERE id_usuario = ? ORDER BY id_logo DESC`,
            [req.usuario.id]
        );
        res.json(logos);
    } catch (error) {
        console.error("Error al cargar logos del diseñador:", error);
        res.status(500).json({ error: "No se pudieron cargar tus logos." });
    }
});

app.get("/api/disenador/logos/:id", verificarSesion, async (req, res) => {
    if (req.usuario.rol !== "disenador") {
        return res.status(403).json({ error: "Acceso solo para diseñadores." });
    }
    try {
        const [filas] = await db.query(
            `SELECT id_logo, nombre_logo, descripcion, precio, imagen, estado
             FROM logos WHERE id_logo = ? AND id_usuario = ?`,
            [Number(req.params.id), req.usuario.id]
        );
        if (!filas.length) {
            return res.status(404).json({ error: "No encontramos ese logo en tu cuenta." });
        }
        res.json(filas[0]);
    } catch (error) {
        console.error("Error al cargar logo para editar:", error);
        res.status(500).json({ error: "No se pudo cargar el logo para editar." });
    }
});

app.put("/api/disenador/logos/:id", verificarSesion, async (req, res) => {
    if (req.usuario.rol !== "disenador") {
        return res.status(403).json({ error: "Acceso solo para diseñadores." });
    }
    const id = Number(req.params.id);
    const { nombre, descripcion, precio, imagen } = req.body;
    const precioNumero = Number(precio);
    if (
        !Number.isInteger(id) ||
        id < 1 ||
        !nombre?.trim() ||
        !descripcion?.trim() ||
        !Number.isFinite(precioNumero) ||
        precioNumero <= 0
    ) {
        return res.status(400).json({ error: "Revisa el nombre, la descripción y el precio del logo." });
    }

    let nuevaRuta = null;
    let imagenUrl = null;
    try {
        const [actuales] = await db.query(
            "SELECT imagen, estado FROM logos WHERE id_logo = ? AND id_usuario = ?",
            [id, req.usuario.id]
        );
        if (!actuales.length) {
            return res.status(404).json({ error: "No encontramos ese logo en tu cuenta." });
        }
        if (actuales[0].estado === "vendido") {
            return res.status(409).json({ error: "No se puede editar un logo que ya fue vendido." });
        }
        imagenUrl = actuales[0].imagen;

        if (imagen) {
            const coincidencia = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(imagen);
            if (!coincencia) return res.status(400).json({ error: "La imagen debe ser PNG, JPG o WebP." });
            const buffer = Buffer.from(coincidencia[2], "base64");
            if (!buffer.length || buffer.length > 5 * 1024 * 1024) {
                return res.status(400).json({
                    error: "La imagen debe pesar máximo 5 MB."
                });
            }
            const extension = coincidencia[1] === "jpeg" ? "jpg" : coincidencia[1];
            const nombreArchivo = `${Date.now()}-${require("crypto").randomUUID()}.${extension}`;
            const carpeta = path.join(__dirname, "PUBLIC", "uploads", "logos");
            await fs.promises.mkdir(carpeta, { recursive: true });
            nuevaRuta = path.join(carpeta, nombreArchivo);
            await fs.promises.writeFile(nuevaRuta, buffer, { flag: "wx" });
            imagenUrl = `/uploads/logos/${nombreArchivo}`;
        }

        const [resultado] = await db.query(
            `UPDATE logos
             SET nombre_logo = ?, descripcion = ?, precio = ?, imagen = ?
             WHERE id_logo = ? AND id_usuario = ? AND estado <> 'vendido'`,
            [nombre.trim(), descripcion.trim(), precioNumero, imagenUrl, id, req.usuario.id]
        );
        if (resultado.affectedRows === 0) {
            const [actualizados] = await db.query(
                `SELECT nombre_logo, descripcion, precio, imagen
                 FROM logos
                 WHERE id_logo = ? AND id_usuario = ?`,
                [id, req.usuario.id]
            );
            if (!actualizados.length) {
                return res.status(404).json({ error: "No encontramos ese logo en tu cuenta." });
            }

            const datosSinCambios =
                actualizados[0].imagen === imagenUrl &&
                actualizados[0].nombre_logo === nombre.trim() &&
                actualizados[0].descripcion === descripcion.trim() &&
                Number(actualizados[0].precio) === precioNumero;
            if (!datosSinCambios) {
                return res.status(409).json({ error: "No se pudo actualizar el logo." });
            }
        }

        if (nuevaRuta && actuales[0].imagen?.startsWith("/uploads/logos/")) {
            const rutaAnterior = path.join(__dirname, "PUBLIC", actuales[0].imagen.replace(/^\//, ""));
            await fs.promises.unlink(rutaAnterior).catch(() => {});
        }
        res.json({ ok: true, mensaje: "Logo actualizado correctamente." });
    } catch (error) {
        if (nuevaRuta) await fs.promises.unlink(nuevaRuta).catch(() => {});
        console.error("Error al editar logo:", error);
        res.status(500).json({ error: "No se pudo guardar el logo." });
    }
});

app.post("/api/disenador/logos", verificarSesion, async (req, res) => {
    if (req.usuario.rol !== "disenador") {
        return res.status(403).json({ error: "Acceso solo para diseñadores." });
    }
    const { nombre, descripcion, precio, imagen } = req.body;
    const precioNumero = Number(precio);
    if (
        !nombre?.trim() ||
        !descripcion?.trim() ||
        !Number.isFinite(precioNumero) ||
        precioNumero <= 0 ||
        !imagen
    ) {
        return res.status(400).json({ error: "Completa nombre, descripción, precio e imagen." });
    }
    const coincidencia = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(imagen);
    if (!coincidencia) {
        return res.status(400).json({ error: "La imagen debe ser PNG, JPG o WebP." });
    }
    const buffer = Buffer.from(coincidencia[2], "base64");
    if (!buffer.length || buffer.length > 5 * 1024 * 1024) {
        return res.status(400).json({ error: "La imagen debe pesar máximo 5 MB." });
    }
    const extension = coincidencia[1] === "jpeg" ? "jpg" : coincidencia[1];
    const nombreArchivo = `${Date.now()}-${require("crypto").randomUUID()}.${extension}`;
    const carpeta = path.join(__dirname, "PUBLIC", "uploads", "logos");
    let rutaImagenGuardada = null;
    try {
        await fs.promises.mkdir(carpeta, { recursive: true });
        rutaImagenGuardada = path.join(carpeta, nombreArchivo);
        await fs.promises.writeFile(rutaImagenGuardada, buffer, { flag: "wx" });
        const imagenUrl = `/uploads/logos/${nombreArchivo}`;

        // Las versiones anteriores de la tabla pueden no tener descripción.
        const [columnasDescripcion] = await db.query(
            "SHOW COLUMNS FROM logos LIKE 'descripcion'"
        );
        if (columnasDescripcion.length === 0) {
            await db.query("ALTER TABLE logos ADD COLUMN descripcion TEXT NULL");
        }

        const [categorias] = await db.query(
            "SELECT id_categoria FROM categorias ORDER BY id_categoria LIMIT 1"
        );
        if (!categorias.length) {
            await fs.promises.unlink(rutaImagenGuardada);
            rutaImagenGuardada = null;
            return res.status(400).json({
                error: "Agrega una categoría antes de publicar logos."
            });
        }
        await db.query(
            `INSERT INTO logos
                (nombre_logo, descripcion, precio, imagen, estado, id_usuario, id_categoria)
             VALUES (?, ?, ?, ?, 'disponible', ?, ?)`,
            [nombre.trim(), descripcion.trim(), precioNumero, imagenUrl, req.usuario.id, categorias[0].id_categoria]
        );
        rutaImagenGuardada = null;
        res.status(201).json({ ok: true, mensaje: "Logo publicado correctamente." });
    } catch (error) {
        if (rutaImagenGuardada) {
            await fs.promises.unlink(rutaImagenGuardada).catch(() => {});
        }
        console.error("Error al publicar logo:", error);
        const detalle = process.env.NODE_ENV === "production"
            ? undefined
            : error.sqlMessage || error.message;
        res.status(500).json({
            error: "No se pudo publicar el logo.",
            detalle,
            codigo: error.code
        });
    }
});



app.post("/registro", async (req, res) => {
    const { nombre, correo, password, rol } = req.body;

    if (!nombre || !correo || !password || !rol) {
        return res.status(400).send("Todos los campos son obligatorios.");
    }

    if (!["cliente", "disenador"].includes(rol)) {
        return res.status(400).send("Tipo de cuenta inválido.");
    }

    const expresionCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!expresionCorreo.test(correo)) {
        return res.status(400).send("Correo electrónico inválido.");
    }

    if (password.length < 8) {
        return res.status(400).send("La contraseña debe tener mínimo 8 caracteres.");
    }

    try {
        const [existe] = await db.query(
            "SELECT id_usuario FROM usuarios WHERE correo = ?",
            [correo]
        );

        if (existe.length > 0) {
            return res.status(400).send("El correo ya está registrado.");
        }

       
        const hash = await bcrypt.hash(password, 10);

        await db.query(
            "INSERT INTO usuarios(nombre, correo, password, rol) VALUES (?, ?, ?, ?)",
            [nombre, correo, hash, rol]
        );

        return res.status(201).send("Usuario registrado correctamente.");
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(400).send("El correo ya está registrado.");
        }
        console.error("ERROR REGISTRO:", error);
        return res.status(500).send("Error interno en el servidor.");
    }
});

app.post("/login", async (req, res) => {
    console.log("Entró a la ruta /login");
    const { correo, password } = req.body;

    if (!correo || !password) {
        return res.status(400).send("Debe ingresar correo y contraseña.");
    }

    try {
        const [filas] = await db.query("SELECT * FROM usuarios WHERE correo = ?", [correo]);
        const usuario = filas[0];
        let coincide = false;

        if (usuario) {
            if (usuario.password.startsWith("$2")) {
               
                coincide = await bcrypt.compare(password, usuario.password);
            } else if (usuario.password === password) {
                coincide = true;
                const hash = await bcrypt.hash(password, 10);
                await db.query(
                    "UPDATE usuarios SET password = ? WHERE id_usuario = ?",
                    [hash, usuario.id_usuario]
                );
            }
        }

        if (!coincide) {
            return res.status(401).json({
                exito: false,
                mensaje: "Correo o contraseña incorrectos."
            });
        }

        const token = jwt.sign(
            { id: usuario.id_usuario, rol: usuario.rol },
            process.env.JWT_SECRET,
            { expiresIn: "2h" }
        );

        return res.status(200).json({
            exito: true,
            mensaje: "Inicio de sesión exitoso.",
            usuario: {
                id_usuario: usuario.id_usuario,
                nombre: usuario.nombre,
                correo: usuario.correo,
                rol: usuario.rol,
                token
            }
        });
    } catch (error) {
        console.error("ERROR LOGIN:", error);
        return res.status(500).send("Error interno en el servidor.");
    }
});

// PENDIENTE: las rutas de administración de abajo todavía no verifican
// la sesión ni el rol, así que cualquiera que conozca la dirección puede usarlas.

app.get("/obtener-usuarios", (req, res) => {
    const sql = "SELECT id_usuario, nombre, correo, rol FROM usuarios ORDER BY id_usuario DESC";
    
    conexion.query(sql, (error, resultados) => {
        if(error) {
            console.error("Error:", error);
            return res.status(500).send("Error al obtener usuarios");
        }
        res.json(resultados);
    });
});


app.put("/actualizar-usuario", (req, res) => {
    const { id, nombre, correo, rol } = req.body;

    if (!id || !nombre || !correo || !rol) {
        return res.status(400).send("Faltan datos");
    }

    const sql = "UPDATE usuarios SET nombre = ?, correo = ?, rol = ? WHERE id_usuario = ?";
    
    conexion.query(sql, [nombre, correo, rol, id], (error, resultado) => {
        if(error) {
            console.error("Error:", error);
            return res.status(500).send("Error al actualizar usuario");
        }

        if(resultado.affectedRows === 0) {
            return res.status(404).send("Usuario no encontrado");
        }

        console.log(" Usuario actualizado:", id);
        res.send("Usuario actualizado correctamente");
    });
});


app.delete("/eliminar-usuario", (req, res) => {
    const { id } = req.body;

    if (!id) {
        return res.status(400).send("ID requerido");
    }

    const sql = "DELETE FROM usuarios WHERE id_usuario = ?";
    
    conexion.query(sql, [id], (error, resultado) => {
        if(error) {
            console.error("Error:", error);
            return res.status(500).send("Error al eliminar usuario");
        }

        if(resultado.affectedRows === 0) {
            return res.status(404).send("Usuario no encontrado");
        }

        console.log("Usuario eliminado:", id);
        res.send("Usuario eliminado correctamente");
    });
});

app.get("/usuarios", (req, res) => {
    conexion.query("SELECT id_usuario, nombre, correo, rol FROM usuarios", (error, resultados) => {
        if(error){
            console.log(error);
            return res.status(500).send("Error");
        }else{
            res.json(resultados);
        }
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("Servidor funcionando en el puerto " + PORT);
});
