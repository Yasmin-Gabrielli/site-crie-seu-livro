// Fanfic & E-Book Application Manager
class FanficApp {
    constructor() {
        this.editor = null;
        this.currentStory = null;
        this.stories = [];
        this.activePageIndex = 0;
        this.autoSaveTimeout = null;
        this.init();
    }

    async init() {
        this.initializeEditor();
        this.setupEventListeners();
        await this.loadStories();
        this.checkLoginStatus();

        // Check if redirected to open a specific story ID from URL or sessionStorage
        const openId = sessionStorage.getItem('open-story-id');
        if (openId) {
            sessionStorage.removeItem('open-story-id');
            await this.loadStory(openId);
        } else if (!this.currentStory && document.querySelector('#editor')) {
            this.newStory(false);
        }
    }

    initializeEditor() {
        const editorEl = document.querySelector('#editor');
        if (!editorEl) return; // Not on editor page

        // Fallback or TipTap Editor initialization
        try {
            if (window.tiptap && window.tiptapExtensions) {
                const { Editor } = window.tiptap;
                const { StarterKit } = window.tiptapExtensions;

                this.editor = new Editor({
                    extensions: [new StarterKit()],
                    element: editorEl,
                    content: '<p>Bem-vindo ao editor! Comece a escrever seu livro ou capítulo aqui...</p>',
                    onUpdate: () => {
                        this.handleEditorUpdate();
                    },
                });
            } else {
                // High reliability fallback contenteditable editor if TipTap CDN fails
                editorEl.setAttribute('contenteditable', 'true');
                editorEl.classList.add('ProseMirror');
                editorEl.innerHTML = '<p>Bem-vindo ao editor! Comece a escrever seu livro ou capítulo aqui...</p>';
                editorEl.addEventListener('input', () => this.handleEditorUpdate());
                this.editor = {
                    getHTML: () => editorEl.innerHTML,
                    setContent: (html) => { editorEl.innerHTML = html; },
                    commands: { focus: () => editorEl.focus() }
                };
            }
        } catch (e) {
            console.warn('TipTap init fallback:', e);
            editorEl.setAttribute('contenteditable', 'true');
            editorEl.classList.add('ProseMirror');
            editorEl.innerHTML = '<p>Bem-vindo ao editor! Comece a escrever seu livro ou capítulo aqui...</p>';
            editorEl.addEventListener('input', () => this.handleEditorUpdate());
            this.editor = {
                getHTML: () => editorEl.innerHTML,
                setContent: (html) => { editorEl.innerHTML = html; },
                commands: { focus: () => editorEl.focus() }
            };
        }

        this.setupEditorToolbar();
        window.editor = this.editor;
    }

    setupEditorToolbar() {
        const editorContainer = document.querySelector('.editor-container');
        if (!editorContainer || document.querySelector('.toolbar-editor')) return;

        const toolbarContainer = document.createElement('div');
        toolbarContainer.className = 'toolbar-editor';

        const buttons = [
            { name: 'bold', icon: 'fas fa-bold', title: 'Negrito', action: () => this.formatDoc('bold') },
            { name: 'italic', icon: 'fas fa-italic', title: 'Itálico', action: () => this.formatDoc('italic') },
            { name: 'underline', icon: 'fas fa-underline', title: 'Sublinhado', action: () => this.formatDoc('underline') },
            { name: 'strike', icon: 'fas fa-strikethrough', title: 'Tachado', action: () => this.formatDoc('strikeThrough') },
            { name: 'h1', icon: 'fas fa-heading', title: 'Título 1', action: () => this.formatDoc('formatBlock', '<h1>') },
            { name: 'h2', icon: 'fas fa-heading', title: 'Título 2', action: () => this.formatDoc('formatBlock', '<h2>') },
            { name: 'ul', icon: 'fas fa-list-ul', title: 'Lista', action: () => this.formatDoc('insertUnorderedList') },
            { name: 'ol', icon: 'fas fa-list-ol', title: 'Lista Numerada', action: () => this.formatDoc('insertOrderedList') },
            { name: 'quote', icon: 'fas fa-quote-left', title: 'Citação', action: () => this.formatDoc('formatBlock', '<blockquote>') },
            { name: 'link', icon: 'fas fa-link', title: 'Inserir Link', action: () => this.promptLink() },
            { name: 'image', icon: 'fas fa-image', title: 'Inserir Imagem', action: () => this.openMediaModal('image') },
            { name: 'audio', icon: 'fas fa-music', title: 'Inserir Áudio', action: () => this.openMediaModal('audio') },
            { name: 'video', icon: 'fas fa-video', title: 'Inserir Vídeo', action: () => this.openMediaModal('video') },
        ];

        buttons.forEach(btn => {
            const button = document.createElement('button');
            button.type = 'button';
            button.innerHTML = `<i class="${btn.icon}"></i> ${btn.title}`;
            button.title = btn.title;
            button.onclick = (e) => {
                e.preventDefault();
                btn.action();
            };
            toolbarContainer.appendChild(button);
        });

        editorContainer.parentNode.insertBefore(toolbarContainer, editorContainer);
    }

    formatDoc(cmd, value = null) {
        if (this.editor && this.editor.commands && typeof this.editor.commands.toggleBold === 'function') {
            switch(cmd) {
                case 'bold': this.editor.commands.toggleBold(); return;
                case 'italic': this.editor.commands.toggleItalic(); return;
                case 'underline': this.editor.commands.toggleUnderline(); return;
                case 'strikeThrough': this.editor.commands.toggleStrike(); return;
                case 'insertUnorderedList': this.editor.commands.toggleBulletList(); return;
                case 'insertOrderedList': this.editor.commands.toggleOrderedList(); return;
            }
        }
        document.execCommand(cmd, false, value);
    }

    promptLink() {
        const url = prompt('Digite a URL do link:');
        if (url) {
            this.formatDoc('createLink', url);
        }
    }

    // Media Modal & Insertion
    openMediaModal(type = 'image') {
        const modal = document.getElementById('media-modal');
        const titleEl = document.getElementById('media-modal-title');
        const targetEl = document.getElementById('media-type-target');
        const urlInput = document.getElementById('media-url-input');
        const fileInput = document.getElementById('media-file-input');

        if (!modal) return;

        targetEl.value = type;
        urlInput.value = '';
        fileInput.value = '';

        if (type === 'image') {
            titleEl.innerHTML = '<i class="fas fa-image"></i> Inserir Imagem na Página';
            fileInput.accept = 'image/*';
        } else if (type === 'audio') {
            titleEl.innerHTML = '<i class="fas fa-music"></i> Inserir Áudio na Página';
            fileInput.accept = 'audio/*';
        } else if (type === 'video') {
            titleEl.innerHTML = '<i class="fas fa-video"></i> Inserir Vídeo na Página';
            fileInput.accept = 'video/*';
        }

        modal.classList.add('show');
    }

    closeMediaModal() {
        const modal = document.getElementById('media-modal');
        if (modal) modal.classList.remove('show');
    }

    confirmMediaInsertion() {
        const type = document.getElementById('media-type-target').value;
        const fileInput = document.getElementById('media-file-input');
        const urlInput = document.getElementById('media-url-input').value.trim();

        if (fileInput.files && fileInput.files[0]) {
            const file = fileInput.files[0];
            const reader = new FileReader();
            reader.onload = (e) => {
                this.insertMediaHTML(type, e.target.result);
                this.closeMediaModal();
            };
            reader.readAsDataURL(file);
        } else if (urlInput) {
            this.insertMediaHTML(type, urlInput);
            this.closeMediaModal();
        } else {
            this.showToast('Por favor, selecione um arquivo ou digite uma URL de mídia.', 'error');
        }
    }

    insertMediaHTML(type, src) {
        let mediaHtml = '';
        if (type === 'image') {
            mediaHtml = `<p><img src="${src}" alt="Imagem do livro" style="max-width:100%; border-radius:8px; margin: 10px 0;"></p>`;
        } else if (type === 'audio') {
            mediaHtml = `<p><audio controls src="${src}" style="width:100%; margin: 10px 0;"></audio></p>`;
        } else if (type === 'video') {
            if (src.includes('youtube.com') || src.includes('youtu.be')) {
                let embedUrl = src;
                if (src.includes('watch?v=')) {
                    embedUrl = src.replace('watch?v=', 'embed/');
                } else if (src.includes('youtu.be/')) {
                    embedUrl = src.replace('youtu.be/', 'youtube.com/embed/');
                }
                mediaHtml = `<p><iframe src="${embedUrl}" frameborder="0" allowfullscreen style="width:100%; height:320px; border-radius:8px; margin: 10px 0;"></iframe></p>`;
            } else {
                mediaHtml = `<p><video controls src="${src}" style="max-width:100%; border-radius:8px; margin: 10px 0;"></video></p>`;
            }
        }

        if (mediaHtml) {
            this.insertHTMLAtCursor(mediaHtml);
            this.handleEditorUpdate();
        }
    }

    insertHTMLAtCursor(html) {
        const editorEl = document.querySelector('#editor');
        if (editorEl) {
            editorEl.focus();
            document.execCommand('insertHTML', false, html);
        }
    }

    // Cover Modal & Management
    openCoverModal() {
        const modal = document.getElementById('cover-modal');
        if (modal) modal.classList.add('show');
    }

    closeCoverModal() {
        const modal = document.getElementById('cover-modal');
        if (modal) modal.classList.remove('show');
    }

    confirmCoverSelection() {
        const fileInput = document.getElementById('cover-file-input');
        const urlInput = document.getElementById('cover-url-input').value.trim();

        if (fileInput.files && fileInput.files[0]) {
            const file = fileInput.files[0];
            const reader = new FileReader();
            reader.onload = (e) => {
                this.setCoverImage(e.target.result);
                this.closeCoverModal();
            };
            reader.readAsDataURL(file);
        } else if (urlInput) {
            this.setCoverImage(urlInput);
            this.closeCoverModal();
        } else {
            this.showToast('Selecione uma imagem ou insira uma URL para a capa.', 'error');
        }
    }

    setCoverImage(coverDataUrl) {
        if (!this.currentStory) this.createNewStoryObj();
        this.currentStory.coverImage = coverDataUrl;
        this.renderCoverPreview();
        this.saveStory();
        this.showToast('Capa do livro definida com sucesso!', 'success');
    }

    removeCoverImage() {
        if (this.currentStory) {
            this.currentStory.coverImage = null;
            this.renderCoverPreview();
            this.saveStory();
            this.showToast('Capa removida.', 'success');
        }
    }

    renderCoverPreview() {
        const container = document.getElementById('cover-preview-container');
        const imgEl = document.getElementById('cover-badge-img');
        if (!container || !imgEl) return;

        if (this.currentStory && this.currentStory.coverImage) {
            imgEl.src = this.currentStory.coverImage;
            container.style.display = 'flex';
        } else {
            container.style.display = 'none';
        }
    }

    // Multi-page System
    createNewStoryObj() {
        this.currentStory = {
            id: Date.now().toString(),
            title: document.getElementById('story-title')?.value || 'Novo Livro',
            author: localStorage.getItem('fanfic-author') || 'Autor Anônimo',
            coverImage: null,
            pages: [
                { id: 'page-' + Date.now(), title: 'Página 1', content: '<p>Comece a escrever sua primeira página aqui...</p>' }
            ],
            activePageIndex: 0,
            lastSaved: Date.now(),
            created: Date.now()
        };
        this.activePageIndex = 0;
    }

    newStory(confirmFirst = true) {
        if (confirmFirst && !confirm('Deseja criar uma nova história? Certifique-se de ter salvado suas alterações.')) {
            return;
        }

        this.createNewStoryObj();
        if (document.getElementById('story-title')) {
            document.getElementById('story-title').value = this.currentStory.title;
        }

        this.loadActivePageContent();
        this.renderPagesTabs();
        this.renderCoverPreview();
        this.updateStatus('new');
        this.showToast('Nova história/livro criado!', 'success');
    }

    renderPagesTabs() {
        const wrapper = document.getElementById('pages-tabs-wrapper');
        if (!wrapper || !this.currentStory || !this.currentStory.pages) return;

        wrapper.innerHTML = '';
        this.currentStory.pages.forEach((page, index) => {
            const tabBtn = document.createElement('button');
            tabBtn.type = 'button';
            tabBtn.className = `page-tab${index === this.activePageIndex ? ' active' : ''}`;
            tabBtn.innerHTML = `<i class="fas fa-file-alt"></i> ${this.escapeHtml(page.title || ('Página ' + (index + 1)))}`;
            tabBtn.onclick = () => this.switchPage(index);
            wrapper.appendChild(tabBtn);
        });
    }

    switchPage(targetIndex) {
        if (!this.currentStory || !this.currentStory.pages[targetIndex]) return;

        // Save current active page before switching
        this.saveCurrentPageContentToMemory();

        this.activePageIndex = targetIndex;
        this.currentStory.activePageIndex = targetIndex;
        this.loadActivePageContent();
        this.renderPagesTabs();
    }

    saveCurrentPageContentToMemory() {
        if (this.currentStory && this.currentStory.pages && this.currentStory.pages[this.activePageIndex]) {
            const htmlContent = this.getEditorHTML();
            this.currentStory.pages[this.activePageIndex].content = htmlContent;
        }
    }

    loadActivePageContent() {
        if (!this.currentStory || !this.currentStory.pages) return;

        const page = this.currentStory.pages[this.activePageIndex] || this.currentStory.pages[0];
        if (this.editor && typeof this.editor.setContent === 'function') {
            this.editor.setContent(page.content || '<p></p>');
        } else {
            const editorEl = document.querySelector('#editor');
            if (editorEl) editorEl.innerHTML = page.content || '<p></p>';
        }
    }

    addPage() {
        if (!this.currentStory) this.createNewStoryObj();

        this.saveCurrentPageContentToMemory();
        const newPageIndex = this.currentStory.pages.length;
        const newPageNum = newPageIndex + 1;

        const newPage = {
            id: 'page-' + Date.now(),
            title: `Página ${newPageNum}`,
            content: `<p>Escreva o conteúdo da Página ${newPageNum} aqui...</p>`
        };

        this.currentStory.pages.push(newPage);
        this.switchPage(newPageIndex);
        this.saveStory();
        this.showToast(`Página ${newPageNum} adicionada!`, 'success');
    }

    renameCurrentPage() {
        if (!this.currentStory || !this.currentStory.pages[this.activePageIndex]) return;

        const currentPage = this.currentStory.pages[this.activePageIndex];
        const newTitle = prompt('Digite o novo nome para esta página/capítulo:', currentPage.title);

        if (newTitle && newTitle.trim() !== '') {
            currentPage.title = newTitle.trim();
            this.renderPagesTabs();
            this.saveStory();
        }
    }

    movePageLeft() {
        if (!this.currentStory || this.activePageIndex <= 0) return;
        this.saveCurrentPageContentToMemory();

        const pages = this.currentStory.pages;
        const temp = pages[this.activePageIndex];
        pages[this.activePageIndex] = pages[this.activePageIndex - 1];
        pages[this.activePageIndex - 1] = temp;

        this.activePageIndex--;
        this.currentStory.activePageIndex = this.activePageIndex;
        this.renderPagesTabs();
        this.saveStory();
    }

    movePageRight() {
        if (!this.currentStory || this.activePageIndex >= this.currentStory.pages.length - 1) return;
        this.saveCurrentPageContentToMemory();

        const pages = this.currentStory.pages;
        const temp = pages[this.activePageIndex];
        pages[this.activePageIndex] = pages[this.activePageIndex + 1];
        pages[this.activePageIndex + 1] = temp;

        this.activePageIndex++;
        this.currentStory.activePageIndex = this.activePageIndex;
        this.renderPagesTabs();
        this.saveStory();
    }

    deleteCurrentPage() {
        if (!this.currentStory || this.currentStory.pages.length <= 1) {
            this.showToast('O livro precisa ter pelo menos 1 página.', 'error');
            return;
        }

        if (confirm(`Tem certeza que deseja excluir "${this.currentStory.pages[this.activePageIndex].title}"?`)) {
            this.currentStory.pages.splice(this.activePageIndex, 1);
            if (this.activePageIndex >= this.currentStory.pages.length) {
                this.activePageIndex = this.currentStory.pages.length - 1;
            }
            this.loadActivePageContent();
            this.renderPagesTabs();
            this.saveStory();
            this.showToast('Página excluída com sucesso.', 'success');
        }
    }

    getEditorHTML() {
        if (this.editor && typeof this.editor.getHTML === 'function') {
            return this.editor.getHTML();
        }
        const editorEl = document.querySelector('#editor');
        return editorEl ? editorEl.innerHTML : '';
    }

    handleEditorUpdate() {
        this.updateStatus('editing');
        this.saveCurrentPageContentToMemory();
        this.triggerAutoSave();
    }

    triggerAutoSave() {
        clearTimeout(this.autoSaveTimeout);
        this.autoSaveTimeout = setTimeout(() => {
            this.autoSave();
        }, 3000);
    }

    async autoSave() {
        if (this.currentStory) {
            try {
                await this.saveStoryData(this.currentStory, false);
                this.updateStatus('saved');
            } catch (error) {
                console.error('Auto-save error:', error);
                this.updateStatus('error', 'Falha ao salvar');
            }
        }
    }

    async saveStory() {
        if (!this.currentStory) this.createNewStoryObj();

        const titleInput = document.getElementById('story-title');
        if (titleInput) {
            this.currentStory.title = titleInput.value.trim() || 'História sem título';
        }

        this.saveCurrentPageContentToMemory();
        this.currentStory.lastSaved = Date.now();

        try {
            await this.saveStoryData(this.currentStory, true);
            this.updateStatus('saved');
            this.showToast('História salva com sucesso!', 'success');
        } catch (error) {
            console.error('Save failed:', error);
            this.updateStatus('error', 'Erro ao salvar');
            this.showToast('Erro ao salvar no armazenamento local.', 'error');
        }
    }

    async saveStoryData(story, refreshGrid = true) {
        await localforage.setItem(`fanfic-story-${story.id}`, story);
        if (refreshGrid) {
            await this.loadStories();
        }
    }

    async loadStories() {
        try {
            const keys = (await localforage.keys()).filter(key => key.startsWith('fanfic-story-'));
            this.stories = await Promise.all(keys.map(key => localforage.getItem(key)));
            
            // Normalize old story models without pages array
            this.stories.forEach(story => {
                if (story && !story.pages) {
                    story.pages = [
                        { id: 'p-1', title: 'Página 1', content: story.content || '<p></p>' }
                    ];
                }
            });

            this.renderStoriesList();
        } catch (error) {
            console.error('Failed to load stories:', error);
        }
    }

    renderStoriesList() {
        const grid = document.getElementById('stories-grid');
        if (!grid) return;

        grid.innerHTML = '';

        if (!this.stories || this.stories.length === 0) {
            grid.innerHTML = `
                <div class="no-stories" style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: white; border-radius: 15px;">
                    <i class="fas fa-book-open" style="font-size: 3rem; color: #a0aec0; margin-bottom: 1rem;"></i>
                    <p style="font-size: 1.2rem; color: #718096;">Nenhuma história salva ainda. Clique em "Nova História" para começar!</p>
                </div>
            `;
            return;
        }

        this.stories.forEach(story => {
            const card = document.createElement('div');
            card.className = `story-card${this.currentStory?.id === story.id ? ' selected' : ''}`;

            const pagesCount = story.pages ? story.pages.length : 1;
            const coverHtml = story.coverImage 
                ? `<img src="${story.coverImage}" class="story-card-cover" alt="Capa">`
                : `<div class="story-card-cover-placeholder"><i class="fas fa-book"></i></div>`;

            card.innerHTML = `
                ${coverHtml}
                <h4><i class="fas fa-book-open"></i> ${this.escapeHtml(story.title)}</h4>
                <div class="story-meta">
                    <span><i class="fas fa-file-alt"></i> ${pagesCount} página(s)</span>
                    <span><i class="fas fa-clock"></i> ${new Date(story.lastSaved || story.created || Date.now()).toLocaleDateString()}</span>
                </div>
                <div class="story-actions">
                    <button class="action-btn" onclick="app.openStoryFromList('${story.id}')" title="Abrir">
                        <i class="fas fa-folder-open"></i> Abrir
                    </button>
                    <button class="action-btn" onclick="app.exportPDFForStory('${story.id}')" title="PDF">
                        <i class="fas fa-file-pdf"></i> PDF
                    </button>
                    <button class="action-btn" onclick="app.exportEPUBForStory('${story.id}')" title="EPUB">
                        <i class="fas fa-book"></i> EPUB
                    </button>
                    <button class="action-btn delete-btn" onclick="app.deleteStory('${story.id}')" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;

            grid.appendChild(card);
        });
    }

    async openStoryFromList(id) {
        if (!document.querySelector('#editor')) {
            sessionStorage.setItem('open-story-id', id);
            window.location.href = 'index.html';
            return;
        }
        await this.loadStory(id);
    }

    async loadStory(id) {
        try {
            const story = await localforage.getItem(`fanfic-story-${id}`);
            if (story) {
                // Ensure page structure
                if (!story.pages) {
                    story.pages = [
                        { id: 'p-1', title: 'Página 1', content: story.content || '<p></p>' }
                    ];
                }
                this.currentStory = story;
                this.activePageIndex = story.activePageIndex || 0;
                
                if (document.getElementById('story-title')) {
                    document.getElementById('story-title').value = story.title;
                }

                this.loadActivePageContent();
                this.renderPagesTabs();
                this.renderCoverPreview();
                this.closeStoryModal();
                this.updateStatus('loaded');
                this.showToast('História carregada!', 'success');
            }
        } catch (error) {
            console.error('Failed to load story:', error);
            this.showToast('Erro ao carregar a história.', 'error');
        }
    }

    async deleteStory(id) {
        if (confirm('Tem certeza que deseja excluir esta história? Esta ação não pode ser desfeita.')) {
            try {
                await localforage.removeItem(`fanfic-story-${id}`);
                if (this.currentStory?.id === id) {
                    this.newStory(false);
                }
                await this.loadStories();
                this.showToast('História excluída com sucesso.', 'success');
            } catch (error) {
                console.error('Failed to delete story:', error);
                this.showToast('Erro ao excluir história.', 'error');
            }
        }
    }

    // PDF Export
    async exportPDF() {
        if (!this.currentStory) return;
        await this.exportPDFForStory(this.currentStory.id);
    }

    async exportPDFForStory(storyId) {
        try {
            const story = (this.currentStory && this.currentStory.id === storyId)
                ? this.currentStory 
                : await localforage.getItem(`fanfic-story-${storyId}`);

            if (!story) return;

            this.updateStatus('exporting');
            this.showToast('Gerando arquivo PDF...', 'success');

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const title = story.title || 'Meu Livro';
            const author = story.author || 'Autor Anônimo';
            const pages = story.pages || [{ title: 'Página 1', content: story.content || '' }];

            let startY = 20;

            // Optional Cover Page
            if (story.coverImage) {
                try {
                    doc.addImage(story.coverImage, 'JPEG', 25, 25, 160, 210);
                    doc.addPage();
                } catch (e) {
                    console.warn('Cover image render in PDF skipped:', e);
                }
            }

            // Title Header Page
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(24);
            doc.text(title, 105, 50, { align: 'center' });

            doc.setFontSize(14);
            doc.setFont('helvetica', 'normal');
            doc.text(`Por: ${author}`, 105, 65, { align: 'center' });
            doc.text(`Data: ${new Date().toLocaleDateString()}`, 105, 75, { align: 'center' });

            doc.setLineWidth(0.5);
            doc.line(30, 85, 180, 85);

            // Add Table of Contents if multi-pages
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Sumário:', 20, 100);
            doc.setFont('helvetica', 'normal');
            
            let tocY = 110;
            pages.forEach((p, idx) => {
                doc.text(`${idx + 1}. ${p.title}`, 25, tocY);
                tocY += 8;
            });

            // Content Pages
            pages.forEach((page, idx) => {
                doc.addPage();

                // Page Title Header
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(16);
                doc.text(page.title || `Página ${idx + 1}`, 20, 20);

                doc.setLineWidth(0.2);
                doc.line(20, 23, 190, 23);

                // Convert HTML content to plain text lines
                const textContent = this.htmlToText(page.content);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(11);

                const lines = doc.splitTextToSize(textContent, 170);
                let lineY = 32;

                lines.forEach(line => {
                    if (lineY > 270) {
                        doc.addPage();
                        lineY = 20;
                    }
                    doc.text(line, 20, lineY);
                    lineY += 6;
                });
            });

            // Page numbers
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(9);
                doc.setTextColor(100);
                doc.text(`Página ${i} de ${pageCount}`, 105, 290, { align: 'center' });
            }

            const fileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'livro'}.pdf`;
            doc.save(fileName);

            this.updateStatus('saved');
            this.showToast('PDF baixado com sucesso!', 'success');
        } catch (error) {
            console.error('PDF export failed:', error);
            this.showToast('Erro ao exportar PDF.', 'error');
            this.updateStatus('error', 'Erro no PDF');
        }
    }

    // EPUB Export (Client-side EPUB 3 zip generator via JSZip)
    async exportEPUB() {
        if (!this.currentStory) return;
        await this.exportEPUBForStory(this.currentStory.id);
    }

    async exportEPUBForStory(storyId) {
        try {
            if (!window.JSZip) {
                this.showToast('Biblioteca JSZip não carregada.', 'error');
                return;
            }

            const story = (this.currentStory && this.currentStory.id === storyId)
                ? this.currentStory 
                : await localforage.getItem(`fanfic-story-${storyId}`);

            if (!story) return;

            this.updateStatus('exporting');
            this.showToast('Gerando e-book EPUB...', 'success');

            const zip = new window.JSZip();
            const title = story.title || 'Meu Livro';
            const author = story.author || 'Autor Anônimo';
            const pages = story.pages || [{ title: 'Página 1', content: story.content || '' }];

            // 1. mimetype file (uncompressed)
            zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

            // 2. META-INF/container.xml
            zip.folder('META-INF').file('container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);

            const oebps = zip.folder('OEBPS');

            // CSS styling for e-readers
            const cssContent = `
body { font-family: sans-serif; line-height: 1.6; padding: 5%; color: #333; }
h1, h2, h3 { color: #2c3e50; }
img { max-width: 100%; height: auto; }
audio, video { width: 100%; margin: 10px 0; }
`;
            oebps.file('style.css', cssContent);

            // Generate XHTML pages
            let manifestItems = `<item id="style" href="style.css" media-type="text/css"/>\n`;
            let spineItems = '';
            let tocNcxNav = '';

            pages.forEach((page, index) => {
                const pageNum = index + 1;
                const pageId = `page_${pageNum}`;
                const pageFileName = `${pageId}.xhtml`;

                const pageXHTML = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="pt-BR">
<head>
  <title>${this.escapeHtml(page.title || 'Página ' + pageNum)}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <h2>${this.escapeHtml(page.title || 'Página ' + pageNum)}</h2>
  <div>${this.cleanHtmlForEPUB(page.content)}</div>
</body>
</html>`;

                oebps.file(pageFileName, pageXHTML);

                manifestItems += `<item id="${pageId}" href="${pageFileName}" media-type="application/xhtml+xml"/>\n`;
                spineItems += `<itemref idref="${pageId}"/>\n`;
                tocNcxNav += `<navPoint id="nav-${pageNum}" playOrder="${pageNum}">
  <navLabel><text>${this.escapeHtml(page.title || 'Página ' + pageNum)}</text></navLabel>
  <content src="${pageFileName}"/>
</navPoint>\n`;
            });

            // Table of Contents (toc.xhtml)
            const tocXHTML = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="pt-BR">
<head>
  <title>Sumário</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <h1>${this.escapeHtml(title)}</h1>
  <p><em>Por ${this.escapeHtml(author)}</em></p>
  <nav epub:type="toc" id="toc">
    <h2>Sumário</h2>
    <ol>
      ${pages.map((p, i) => `<li><a href="page_${i+1}.xhtml">${this.escapeHtml(p.title || 'Página ' + (i+1))}</a></li>`).join('\n')}
    </ol>
  </nav>
</body>
</html>`;

            oebps.file('toc.xhtml', tocXHTML);
            manifestItems += `<item id="toc" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav"/>\n`;

            // content.opf
            const opfContent = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">urn:uuid:${story.id}</dc:identifier>
    <dc:title>${this.escapeHtml(title)}</dc:title>
    <dc:creator>${this.escapeHtml(author)}</dc:creator>
    <dc:language>pt-BR</dc:language>
  </metadata>
  <manifest>
    ${manifestItems}
  </manifest>
  <spine>
    <itemref idref="toc"/>
    ${spineItems}
  </spine>
</package>`;

            oebps.file('content.opf', opfContent);

            // Generate ZIP blob and trigger download
            const zipBlob = await zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
            const fileName = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'livro'}.epub`;
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(zipBlob);
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            this.updateStatus('saved');
            this.showToast('EPUB exportado com sucesso!', 'success');
        } catch (error) {
            console.error('EPUB export failed:', error);
            this.showToast('Erro ao gerar EPUB.', 'error');
            this.updateStatus('error', 'Erro no EPUB');
        }
    }

    cleanHtmlForEPUB(html) {
        if (!html) return '';
        // Self-closing tags fix for valid XHTML
        return html
            .replace(/<img([^>]+)>/gi, '<img$1 />')
            .replace(/<br([^>]* activity)>/gi, '<br />')
            .replace(/<hr([^>]*)>/gi, '<hr />');
    }

    // Modal & Toast Helpers
    openStoryModal() {
        const modal = document.getElementById('story-list-modal');
        if (modal) modal.classList.add('show');
    }

    closeStoryModal() {
        const modal = document.getElementById('story-list-modal');
        if (modal) modal.classList.remove('show');
    }

    updateStatus(type, message = '') {
        const indicator = document.getElementById('status-indicator');
        if (!indicator) return;

        const statusText = indicator.querySelector('.status-text');
        const dot = indicator.querySelector('.status-dot');

        switch (type) {
            case 'saved':
                if (dot) dot.className = 'status-dot';
                if (statusText) statusText.textContent = 'Salvo';
                break;
            case 'editing':
                if (dot) dot.className = 'status-dot saving';
                if (statusText) statusText.textContent = 'Salvando...';
                break;
            case 'new':
                if (dot) dot.className = 'status-dot';
                if (statusText) statusText.textContent = 'Novo livro';
                break;
            case 'error':
                if (dot) dot.className = 'status-dot error';
                if (statusText) statusText.textContent = message || 'Erro';
                break;
            case 'exporting':
                if (dot) dot.className = 'status-dot saving';
                if (statusText) statusText.textContent = 'Exportando...';
                break;
            case 'loaded':
                if (dot) dot.className = 'status-dot';
                if (statusText) statusText.textContent = 'Carregado';
                break;
        }
    }

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="${type === 'success' ? 'fas fa-check-circle' : 'fas fa-exclamation-circle'}"></i> ${message}`;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('hide');
            setTimeout(() => {
                if (toast.parentNode) document.body.removeChild(toast);
            }, 300);
        }, 3000);
    }

    setupEventListeners() {
        const titleInput = document.getElementById('story-title');
        if (titleInput) {
            titleInput.addEventListener('input', (e) => {
                if (this.currentStory) {
                    this.currentStory.title = e.target.value;
                    this.triggerAutoSave();
                }
            });
        }

        const searchInput = document.getElementById('search-stories');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                const filtered = this.stories.filter(s => s.title.toLowerCase().includes(term));
                this.renderFilteredStories(filtered);
            });
        }
    }

    renderFilteredStories(filtered) {
        const grid = document.getElementById('stories-grid');
        if (!grid) return;
        grid.innerHTML = '';

        if (filtered.length === 0) {
            grid.innerHTML = '<div class="no-stories"><p>Nenhuma história encontrada.</p></div>';
            return;
        }

        filtered.forEach(story => {
            const card = document.createElement('div');
            card.className = `story-card${this.currentStory?.id === story.id ? ' selected' : ''}`;
            const pagesCount = story.pages ? story.pages.length : 1;
            const coverHtml = story.coverImage 
                ? `<img src="${story.coverImage}" class="story-card-cover" alt="Capa">`
                : `<div class="story-card-cover-placeholder"><i class="fas fa-book"></i></div>`;

            card.innerHTML = `
                ${coverHtml}
                <h4><i class="fas fa-book-open"></i> ${this.escapeHtml(story.title)}</h4>
                <div class="story-meta">
                    <span><i class="fas fa-file-alt"></i> ${pagesCount} página(s)</span>
                    <span><i class="fas fa-clock"></i> ${new Date(story.lastSaved || Date.now()).toLocaleDateString()}</span>
                </div>
                <div class="story-actions">
                    <button class="action-btn" onclick="app.openStoryFromList('${story.id}')"><i class="fas fa-folder-open"></i> Abrir</button>
                    <button class="action-btn" onclick="app.exportPDFForStory('${story.id}')"><i class="fas fa-file-pdf"></i> PDF</button>
                    <button class="action-btn" onclick="app.exportEPUBForStory('${story.id}')"><i class="fas fa-book"></i> EPUB</button>
                    <button class="action-btn delete-btn" onclick="app.deleteStory('${story.id}')"><i class="fas fa-trash"></i></button>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    checkLoginStatus() {
        const savedAuthor = localStorage.getItem('fanfic-author');
        if (savedAuthor && this.currentStory) {
            this.currentStory.author = savedAuthor;
        }
    }

    htmlToText(html) {
        const div = document.createElement('div');
        div.innerHTML = html || '';
        return div.textContent || div.innerText || '';
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Global initialization
document.addEventListener('DOMContentLoaded', () => {
    window.app = new FanficApp();
});

// Global Function Exports for Inline HTML Handlers
window.newStory = () => window.app?.newStory();
window.saveStory = () => window.app?.saveStory();
window.exportPDF = () => window.app?.exportPDF();
window.exportEPUB = () => window.app?.exportEPUB();
window.openStoryModal = () => window.app?.openStoryModal();
window.closeStoryModal = () => window.app?.closeStoryModal();

window.addPage = () => window.app?.addPage();
window.renameCurrentPage = () => window.app?.renameCurrentPage();
window.movePageLeft = () => window.app?.movePageLeft();
window.movePageRight = () => window.app?.movePageRight();
window.deleteCurrentPage = () => window.app?.deleteCurrentPage();

window.openCoverModal = () => window.app?.openCoverModal();
window.closeCoverModal = () => window.app?.closeCoverModal();
window.confirmCoverSelection = () => window.app?.confirmCoverSelection();
window.removeCoverImage = () => window.app?.removeCoverImage();

window.openMediaModal = (type) => window.app?.openMediaModal(type);
window.closeMediaModal = () => window.app?.closeMediaModal();
window.confirmMediaInsertion = () => window.app?.confirmMediaInsertion();