// ================================
// LÓGICA DE ACCESIBILIDAD
// ================================

// Inicializar el estado de accesibilidad desde localStorage
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('highContrast') === 'true') {
        document.body.classList.add('high-contrast');
    }
    if (localStorage.getItem('largeText') === 'true') {
        document.body.classList.add('large-text');
    }
});

function toggleContrast() {
    const body = document.body;
    body.classList.toggle('high-contrast');
    const isHighContrast = body.classList.contains('high-contrast');
    localStorage.setItem('highContrast', isHighContrast);
}

function toggleTextSize() {
    const body = document.body;
    body.classList.toggle('large-text');
    const isLargeText = body.classList.contains('large-text');
    localStorage.setItem('largeText', isLargeText);
}

// ================================
// LÓGICA DE TRADUCCIÓN (Lenguas)
// ================================

function googleTranslateElementInit() {
    new google.translate.TranslateElement({
        pageLanguage: 'es',
        autoDisplay: false
    }, 'google_translate_element');
}

function changeLanguage(lang) {
    if (lang === 'es') {
        // Restaurar a español original limpiando las cookies
        document.cookie = "googtrans=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;";
        document.cookie = "googtrans=; Path=/; Domain=" + window.location.hostname + "; Expires=Thu, 01 Jan 1970 00:00:01 GMT;";
        location.reload();
    } else {
        // Establecer cookie como respaldo
        document.cookie = "googtrans=/es/" + lang + "; Path=/;";
        document.cookie = "googtrans=/es/" + lang + "; Path=/; Domain=" + window.location.hostname + ";";
        
        // Disparar el evento directamente en el widget (más confiable en entorno local)
        var gtCombo = document.querySelector('.goog-te-combo');
        if (gtCombo) {
            gtCombo.value = lang;
            gtCombo.dispatchEvent(new Event('change'));
        } else {
            location.reload(); // Si el widget no ha cargado, recargar
        }
    }
}

// ==========================================
// LÓGICA DEL LIGHTBOX (MODAL GLOBAL)
// ==========================================
window.modalState = {
    siblings: [],
    currentIndex: -1
};

window.nextModalItem = (e) => {
    if (e) e.stopPropagation();
    const state = window.modalState;
    if (state.currentIndex < state.siblings.length - 1) {
        const nextEl = state.siblings[state.currentIndex + 1];
        nextEl.click();
    }
};

window.prevModalItem = (e) => {
    if (e) e.stopPropagation();
    const state = window.modalState;
    if (state.currentIndex > 0) {
        const prevEl = state.siblings[state.currentIndex - 1];
        prevEl.click();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // Inyectar el HTML del modal al final del body
    const modalHTML = `
        <div id="globalModal" class="global-modal">
            <button id="modalPrev" class="modal-nav-btn left-btn" onclick="window.prevModalItem(event)" style="display:none;">❮</button>
            <div class="modal-content-container">
                <button class="modal-close" onclick="window.closeModal()">&times;</button>
                <div id="modalBody"></div>
            </div>
            <button id="modalNext" class="modal-nav-btn right-btn" onclick="window.nextModalItem(event)" style="display:none;">❯</button>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Escuchar la tecla ESC para cerrar el modal y flechas para navegar
    document.addEventListener('keydown', (e) => {
        const modal = document.getElementById('globalModal');
        if (modal && modal.classList.contains('show')) {
            if (e.key === 'Escape') {
                window.closeModal();
            } else if (e.key === 'ArrowRight') {
                window.nextModalItem();
            } else if (e.key === 'ArrowLeft') {
                window.prevModalItem();
            }
        }
    });

    // Cerrar al hacer clic fuera del contenedor (en el fondo oscuro)
    document.getElementById('globalModal').addEventListener('click', (e) => {
        if (e.target.id === 'globalModal') {
            window.closeModal();
        }
    });
});

window.openModal = (event, title, content, type = 'text', imageUrl = '') => {
    if (event && event.target && event.target.closest('button')) return;
    
    // Update modal state for carousel navigation
    if (event && event.currentTarget) {
        const parent = event.currentTarget.parentNode;
        if (parent) {
            const siblings = Array.from(parent.children).filter(el => 
                el.classList.contains('gallery-card') || el.classList.contains('notice-box')
            );
            const index = siblings.indexOf(event.currentTarget);
            if (index !== -1) {
                window.modalState.siblings = siblings;
                window.modalState.currentIndex = index;
            }
        }
    }

    const modal = document.getElementById('globalModal');
    const modalBody = document.getElementById('modalBody');
    
    // Animate content change
    modalBody.classList.remove('modal-animating');
    void modalBody.offsetWidth; // trigger reflow
    modalBody.classList.add('modal-animating');
    
    if (type === 'image') {
        modalBody.innerHTML = `
            <img src="${imageUrl}" alt="${title}">
            <h2>${title}</h2>
            ${content ? `<p style="text-align: left;">${content}</p>` : ''}
        `;
    } else if (type === 'aviso') {
        const imgTag = imageUrl ? `<img src="${imageUrl}" alt="${title}">` : '';
        modalBody.innerHTML = `
            ${imgTag}
            <h2>${title}</h2>
            <p style="text-align: left;">${content}</p>
        `;
    } else {
        modalBody.innerHTML = `
            <h2>${title}</h2>
            <p>${content}</p>
        `;
    }
    
    // Update button visibility
    const prevBtn = document.getElementById('modalPrev');
    const nextBtn = document.getElementById('modalNext');
    if (prevBtn && nextBtn) {
        if (window.modalState.siblings.length > 1) {
            prevBtn.style.display = window.modalState.currentIndex > 0 ? 'flex' : 'none';
            nextBtn.style.display = window.modalState.currentIndex < window.modalState.siblings.length - 1 ? 'flex' : 'none';
        } else {
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
        }
    }
    
    modal.classList.add('show');
    document.body.style.overflow = 'hidden'; // Evitar scroll del fondo
};

window.closeModal = () => {
    const modal = document.getElementById('globalModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = 'auto'; // Restaurar scroll
    }
};
// Fin de app.js (La lógica de Firebase está en firebase-app.js)
