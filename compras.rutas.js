// compras.routes.js
// Finalizar la compra del carrito: registra cada logo en la tabla compras
// (así aparece luego en "Mis compras" del perfil) y lo marca como vendido.
//
// Uso en tu server.js:
//   const rutasCompras = require("./compras.routes");
//   app.use("/api/compras", rutasCompras(db));

const express = require("express");
const verificarSesion = require("./verificarSesion");

module.exports = function (db) {
    const router = express.Router();
    router.use(verificarSesion);

    // POST /api/compras   body: { "logos": [3, 7, 12] }
    router.post("/", async (req, res) => {
        // Solo aceptamos ids numéricos y sin repetir
        const ids = [...new Set((req.body.logos || []).map(Number))]
            .filter(n => Number.isInteger(n) && n > 0);

        if (ids.length === 0) {
            return res.status(400).json({ error: "Tu carrito está vacío." });
        }

        const conexion = await db.getConnection();

        try {
            await conexion.beginTransaction();

            // FOR UPDATE bloquea estas filas: si dos personas compran el mismo
            // logo al mismo tiempo, solo una de las dos compras se completa.
            const [logos] = await conexion.query(
                `SELECT id_logo, nombre_logo, precio, estado, id_usuario
                 FROM logos
                 WHERE id_logo IN (?) FOR UPDATE`,
                [ids]
            );

            if (logos.length !== ids.length) {
                await conexion.rollback();
                return res.status(404).json({ error: "Algún logo de tu carrito ya no existe." });
            }

            const propios = logos.filter(l => l.id_usuario === req.usuario.id);
            if (propios.length > 0) {
                await conexion.rollback();
                return res.status(400).json({
                    error: "No puedes comprar tus propios logos: " + propios.map(l => l.nombre_logo).join(", ") + "."
                });
            }

            const noDisponibles = logos.filter(l => l.estado !== "disponible");
            if (noDisponibles.length > 0) {
                await conexion.rollback();
                return res.status(409).json({
                    error: "Estos logos ya no están disponibles: " + noDisponibles.map(l => l.nombre_logo).join(", ") + ". Quítalos del carrito."
                });
            }

            // Registrar la compra y marcar los logos como vendidos
            await conexion.query(
                "INSERT INTO compras (id_usuario, id_logo) VALUES ?",
                [logos.map(l => [req.usuario.id, l.id_logo])]
            );
            await conexion.query(
                "UPDATE logos SET estado = 'vendido' WHERE id_logo IN (?)",
                [ids]
            );

            await conexion.commit();

            // El total se calcula con los precios de la base de datos,
            // nunca con los que envía el navegador.
            const total = logos.reduce((suma, l) => suma + Number(l.precio), 0);
            res.json({ ok: true, cantidad: logos.length, total });
        } catch (e) {
            await conexion.rollback();
            console.error(e);
            res.status(500).json({ error: "No pudimos completar la compra. Intenta de nuevo." });
        } finally {
            conexion.release();
        }
    });

    return router;
};