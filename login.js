document.addEventListener("DOMContentLoaded", function () {
  const container = document.querySelector(".container");
  const btnSignIn = document.getElementById("btn-sign-in");
  const btnSignUp = document.getElementById("btn-sign-up");

  if (btnSignIn) btnSignIn.addEventListener("click", () => container.classList.remove("toggle"));
  if (btnSignUp) btnSignUp.addEventListener("click", () => container.classList.add("toggle"));

  // - LOGIN -
  const loginForm = document.getElementById("loginForm");

  if (loginForm) {
    loginForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      const correo = loginForm.querySelector('input[name="correo"]').value.trim();
      const password = loginForm.querySelector('input[name="password"]').value.trim();
      const mensaje = document.getElementById("mensajeLogin");

      try {
        const respuesta = await fetch("/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ correo, password })
        });

        const datos = await respuesta.json();

        mensaje.textContent = datos.mensaje;
        mensaje.style.display = "block";

        if (respuesta.ok && datos.exito) {
          mensaje.style.color = "#22c55e";
          mensaje.style.background = "#d1e7dd";
          mensaje.style.border = "1px solid #198754";

          // AQUÍ se guarda la sesión
          localStorage.setItem("usuario", JSON.stringify(datos.usuario));

          setTimeout(() => {
            window.location.href = "index.htm";
          }, 1500);
        } else {
          mensaje.style.color = "#dc3545";
          mensaje.style.background = "#f8d7da";
          mensaje.style.border = "1px solid #dc3545";
        }
      } catch (error) {
        console.error("Error en login:", error);
        mensaje.textContent = "Error de conexión con el servidor.";
        mensaje.style.display = "block";
      }
    });
  }

  // - REGISTRO 
  const registroForm = document.getElementById("registroForm");

  if (registroForm) {
    registroForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      const nombre = registroForm.querySelector('input[name="nombre"]').value.trim();
      const correo = registroForm.querySelector('input[name="correo"]').value.trim();
      const password = registroForm.querySelector('input[name="password"]').value.trim();
      const mensaje = document.getElementById("mensajeRegistro");

      try {
        const respuesta = await fetch("/registro", {  
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre, correo, password })
        });

        const texto = await respuesta.text();   

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
      } catch (error) {
        console.error("Error en registro:", error);
        mensaje.textContent = "Error de conexión con el servidor.";
        mensaje.style.display = "block";
      }
    });
  }
});