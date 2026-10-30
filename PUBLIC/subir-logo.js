document.addEventListener("DOMContentLoaded", () => {
  let usuario;
  try { usuario = JSON.parse(localStorage.getItem("usuario") || "null"); } catch { usuario = null; }
  if (!usuario?.token || usuario.rol !== "disenador") {
    window.location.replace("Login.html");
    return;
  }

  const parametros = new URLSearchParams(window.location.search);
  const editarId = Number(parametros.get("editar")) || null;

  const form = document.getElementById("formLogo");
  const entradaImagen = document.getElementById("imagen");
  const vistaPrevia = document.getElementById("vistaPrevia");
  const mensaje = document.getElementById("mensaje");
  const boton = document.getElementById("btnPublicar");
  const logoMuestra = document.getElementById("logoMuestra");
  const muestraNombre = document.getElementById("muestraNombre");
  const muestraDescripcion = document.getElementById("muestraDescripcion");
  const muestraPrecio = document.getElementById("muestraPrecio");
  let imagenData = "";
  const formatoUSD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

  if (editarId) {
    document.getElementById("tituloPagina").textContent = "Edita tu diseño";
    document.getElementById("introPagina").textContent =
      "Actualiza los detalles de tu logo. Si no eliges una imagen nueva, conservaremos la actual.";
    document.getElementById("textoBoton").textContent = "Guardar cambios";
    document.getElementById("textoImagen").textContent = "Cambiar imagen (opcional)";
    document.getElementById("ayudaImagen").textContent =
      "Deja vacío para conservar la imagen actual · PNG, JPG o WebP · Máximo 5 MB";
    entradaImagen.required = false;
    cargarLogoParaEditar();
  }

  form.nombre.addEventListener("input", () => {
    muestraNombre.textContent = form.nombre.value.trim() || "Tu logo, aquí";
  });
  form.descripcion.addEventListener("input", () => {
    muestraDescripcion.textContent = form.descripcion.value.trim()
      || "Tu diseño merece una presentación a la altura. Completa el formulario para empezar.";
  });
  form.precio.addEventListener("input", () => {
    const precio = Number(form.precio.value);
    muestraPrecio.textContent = precio > 0 ? formatoUSD.format(precio) : "$0.00";
  });

  entradaImagen.addEventListener("change", () => {
    const archivo = entradaImagen.files[0];
    imagenData = "";
    vistaPrevia.hidden = true;
    if (!archivo) return;
    if (!/^image\/(png|jpeg|webp)$/.test(archivo.type) || archivo.size > 5 * 1024 * 1024) {
      mostrar("Elige una imagen PNG, JPG o WebP de máximo 5 MB.", "error");
      entradaImagen.value = "";
      return;
    }
    const lector = new FileReader();
    lector.onload = () => {
      imagenData = lector.result;
      vistaPrevia.src = imagenData;
      vistaPrevia.hidden = false;
      logoMuestra.src = imagenData;
    };
    lector.readAsDataURL(archivo);
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!editarId && !imagenData) return mostrar("Selecciona la imagen de tu logo.", "error");
    boton.disabled = true;
    try {
      const respuesta = await fetch(editarId ? `/api/disenador/logos/${editarId}` : "/api/disenador/logos", {
        method: editarId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${usuario.token}` },
        body: JSON.stringify({
          nombre: form.nombre.value.trim(),
          descripcion: form.descripcion.value.trim(),
          precio: form.precio.value,
          imagen: imagenData || null
        })
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        const codigoError = datos.codigo ? ` (código: ${datos.codigo})` : "";
        const errorServidor = [datos.error, datos.detalle].filter(Boolean).join(" ") + codigoError;
        throw new Error(errorServidor || "No se pudo publicar el logo.");
      }

      const mensajeExito = editarId
        ? "Cambios guardados. Volviendo a tu panel…"
        : "Logo publicado correctamente. Volviendo a tu panel…";
      mostrar(mensajeExito, "ok");
      form.reset(); imagenData = ""; vistaPrevia.hidden = true;
      setTimeout(() => { window.location.href = "index.htm"; }, 1200);
    } catch (error) {
      mostrar(error.message || "Error de conexión con el servidor.", "error");
    } finally { boton.disabled = false; }
  });

  async function cargarLogoParaEditar() {
    try {
      const respuesta = await fetch(`/api/disenador/logos/${editarId}`, {
        headers: { Authorization: `Bearer ${usuario.token}` }
      });
      const logo = await respuesta.json();
      if (!respuesta.ok) throw new Error(logo.error || "No se pudo cargar el logo.");
      if (logo.estado === "vendido") throw new Error("Los logos vendidos no se pueden editar.");
      form.nombre.value = logo.nombre_logo || "";
      form.descripcion.value = logo.descripcion || "";
      form.precio.value = logo.precio || "";
      muestraNombre.textContent = logo.nombre_logo || "Tu logo, aquí";
      muestraDescripcion.textContent = logo.descripcion || "Tu diseño merece una presentación a la altura.";
      const precio = Number(logo.precio) || 0;
      muestraPrecio.textContent = precio > 0 ? formatoUSD.format(precio) : "$0.00";
      logoMuestra.src = logo.imagen;
      vistaPrevia.src = logo.imagen;
      vistaPrevia.hidden = false;
    } catch (error) {
      boton.disabled = true;
      mostrar(error.message || "No se pudo cargar el logo.", "error");
    }
  }

  function mostrar(texto, tipo) {
    mensaje.textContent = texto;
    mensaje.className = `visible ${tipo}`;
  }
});
