const express = require("express");
console.log("ESTE ES MI SERVER");
const mysql = require("mysql2");
const path = require("path");

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const conexion = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "LogoMARKET1"
});

conexion.connect((error) => {

    if(error){
        console.log(error);
    }else{
        console.log("Conexión exitosa");
    }

});

app.post("/registro", (req, res) => {

    console.log(req.body);
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

    
    conexion.query(
        "SELECT * FROM usuarios WHERE correo = ?",
        [correo],
        (error, resultado) => {

            if (error) {
                console.error("ERROR REGISTRO:", error); 
                return res.status(500).send("Error interno en el servidor."); 
            }


            if (resultado.length > 0) {
                return res.status(400).send("El correo ya está registrado.");
            }

            const sql = `
            INSERT INTO usuarios(nombre, correo, password)
            VALUES (?, ?, ?)
            `;

            conexion.query(sql,
                [nombre, correo, password],
                (error) => {

                    if (error) {
                    console.error("ERROR REGISTRO:", error); 
                    return res.status(500).send("Error interno en el servidor."); 
}


                    return res.status(201).send("Usuario registrado correctamente.");

                });

        });

});

app.post("/login", (req, res) => {

    console.log(req.body);
    console.log("Entró a la ruta /login");
    const { correo, password } = req.body;

    if (!correo || !password) {
        return res.status(400).send("Debe ingresar correo y contraseña.");
    }

    const sql = `
    SELECT * FROM usuarios
    WHERE correo = ? AND password = ?
    `;

    conexion.query(sql, [correo, password], (error, resultado) => {

    if (error) {
        console.error("ERROR LOGIN:", error);
        return res.status(500).send("Error interno en el servidor.");
    }


    if (resultado.length > 0) {
        return res.status(200).send("Inicio de sesión exitoso.");
    } else {
        return res.status(401).send("Correo o contraseña incorrectos.");
    }

});

    

});

app.listen(3000, () => {
    console.log("Servidor funcionando");
});
app.get("/usuarios", (req, res) => {

    conexion.query("SELECT * FROM usuarios", (error, resultados) => {

        if(error){
            console.log(error);
        }else{
            res.json(resultados);
        }

    });

});
