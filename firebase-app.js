import { auth, db, storage } from "./firebase-config.js";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ==========================================
// 1. GESTIÓN DE SESIÓN Y ROLES
// ==========================================
let userRole = null; // 'admin', 'gestor' o null

onAuthStateChanged(auth, async (user) => {
    const authBtn = document.getElementById('authBtn');
    
    if (user) {
        // Asignación de Roles basada en el correo
        userRole = (user.email === 'admin@sanlorenzo.mx') ? 'admin' : 'gestor';
        
        if (authBtn) {
            authBtn.innerText = 'Ajustes ⚙️';
            authBtn.href = 'dashboard.html';
        }

        // Mostrar el botón global de cerrar sesión
        const logoutBtns = document.querySelectorAll('#globalLogoutBtn');
        logoutBtns.forEach(btn => btn.style.display = 'inline-block');

        // Mostrar formularios inline en páginas públicas si existen
        const formAvisoInline = document.getElementById('inlineAvisoFormContainer');
        if (formAvisoInline) formAvisoInline.style.display = 'block';

        const formFotoInline = document.getElementById('inlineFotoFormContainer');
        if (formFotoInline) formFotoInline.style.display = 'block';

        const formVideoInline = document.getElementById('inlineVideoFormContainer');
        if (formVideoInline) formVideoInline.style.display = 'block';

    } else {
        userRole = null;
        if (authBtn) {
            authBtn.innerText = 'Iniciar Sesión 🔒';
            authBtn.href = 'login.html';
        }
    }

    // Proteger Dashboard (Solo para Ajustes de Sistema)
    if (window.location.href.includes('dashboard.html')) {
        if (!user) {
            window.location.href = 'login.html';
        } else {
            const userNameDisplay = document.getElementById('userNameDisplay');
            if (userNameDisplay) userNameDisplay.innerText = `Hola, ${user.email} (${userRole})`;
            
            if (userRole === 'admin') {
                const adminPanel = document.getElementById('adminPanel');
                if (adminPanel) adminPanel.style.display = 'block';
            } else {
                const gestorWelcome = document.getElementById('gestorWelcome');
                if (gestorWelcome) gestorWelcome.style.display = 'block';
            }
        }
    }

    // Una vez resuelto el estado de sesión, cargamos los datos para saber si dibujar botones de borrado
    await cargarAvisos();
    await cargarGaleria();
    await cargarVideos();
});

// Botón de cerrar sesión global (necesita estar disponible en window)
window.logout = () => {
    signOut(auth).then(() => {
        window.location.href = 'index.html';
    });
};

// ==========================================
// 2. FORMULARIO DE LOGIN (login.html)
// ==========================================
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    // Remover cualquier listener viejo clonando el nodo
    const newForm = loginForm.cloneNode(true);
    loginForm.parentNode.replaceChild(newForm, loginForm);
    
    newForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('username').value.trim();
        const pass = document.getElementById('password').value.trim();
        try {
            await signInWithEmailAndPassword(auth, email, pass);
            // Redirigir directo a la página principal pública
            window.location.href = 'index.html';
        } catch (error) {
            console.error("Error de login:", error);
            document.getElementById('loginError').style.display = 'block';
        }
    });
}

// ==========================================
// 3. DASHBOARD Y CMS (dashboard.html)
// ==========================================
// A. CREAR AVISO
window.submitFormAviso = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerText;
    btn.innerText = "Publicando...";
    btn.disabled = true;

    const title = document.getElementById('avisoTitle').value;
    const content = document.getElementById('avisoContent').value;
    const fileInput = document.getElementById('avisoFile');
    const file = fileInput ? fileInput.files[0] : null;
    const expInput = document.getElementById('avisoExpiration');
    const expirationDate = expInput ? expInput.value : null;
    
    try {
        let imageUrl = null;
        if (file) {
            const storageRef = ref(storage, 'avisos/' + Date.now() + '_' + file.name);
            const snapshot = await uploadBytes(storageRef, file);
            imageUrl = await getDownloadURL(snapshot.ref);
            
            // Delete old image if updating and had one
            if (window.editingAvisoId && window.editingAvisoOldUrl && window.editingAvisoOldUrl.includes('firebasestorage')) {
                try {
                    const pathRegex = /o\/(.+?)\?/;
                    const match = window.editingAvisoOldUrl.match(pathRegex);
                    if (match && match[1]) {
                        await deleteObject(ref(storage, decodeURIComponent(match[1])));
                    }
                } catch (e) { console.error("Could not delete old image", e); }
            }
        } else if (window.editingAvisoId) {
            imageUrl = window.editingAvisoOldUrl; // keep old if not replacing
        }

        if (window.editingAvisoId) {
            await updateDoc(doc(db, "avisos", window.editingAvisoId), {
                title: title,
                content: content,
                imageUrl: imageUrl,
                expirationDate: expirationDate
            });
        } else {
            await addDoc(collection(db, "avisos"), {
                title: title,
                content: content,
                imageUrl: imageUrl,
                expirationDate: expirationDate,
                createdAt: new Date()
            });
        }
        
        document.getElementById('avisoSuccess').innerText = window.editingAvisoId ? '✅ Actualizado. Recargando...' : '✅ Publicado. Recargando...';
        document.getElementById('avisoSuccess').style.display = 'block';
        document.getElementById('formAviso').reset();
        window.editingAvisoId = null;
        window.editingAvisoOldUrl = null;
        
        setTimeout(() => {
            document.getElementById('avisoSuccess').style.display = 'none';
            window.location.reload(); // Recargar para ver el nuevo en la lista
        }, 1500);
    } catch (error) {
        console.error("Error publicando aviso:", error);
        alert("Hubo un error al publicar el aviso.");
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

// B. CREAR GESTOR
const formGestor = document.getElementById('formGestor');
if (formGestor) {
    formGestor.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('gestorUser').value.trim(); // Ahora es email
        const pass = document.getElementById('gestorPass').value.trim();
        
        try {
            await createUserWithEmailAndPassword(auth, email, pass);
            document.getElementById('gestorSuccess').style.display = 'block';
            formGestor.reset();
            setTimeout(() => document.getElementById('gestorSuccess').style.display = 'none', 3000);
        } catch (error) {
            console.error("Error creando gestor:", error);
            alert("Error al crear usuario (la contraseña debe tener al menos 6 caracteres y usar correo válido).");
        }
    });
}

// C. SUBIR FOTO O ACTUALIZAR
window.editingFotoId = null;
window.editingFotoOldUrl = null;

window.submitFormFoto = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerText;
    
    const title = document.getElementById('fotoTitle').value;
    const desc = document.getElementById('fotoDesc').value; // Nueva descripcion
    const fileInput = document.getElementById('fotoFile'); // Nuevo ID
    const file = fileInput.files[0];
    
    if (!file && !window.editingFotoId) {
        alert("Por favor selecciona una foto.");
        return;
    }

    btn.innerText = window.editingFotoId ? "Actualizando foto..." : "Subiendo archivo...";
    btn.disabled = true;

    try {
        let finalUrl = null;

        if (file) {
            // 1. Subir a Storage
            const storageRef = ref(storage, 'galeria/' + file.name);
            await uploadBytes(storageRef, file);
            
            // 2. Obtener la URL pública real
            finalUrl = await getDownloadURL(storageRef);
        } else if (window.editingFotoId) {
            finalUrl = window.editingFotoOldUrl; // keep old if not replacing
        }
        
        // 3. Guardar en Firestore
        if (window.editingFotoId) {
            await updateDoc(doc(db, "galeria", window.editingFotoId), {
                title: title,
                description: desc,
                url: finalUrl
            });
        } else {
            await addDoc(collection(db, "galeria"), {
                title: title,
                description: desc,
                url: finalUrl,
                createdAt: new Date()
            });
        }
        
        document.getElementById('fotoSuccess').innerText = window.editingFotoId ? '✅ Actualizado. Recargando...' : '✅ Foto subida. Recargando...';
        document.getElementById('fotoSuccess').style.display = 'block';
        document.getElementById('formFoto').reset();
        window.editingFotoId = null;
        window.editingFotoOldUrl = null;
        
        setTimeout(() => {
            document.getElementById('fotoSuccess').style.display = 'none';
            window.location.reload(); // Recargar para ver la nueva foto
        }, 1500);
    } catch (error) {
        console.error("Error procesando foto:", error);
        alert("Hubo un error al procesar la foto.");
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

// D. SUBIR VIDEO O ACTUALIZAR
window.editingVideoId = null;
window.editingVideoOldUrl = null;

window.submitFormVideo = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerText;
    
    const title = document.getElementById('videoTitle').value;
    const desc = document.getElementById('videoDesc').value;
    const fileInput = document.getElementById('videoFile');
    const file = fileInput.files[0];
    
    if (!file && !window.editingVideoId) {
        alert("Por favor selecciona un video.");
        return;
    }

    btn.innerText = window.editingVideoId ? "Actualizando video..." : "Subiendo archivo...";
    btn.disabled = true;

    try {
        let finalUrl = null;

        if (file) {
            // 1. Subir a Storage
            const storageRef = ref(storage, 'videos/' + Date.now() + '_' + file.name);
            await uploadBytes(storageRef, file);
            
            // 2. Obtener la URL pública real
            finalUrl = await getDownloadURL(storageRef);
        } else if (window.editingVideoId) {
            finalUrl = window.editingVideoOldUrl; // keep old if not replacing
        }
        
        // 3. Guardar en Firestore
        if (window.editingVideoId) {
            await updateDoc(doc(db, "videos", window.editingVideoId), {
                title: title,
                description: desc,
                url: finalUrl
            });
        } else {
            await addDoc(collection(db, "videos"), {
                title: title,
                description: desc,
                url: finalUrl,
                createdAt: new Date()
            });
        }
        
        document.getElementById('videoSuccess').innerText = window.editingVideoId ? '✅ Actualizado. Recargando...' : '✅ Video subido. Recargando...';
        document.getElementById('videoSuccess').style.display = 'block';
        document.getElementById('formVideo').reset();
        window.editingVideoId = null;
        window.editingVideoOldUrl = null;
        
        setTimeout(() => {
            document.getElementById('videoSuccess').style.display = 'none';
            window.location.reload(); 
        }, 1500);
    } catch (error) {
        console.error("Error procesando video:", error);
        alert("Hubo un error al procesar el video.");
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

// ==========================================
// 4. LECTURA DE DATOS PÚBLICOS E INLINE CMS
// ==========================================
async function cargarAvisos() {
    const gridAvisos = document.querySelector('#avisos .grid-2');

    try {
        const q = query(collection(db, "avisos"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        
        let dynamicHTML = '';
        const now = new Date();
        const avisosParaHero = [];
        
        querySnapshot.forEach((docSnap) => {
            const aviso = docSnap.data();
            
            // Lógica de Expiración (Limpieza Perezosa)
            if (aviso.expirationDate) {
                const expDate = new Date(aviso.expirationDate + 'T23:59:59');
                if (now > expDate) {
                    // El aviso caducó
                    if (userRole === 'admin') {
                        // El administrador hace el trabajo sucio de borrarlo de la nube silenciosamente
                        window.borrarAviso(docSnap.id, aviso.imageUrl, true);
                    }
                    return; // Saltarse este aviso y no pintarlo
                }
            }
            
            // Recopilar avisos con imagen para el slider
            if (aviso.imageUrl) {
                avisosParaHero.push({
                    title: aviso.title,
                    content: aviso.content,
                    imageUrl: aviso.imageUrl,
                    isDefault: false
                });
            }

            if (gridAvisos) {
                // Si el usuario tiene permisos (Admin o Gestor), inyectar el botón de borrar y editar
                let deleteBtnHTML = '';
                if (userRole === 'admin' || userRole === 'gestor') {
                    const safeImgUrl = aviso.imageUrl ? aviso.imageUrl.replace(/'/g, "\\'") : '';
                    // Botón Editar
                    const editBtn = `<button onclick="window.editarAviso('${docSnap.id}', '${aviso.title.replace(/'/g, "\\'")}', '${aviso.content.replace(/'/g, "\\'").replace(/\n/g, '\\n')}', '${aviso.expirationDate || ''}', '${safeImgUrl}')" style="background: #1976D2; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer; float: right; font-size: 0.8rem; z-index: 10; position: relative; margin-right: 5px;">✏️ Editar</button>`;
                    
                    // Botón Borrar
                    const deleteBtn = `<button onclick="window.borrarAviso('${docSnap.id}', '${safeImgUrl}')" style="background: #d32f2f; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer; float: right; font-size: 0.8rem; z-index: 10; position: relative;">🗑️ Borrar</button>`;
                    
                    deleteBtnHTML = deleteBtn + editBtn;
                }

                let imageHTML = '';
                if (aviso.imageUrl) {
                    imageHTML = `<img src="${aviso.imageUrl}" style="width: 100%; max-height: 200px; object-fit: cover; border-radius: 8px; margin-bottom: 15px;" alt="Aviso Image">`;
                }

                dynamicHTML += `
                <div class="notice-box" id="aviso-${docSnap.id}" style="border: 2px solid var(--jungle-green); position: relative; cursor: pointer;" onclick="window.openModal(event, '${aviso.title.replace(/'/g, "\\'")}', '${aviso.content.replace(/'/g, "\\'").replace(/\n/g, '<br>')}', 'aviso', '${aviso.imageUrl || ''}')">
                    ${deleteBtnHTML}
                    ${imageHTML}
                    <h3>${aviso.title} <span style="font-size: 0.7rem; color: #666;">(Nuevo)</span></h3>
                    <p>${aviso.content}</p>
                </div>
                `;
            }
        });
        
        if (gridAvisos) {
            if (dynamicHTML) {
                gridAvisos.innerHTML = dynamicHTML;
            } else {
                gridAvisos.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">No hay avisos publicados en este momento.</p>';
            }
        }

        // Inicializar el slider en caso de que estemos en index.html y haya avisos
        initHeroCarousel(avisosParaHero);
        
    } catch (error) {
        console.error("Error cargando avisos de Firebase:", error);
    }
}

async function cargarGaleria() {
    const gridGaleria = document.getElementById('gallery-grid');
    if (!gridGaleria) return;

    try {
        const q = query(collection(db, "galeria"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        
        let dynamicHTML = '';
        querySnapshot.forEach((docSnap) => {
            const foto = docSnap.data();
            
            // Safe description for modal
            const safeDesc = foto.description ? foto.description.replace(/'/g, "\\'").replace(/\n/g, '<br>') : '';
            const safeDescForArg = foto.description ? foto.description.replace(/'/g, "\\'").replace(/\n/g, '\\n') : '';
            
            // Botón de borrado y edición inline
            let actionBtnsHTML = '';
            if (userRole === 'admin' || userRole === 'gestor') {
                const editBtn = `<button onclick="window.editarFoto(event, '${docSnap.id}', '${foto.title.replace(/'/g, "\\'")}', '${safeDescForArg}', '${foto.url}')" style="background: #1976D2; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer; font-size: 0.8rem; z-index: 10; margin-right: 5px;">✏️ Editar</button>`;
                
                const deleteBtn = `<button onclick="window.borrarFoto('${docSnap.id}', '${foto.url}')" style="background: rgba(211, 47, 47, 0.9); color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer; font-size: 0.8rem; z-index: 10;">🗑️ Borrar</button>`;
                
                actionBtnsHTML = `<div style="position: absolute; top: 10px; right: 10px; display: flex;">${editBtn}${deleteBtn}</div>`;
            }

            dynamicHTML += `
            <div class="gallery-card" id="foto-${docSnap.id}" style="position: relative; cursor: pointer;" onclick="window.openModal(event, '${foto.title.replace(/'/g, "\\'")}', '${safeDesc}', 'image', '${foto.url}')">
                ${actionBtnsHTML}
                <img src="${foto.url}" alt="${foto.title}" class="gallery-img">
                <div class="gallery-caption">${foto.title}</div>
            </div>
            `;
        });
        
        if (dynamicHTML) {
            gridGaleria.innerHTML = dynamicHTML;
        } else {
            gridGaleria.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">No hay fotos en la galería. ¡Sube la primera!</p>';
        }
    } catch (error) {
        console.error("Error cargando fotos de Firebase:", error);
    }
}

async function cargarVideos() {
    const gridVideo = document.getElementById('video-grid');
    if (!gridVideo) return;

    try {
        const q = query(collection(db, "videos"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        
        let dynamicHTML = '';
        querySnapshot.forEach((docSnap) => {
            const video = docSnap.data();
            
            const safeDescForArg = video.description ? video.description.replace(/'/g, "\\'").replace(/\n/g, '\\n') : '';
            
            let actionBtnsHTML = '';
            if (userRole === 'admin' || userRole === 'gestor') {
                const editBtn = `<button onclick="window.editarVideo(event, '${docSnap.id}', '${video.title.replace(/'/g, "\\'")}', '${safeDescForArg}', '${video.url}')" style="background: #1976D2; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer; font-size: 0.8rem; z-index: 10; margin-right: 5px;">✏️ Editar</button>`;
                const deleteBtn = `<button onclick="window.borrarVideo('${docSnap.id}', '${video.url}')" style="background: rgba(211, 47, 47, 0.9); color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer; font-size: 0.8rem; z-index: 10;">🗑️ Borrar</button>`;
                actionBtnsHTML = `<div style="position: absolute; top: 10px; right: 10px; display: flex; z-index: 20;">${editBtn}${deleteBtn}</div>`;
            }

            dynamicHTML += `
            <div class="gallery-card" id="video-${docSnap.id}" style="position: relative;">
                ${actionBtnsHTML}
                <video src="${video.url}" controls class="gallery-video" style="border-top-left-radius: 12px; border-top-right-radius: 12px;"></video>
                <div class="gallery-caption">${video.title}</div>
            </div>
            `;
        });
        
        if (dynamicHTML) {
            gridVideo.innerHTML = dynamicHTML;
        } else {
            gridVideo.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">No hay videos en la videoteca. ¡Sube el primero!</p>';
        }
    } catch (error) {
        console.error("Error cargando videos de Firebase:", error);
    }
}

// Funciones globales para botones de borrar
window.borrarAviso = async (id, url, isSilent = false) => {
    // Si el navegador bloqueó las ventanas emergentes (confirm), esto asegura que el borrado proceda
    try {
        if (url && url.includes('firebasestorage')) {
            try {
                const pathRegex = /o\/(.+?)\?/;
                const match = url.match(pathRegex);
                if (match && match[1]) {
                    const decodedPath = decodeURIComponent(match[1]);
                    const fileRef = ref(storage, decodedPath);
                    await deleteObject(fileRef);
                }
            } catch (imgError) {
                console.error("Error borrando imagen de Storage (ignorando):", imgError);
            }
        }
        await deleteDoc(doc(db, "avisos", id));
        
        const avisoElement = document.getElementById(`aviso-${id}`);
        if (avisoElement) avisoElement.remove();
    } catch (error) {
        console.error("Error al borrar aviso:", error);
        alert("Error crítico al borrar de la base de datos: " + error.message);
    }
};

window.editingAvisoId = null;
window.editingAvisoOldUrl = null;

window.editarAviso = (id, title, content, expiration, imageUrl) => {
    // Fill form
    document.getElementById('avisoTitle').value = title;
    document.getElementById('avisoContent').value = content;
    const expInput = document.getElementById('avisoExpiration');
    if (expInput) expInput.value = expiration;
    
    // Set memory
    window.editingAvisoId = id;
    window.editingAvisoOldUrl = imageUrl;
    
    // Change UI
    const submitBtn = document.querySelector('#formAviso button[type="submit"]');
    submitBtn.innerText = "Actualizar Aviso";
    submitBtn.style.background = "#1976D2";
    
    // Cancel button
    let cancelBtn = document.getElementById('cancelEditBtn');
    if (!cancelBtn) {
        cancelBtn = document.createElement('button');
        cancelBtn.id = 'cancelEditBtn';
        cancelBtn.type = 'button';
        cancelBtn.innerText = 'Cancelar Edición';
        cancelBtn.style.background = '#666';
        cancelBtn.style.color = 'white';
        cancelBtn.style.border = 'none';
        cancelBtn.style.padding = '10px';
        cancelBtn.style.borderRadius = '6px';
        cancelBtn.style.marginTop = '10px';
        cancelBtn.style.width = '100%';
        cancelBtn.style.cursor = 'pointer';
        
        cancelBtn.onclick = () => {
            document.getElementById('formAviso').reset();
            window.editingAvisoId = null;
            window.editingAvisoOldUrl = null;
            submitBtn.innerText = "Publicar Aviso Ahora";
            submitBtn.style.background = ""; 
            cancelBtn.style.display = 'none';
        };
        document.getElementById('formAviso').appendChild(cancelBtn);
    }
    cancelBtn.style.display = 'block';
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.borrarFoto = async (id, url) => {
    try {
        // Delete from storage
        if (url && url.includes('firebasestorage')) {
            try {
                const pathRegex = /o\/(.+?)\?/;
                const match = url.match(pathRegex);
                if (match && match[1]) {
                    const decodedPath = decodeURIComponent(match[1]);
                    const fileRef = ref(storage, decodedPath);
                    await deleteObject(fileRef);
                }
            } catch (imgError) {
                console.error("Error borrando imagen de Storage (ignorando):", imgError);
            }
        }
        
        // Delete from firestore
        await deleteDoc(doc(db, "galeria", id));
        
        // Remove from UI
        const fotoElement = document.getElementById(`foto-${id}`);
        if (fotoElement) fotoElement.remove();
    } catch (error) {
        console.error("Error al borrar foto:", error);
        alert("Hubo un error al borrar la foto.");
    }
};

window.editarFoto = (event, id, title, desc, imageUrl) => {
    if (event) event.stopPropagation();
    
    document.getElementById('inlineFotoFormContainer').style.display = 'block';
    document.getElementById('fotoTitle').value = title;
    document.getElementById('fotoDesc').value = desc;
    
    window.editingFotoId = id;
    window.editingFotoOldUrl = imageUrl;
    
    const submitBtn = document.querySelector('#formFoto button[type="submit"]');
    submitBtn.innerText = "Guardar Cambios";
    submitBtn.style.background = "#FF9800";
    
    let cancelBtn = document.getElementById('cancelEditFotoBtn');
    if (!cancelBtn) {
        cancelBtn = document.createElement('button');
        cancelBtn.id = 'cancelEditFotoBtn';
        cancelBtn.type = 'button';
        cancelBtn.innerText = 'Cancelar Edición';
        cancelBtn.style.background = '#666';
        cancelBtn.style.color = 'white';
        cancelBtn.style.border = 'none';
        cancelBtn.style.padding = '10px';
        cancelBtn.style.borderRadius = '6px';
        cancelBtn.style.marginTop = '10px';
        cancelBtn.style.width = '100%';
        cancelBtn.style.cursor = 'pointer';
        
        cancelBtn.onclick = () => {
            document.getElementById('formFoto').reset();
            window.editingFotoId = null;
            window.editingFotoOldUrl = null;
            submitBtn.innerText = "Subir Foto Ahora";
            submitBtn.style.background = "var(--jungle-green)"; 
            cancelBtn.style.display = 'none';
        };
        document.getElementById('formFoto').appendChild(cancelBtn);
    }
    cancelBtn.style.display = 'block';
    
    document.getElementById('formFoto').scrollIntoView({ behavior: 'smooth' });
};

window.borrarVideo = async (id, url) => {
    try {
        if (url && url.includes('firebasestorage')) {
            try {
                const pathRegex = /o\/(.+?)\?/;
                const match = url.match(pathRegex);
                if (match && match[1]) {
                    const decodedPath = decodeURIComponent(match[1]);
                    const fileRef = ref(storage, decodedPath);
                    await deleteObject(fileRef);
                }
            } catch (videoError) {
                console.error("Error borrando video de Storage (ignorando):", videoError);
            }
        }
        
        await deleteDoc(doc(db, "videos", id));
        
        const videoElement = document.getElementById(`video-${id}`);
        if (videoElement) videoElement.remove();
    } catch (error) {
        console.error("Error al borrar video:", error);
        alert("Hubo un error al borrar el video.");
    }
};

window.editarVideo = (event, id, title, desc, videoUrl) => {
    if (event) event.stopPropagation();
    
    document.getElementById('inlineVideoFormContainer').style.display = 'block';
    document.getElementById('videoTitle').value = title;
    document.getElementById('videoDesc').value = desc;
    
    window.editingVideoId = id;
    window.editingVideoOldUrl = videoUrl;
    
    const submitBtn = document.querySelector('#formVideo button[type="submit"]');
    submitBtn.innerText = "Guardar Cambios";
    submitBtn.style.background = "#FF9800";
    
    let cancelBtn = document.getElementById('cancelEditVideoBtn');
    if (!cancelBtn) {
        cancelBtn = document.createElement('button');
        cancelBtn.id = 'cancelEditVideoBtn';
        cancelBtn.type = 'button';
        cancelBtn.innerText = 'Cancelar Edición';
        cancelBtn.style.background = '#666';
        cancelBtn.style.color = 'white';
        cancelBtn.style.border = 'none';
        cancelBtn.style.padding = '10px';
        cancelBtn.style.borderRadius = '6px';
        cancelBtn.style.marginTop = '10px';
        cancelBtn.style.width = '100%';
        cancelBtn.style.cursor = 'pointer';
        
        cancelBtn.onclick = () => {
            document.getElementById('formVideo').reset();
            window.editingVideoId = null;
            window.editingVideoOldUrl = null;
            submitBtn.innerText = "Subir Video Ahora";
            submitBtn.style.background = "var(--jungle-green)"; 
            cancelBtn.style.display = 'none';
        };
        document.getElementById('formVideo').appendChild(cancelBtn);
    }
    cancelBtn.style.display = 'block';
    
    document.getElementById('formVideo').scrollIntoView({ behavior: 'smooth' });
};

// ==========================================
// 5. CERRAR SESIÓN GLOBAL
// ==========================================
window.globalSignOut = async () => {
    try {
        await signOut(auth);
        window.location.href = 'login.html';
    } catch (error) {
        console.error("Error al cerrar sesión", error);
        alert("Hubo un error al cerrar sesión.");
    }
};

// ==========================================
// 6. HERO CAROUSEL LOGIC
// ==========================================
let heroSlides = [];
let currentHeroSlide = 0;
let heroInterval = null;

window.onHeroClick = (index) => {
    const slide = heroSlides[index];
    if (slide && !slide.isDefault) {
        window.openModal(null, slide.title, slide.content, 'aviso', slide.imageUrl);
    }
};

window.changeHeroSlide = (direction) => {
    if (heroSlides.length <= 1) return;

    currentHeroSlide = (currentHeroSlide + direction) % heroSlides.length;
    if (currentHeroSlide < 0) currentHeroSlide = heroSlides.length - 1;

    const track = document.getElementById('heroTrack');
    if (track) {
        track.style.transform = `translateX(-${currentHeroSlide * 100}%)`;
    }

    if (heroInterval) {
        clearInterval(heroInterval);
        heroInterval = setInterval(() => {
            window.changeHeroSlide(1);
        }, 4000);
    }
};

function initHeroCarousel(avisosSlides) {
    const track = document.getElementById('heroTrack');
    if (!track) return;

    if (heroSlides.length === 0) {
        const defaultSlide = track.querySelector('.hero-slide');
        const h1 = defaultSlide ? defaultSlide.querySelector('h1') : null;
        const p = defaultSlide ? defaultSlide.querySelector('p') : null;
        
        heroSlides.push({
            title: h1 ? h1.innerText : 'El Origen de los Olmecas',
            content: p ? p.innerText : '',
            imageUrl: 'hero.png',
            isDefault: true,
            html: defaultSlide ? defaultSlide.outerHTML : ''
        });
    }

    heroSlides = [heroSlides[0]].concat(avisosSlides.map((aviso, i) => ({
        ...aviso,
        html: `
        <div class="hero-slide" style="background-image: linear-gradient(rgba(28, 40, 51, 0.5), rgba(28, 40, 51, 0.8)), url('${aviso.imageUrl}'); cursor: pointer;" onclick="window.onHeroClick(SLIDE_INDEX)">
            <div class="hero-content">
                <h1>${aviso.title}</h1>
                <p>${aviso.content}</p>
            </div>
        </div>
        `
    })));

    track.innerHTML = heroSlides.map((slide, index) => slide.html.replace('SLIDE_INDEX', index)).join('');

    if (heroSlides.length > 1) {
        const leftBtn = document.querySelector('.hero-left-btn');
        const rightBtn = document.querySelector('.hero-right-btn');
        if (leftBtn) leftBtn.style.display = 'flex';
        if (rightBtn) rightBtn.style.display = 'flex';

        if (heroInterval) clearInterval(heroInterval);
        heroInterval = setInterval(() => {
            window.changeHeroSlide(1);
        }, 4000);
    }
}
