const express = require("express");
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

    const nombre = req.body.nombre;
    const correo = req.body.correo;
    const password = req.body.password;

    const sql = `
    INSERT INTO usuarios(nombre, correo, password)
    VALUES (?, ?, ?)
    `;

    conexion.query(sql,
    [nombre, correo, password],
    (error, resultado) => {

        if(error){
            console.log(error);
        }else{
            res.send("Usuario registrado");
        }

    });

});

app.post("/login", (req, res) => {

    const correo = req.body.correo;
    const password = req.body.password;

    const sql = `
    SELECT * FROM usuarios
    WHERE correo = ? AND password = ?
    `;

    conexion.query(sql,
    [correo, password],
    (error, resultado) => {

        if(error){
            console.log(error);
        }else{

            if(resultado.length > 0){
                res.send("Login correcto");
            }else{
                res.send("Usuario incorrecto");
            }

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