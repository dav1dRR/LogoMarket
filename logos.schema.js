// Añade la bandera de publicación a instalaciones que usan el esquema anterior.
module.exports = async function asegurarVisibilidadLogos(db) {
    const [columnas] = await db.query("SHOW COLUMNS FROM logos LIKE 'visible_catalogo'");
    if (columnas.length) return;

    try {
        await db.query("ALTER TABLE logos ADD COLUMN visible_catalogo TINYINT(1) NOT NULL DEFAULT 1");
    } catch (error) {
        // Permite que dos peticiones simultáneas comprueben la migración a la vez.
        if (error.code !== "ER_DUP_FIELDNAME") throw error;
    }
};
