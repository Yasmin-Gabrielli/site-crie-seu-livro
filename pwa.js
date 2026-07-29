// PWA & Offline Manager for Escrevendo Fanfics
(function () {
    let deferredPrompt = null;

    // 1. Registro do Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then((registration) => {
                    console.log('[PWA] Service Worker registrado com sucesso. Escopo:', registration.scope);
                })
                .catch((error) => {
                    console.error('[PWA] Falha ao registrar Service Worker:', error);
                });
        });
    }

    // 2. Captura do Evento de Instalação (PWA Install Prompt)
    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevenir exibição automática padrão do navegador
        e.preventDefault();
        deferredPrompt = e;
        console.log('[PWA] Prompt de instalação pronto.');

        // Exibir botões de instalação na interface
        showInstallPromotion();
    });

    // 3. Captura do evento de aplicativo instalado
    window.addEventListener('appinstalled', () => {
        console.log('[PWA] Aplicativo foi instalado com sucesso!');
        deferredPrompt = null;
        hideInstallPromotion();
        showToast('App instalado com sucesso! Agora você pode acessá-lo na tela inicial do seu celular.', 'success');
    });

    // 4. Monitoramento da Conexão (Online / Offline)
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    function updateOnlineStatus() {
        const isOffline = !navigator.onLine;
        const body = document.body;

        if (isOffline) {
            body.classList.add('is-offline');
            showToast('<i class="fas fa-wifi-slash"></i> Você está offline. O app continua funcionando perfeitamente!', 'warning', 5000);
        } else {
            body.classList.remove('is-offline');
            showToast('<i class="fas fa-wifi"></i> Conexão restabelecida!', 'success', 3000);
        }
    }

    // Exibir botões de instalação
    function showInstallPromotion() {
        const installBtns = document.querySelectorAll('.pwa-install-btn');
        installBtns.forEach(btn => {
            btn.style.display = 'inline-flex';
            btn.addEventListener('click', promptInstall);
        });

        // Se houver nav e não tiver botão ainda, adicionar dinamicamente
        const navs = document.querySelectorAll('header nav');
        navs.forEach(nav => {
            if (!nav.querySelector('.pwa-install-btn')) {
                const btn = document.createElement('button');
                btn.className = 'btn btn-install pwa-install-btn';
                btn.innerHTML = '<i class="fas fa-download"></i> Instalar App';
                btn.title = 'Instalar o aplicativo no celular ou computador';
                btn.addEventListener('click', promptInstall);
                nav.appendChild(btn);
            }
        });
    }

    function hideInstallPromotion() {
        const installBtns = document.querySelectorAll('.pwa-install-btn');
        installBtns.forEach(btn => {
            btn.style.display = 'none';
        });
    }

    async function promptInstall() {
        if (!deferredPrompt) {
            showToast('Para instalar no iOS (iPhone/iPad): toque no botão Compartilhar <i class="fas fa-share-square"></i> e selecione "Adicionar à Tela de Início".', 'info', 7000);
            return;
        }

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`[PWA] Usuário respondeu ao prompt de instalação: ${outcome}`);

        if (outcome === 'accepted') {
            deferredPrompt = null;
            hideInstallPromotion();
        }
    }

    // Sistema de Notificação Toast
    function showToast(message, type = 'info', duration = 4000) {
        let toastContainer = document.getElementById('pwa-toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'pwa-toast-container';
            toastContainer.className = 'pwa-toast-container';
            document.body.appendChild(toastContainer);
        }

        const toast = document.createElement('div');
        toast.className = `pwa-toast pwa-toast-${type}`;
        toast.innerHTML = `
            <div class="pwa-toast-content">${message}</div>
            <button class="pwa-toast-close" onclick="this.parentElement.remove()">&times;</button>
        `;

        toastContainer.appendChild(toast);

        // Animação de entrada
        setTimeout(() => toast.classList.add('show'), 10);

        // Auto remoção
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    // Inicialização ao carregar a página
    document.addEventListener('DOMContentLoaded', () => {
        // Verificar status inicial da rede
        if (!navigator.onLine) {
            updateOnlineStatus();
        }

        // Criar indicador visual de offline permanente no footer se desejado
        const footer = document.querySelector('footer');
        if (footer) {
            const badge = document.createElement('div');
            badge.className = 'pwa-badge';
            badge.innerHTML = '<i class="fas fa-mobile-alt"></i> PWA Pronto para uso Offline';
            footer.appendChild(badge);
        }
    });

    // Expor função globalmente se necessário
    window.promptPwaInstall = promptInstall;
})();
