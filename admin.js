let usuarioAEliminar = null;

document.addEventListener("DOMContentLoaded", function() {
    cargarUsuarios();
    configurarModales();
});

//  CARGAR USUARIOS 
function cargarUsuarios() {
    fetch("/obtener-usuarios")
        .then(res => res.json())
        .then(usuarios => {
            const tbody = document.getElementById("bodyTabla");
            tbody.innerHTML = "";

            usuarios.forEach(usuario => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>${usuario.id_usuario}</td>
                    <td>${usuario.nombre}</td>
                    <td>${usuario.correo}</td>
                    <td>${usuario.rol}</td>
                    <td>${new Date(usuario.fecha_registro).toLocaleDateString()}</td>
                    <td>
                        <div class="acciones">
                            <button class="btn-editar" onclick="abrirModalEditar(${usuario.id_usuario}, '${usuario.nombre}', '${usuario.correo}', '${usuario.rol}')">Editar</button>
                            <button class="btn-eliminar-fila" onclick="abrirModalEliminar(${usuario.id_usuario}, '${usuario.nombre}')">Eliminar</button>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        })
        .catch(error => {
            console.error("Error:", error);
            alert("Error al cargar usuarios");
        });
}

//   EDITAR 
function abrirModalEditar(id, nombre, correo, rol) {
    document.getElementById("editId").value = id;
    document.getElementById("editNombre").value = nombre;
    document.getElementById("editCorreo").value = correo;
    document.getElementById("editRol").value = rol;
    document.getElementById("modalEditar").classList.add("mostrar");
}

document.getElementById("formEditar").addEventListener("submit", async function(e) {
    e.preventDefault();

    const id = document.getElementById("editId").value;
    const nombre = document.getElementById("editNombre").value.trim();
    const correo = document.getElementById("editCorreo").value.trim();
    const rol = document.getElementById("editRol").value;

    if (!nombre || !correo) {
        alert("Por favor completa todos los campos");
        return;
    }

    try {
        const respuesta = await fetch("/actualizar-usuario", {
            method: "PUT",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ id, nombre, correo, rol })
        });

        const texto = await respuesta.text();

        if (respuesta.ok) {
            alert("Usuario actualizado correctamente");
            document.getElementById("modalEditar").classList.remove("mostrar");
            cargarUsuarios();
        } else {
            alert(texto);
        }
    } catch (error) {
        console.error("Error:", error);
        alert("Error al actualizar");
    }
});

//  ELIMINAR 
function abrirModalEliminar(id, nombre) {
    usuarioAEliminar = id;
    document.getElementById("textoEliminar").textContent = `¿Estás seguro de que deseas eliminar al usuario "${nombre}"?`;
    document.getElementById("modalEliminar").classList.add("mostrar");
}

document.getElementById("btnConfirmarEliminar").addEventListener("click", async function() {
    try {
        const respuesta = await fetch("/eliminar-usuario", {
            method: "DELETE",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ id: usuarioAEliminar })
        });

        const texto = await respuesta.text();

        if (respuesta.ok) {
            alert("Usuario eliminado correctamente");
            document.getElementById("modalEliminar").classList.remove("mostrar");
            cargarUsuarios();
        } else {
            alert(texto);
        }
    } catch (error) {
        console.error("Error:", error);
        alert("Error al eliminar");
    }
});

// CONFIGURAR MODALES 
function configurarModales() {
    const modales = document.querySelectorAll(".modal");
    
    modales.forEach(modal => {
        const cerrar = modal.querySelector(".cerrar");
        
        if (cerrar) {
            cerrar.addEventListener("click", function() {
                modal.classList.remove("mostrar");
            });
        }

        window.addEventListener("click", function(e) {
            if (e.target === modal) {
                modal.classList.remove("mostrar");
            }
        });
    });

    const cerrarBotones = document.querySelectorAll(".cerrar-modal");
    cerrarBotones.forEach(btn => {
        btn.addEventListener("click", function() {
            this.closest(".modal").classList.remove("mostrar");
        });
    });
}