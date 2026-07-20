document.addEventListener("DOMContentLoaded", function() {
    
    const container = document.querySelector(".container")
    const btnSignIn = document.getElementById("btn-sign-in")
    const btnSignUp = document.getElementById("btn-sign-up")

    btnSignIn.addEventListener("click", () => {
        container.classList.remove("toggle");
    });

    btnSignUp.addEventListener("click", () => {
        container.classList.add("toggle");
    });

    // LOGIN
    const loginForm = document.getElementById("loginForm");

    if(loginForm) {
        console.log("loginForm encontrado");
        
        loginForm.addEventListener("submit", async function(e) {
            e.preventDefault();
            console.log(" Submit del login ejecutado");

            const correo = loginForm.querySelector('input[name="correo"]').value.trim();
            const password = loginForm.querySelector('input[name="password"]').value.trim();
            
            console.log(" Enviando:", { correo, password });

            const respuesta = await fetch("/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    correo,
                    password
                })
            });

            const mensaje = document.getElementById("mensajeLogin");
            const texto = await respuesta.text();

            console.log(" Respuesta del servidor:", texto);

            mensaje.textContent = texto;
            mensaje.style.display = "block";

            if (respuesta.ok) {
                mensaje.style.color = "#22c55e";
                mensaje.style.background = "#d1e7dd";
                mensaje.style.border = "1px solid #198754";

                setTimeout(() => {
                    window.location.href = "index.htm";
                }, 1500);
            } else {
                mensaje.style.color = "#dc3545";
                mensaje.style.background = "#f8d7da";
                mensaje.style.border = "1px solid #dc3545";
            }
        });
    } else {
        console.log(" loginForm NO encontrado");
    }

    // REGISTRO
    const registroForm = document.getElementById("registroForm");

    if(registroForm) {
        console.log(" registroForm encontrado");
        
        registroForm.addEventListener("submit", async function(e) {
            e.preventDefault();
            console.log(" Submit del registro ejecutado");

            const nombre = registroForm.querySelector('input[name="nombre"]').value.trim();
            const correo = registroForm.querySelector('input[name="correo"]').value.trim();
            const password = registroForm.querySelector('input[name="password"]').value.trim();
            
            console.log(" Enviando:", { nombre, correo, password });

            const respuesta = await fetch("/registro", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    nombre,
                    correo,
                    password
                })
            });

            const mensaje = document.getElementById("mensajeRegistro");
            const texto = await respuesta.text();

            console.log(" Respuesta del servidor:", texto);

            mensaje.textContent = texto;
            mensaje.style.display = "block";

            if (respuesta.ok) {
                mensaje.style.color = "#22c55e";
                mensaje.style.background = "#d1e7dd";
                mensaje.style.border = "1px solid #198754";

                registroForm.reset();
            } else {
                mensaje.style.color = "#dc3545";
                mensaje.style.background = "#f8d7da";
                mensaje.style.border = "1px solid #dc3545";
            }
        });
    } else {
        console.log(" registroForm NO encontrado");
    }

});