try { require("dotenv").config(); } catch (e) { /* dotenv es opcional */ }

const express = require("express");
const mysql = require("mysql2");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const rutasPerfil = require("./perfil.rutas.js");
const rutasCompras = require("./compras.rutas.js");
const verificarsesion = require(".verificarsesion.js");


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
app.use(express.json());
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


app.post("/registro", async (req, res) => {
    const { nombre, correo, password } = req.body;

    if (!nombre || !correo || !password) {
        return res.status(400).send("Todos los campos son obligatorios.");
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
            "INSERT INTO usuarios(nombre, correo, password) VALUES (?, ?, ?)",
            [nombre, correo, hash]
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