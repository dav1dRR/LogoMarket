
const jwt = require("jsonwebtoken");

module.exports = function verificarSesion(req, res, next) {
    const cabecera = req.headers.authorization || "";
    const token = cabecera.startsWith("Bearer ") ? cabecera.slice(7) : null;

    if (!token) return res.status(401).json({ error: "No has iniciado sesión." });

    try {
        req.usuario = jwt.verify(token, process.env.JWT_SECRET); // { id, rol }
        next();
    } catch (e) {
        return res.status(401).json({ error: "Tu sesión expiró. Inicia sesión de nuevo." });
    }
};