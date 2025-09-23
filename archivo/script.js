// Configuración de la aplicación
const CONFIG = {
    API_URL: 'https://proyectos.aldeapucela.org/exports/guardados/data.json',
    MESSAGES_PER_PAGE: 20,
    MAX_CONTENT_LENGTH: 400,
    SEARCH_DEBOUNCE: 300
};

// Estado global de la aplicación
const AppState = {
    allMessages: [],
    filteredMessages: [],
    currentPage: 1,
    totalPages: 1,
    searchTerm: '',
    filters: {
        author: '',
        topic: '',
        sort: 'saves-desc',
        time: 'all'
    },
    isLoading: false,
    activePanels: new Set()
};

// Elementos del DOM
const DOM = {
    loading: document.getElementById('loading'),
    error: document.getElementById('error'),
    controls: document.getElementById('controls'),
    messagesContainer: document.getElementById('messages-container'),
    pagination: document.getElementById('pagination'),
    
    // Estadísticas
    totalMessages: document.getElementById('total-messages'),
    totalSaves: document.getElementById('total-saves'),
    showingCount: document.getElementById('showing-count'),
    
    // Controles nuevos
    searchToggle: document.getElementById('search-toggle'),
    filterToggle: document.getElementById('filter-toggle'),
    timeToggle: document.getElementById('time-toggle'),
    sortToggle: document.getElementById('sort-toggle'),
    resetAll: document.getElementById('reset-all'),
    
    // Paneles
    searchPanel: document.getElementById('search-panel'),
    filtersPanel: document.getElementById('filters-panel'),
    timePanel: document.getElementById('time-panel'),
    sortPanel: document.getElementById('sort-panel'),
    
    // Controles dentro de paneles
    searchInput: document.getElementById('search-input'),
    clearSearch: document.getElementById('clear-search'),
    authorFilter: document.getElementById('author-filter'),
    topicFilter: document.getElementById('topic-filter'),
    
    // Paginación
    prevPage: document.getElementById('prev-page'),
    nextPage: document.getElementById('next-page'),
    currentPageSpan: document.getElementById('current-page'),
    totalPagesSpan: document.getElementById('total-pages')
};

// Utilidades
const Utils = {
    // Cache para normalización de temas
    normalizationCache: new Map(),
    
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'short', 
            year: 'numeric'
        });
    },
    
    truncateText(text, maxLength = CONFIG.MAX_CONTENT_LENGTH) {
        if (text.length <= maxLength) return { text, truncated: false };
        return {
            text: text.substring(0, maxLength) + '...',
            truncated: true,
            original: text
        };
    },
    
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    // Normalizar tema para comparación (sin acentos, minúsculas)
    normalizeTopicForComparison(topic) {
        // Usar cache para evitar recalcular
        if (this.normalizationCache.has(topic)) {
            return this.normalizationCache.get(topic);
        }
        
        const normalized = topic
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
            .trim();
            
        this.normalizationCache.set(topic, normalized);
        return normalized;
    },
    
    // Elegir la versión "canónica" de un tema (la más común o la primera)
    chooseCanonicalTopic(topicVariations) {
        // Contar frecuencias de cada variación exacta
        const frequencies = {};
        topicVariations.forEach(variation => {
            frequencies[variation] = (frequencies[variation] || 0) + 1;
        });
        
        // Devolver la más frecuente, o la primera si hay empate
        return Object.entries(frequencies)
            .sort((a, b) => b[1] - a[1])
            .map(entry => entry[0])[0];
    },
    
    extractTopics(topicString) {
        if (!topicString) return [];
        return topicString.split(/\s+/).map(topic => topic.trim()).filter(Boolean);
    },
    
    // Nueva función para combinar y unificar temas de múltiples guardados
    combineAndUnifyTopics(savedByArray) {
        const topicMap = new Map(); // clave normalizada -> { canonical: string, users: [user, topic_original][] }
        
        savedByArray.forEach(save => {
            const topics = this.extractTopics(save.topics || '');
            topics.forEach(originalTopic => {
                const normalized = this.normalizeTopicForComparison(originalTopic);
                
                if (!topicMap.has(normalized)) {
                    topicMap.set(normalized, {
                        canonical: originalTopic,
                        users: [],
                        variations: []
                    });
                }
                
                const topicEntry = topicMap.get(normalized);
                topicEntry.users.push({ user: save.user, originalTopic });
                topicEntry.variations.push(originalTopic);
            });
        });
        
        // Elegir versión canónica para cada tema y crear resultado final
        const unifiedTopics = [];
        for (const [normalized, data] of topicMap) {
            const canonical = this.chooseCanonicalTopic(data.variations);
            unifiedTopics.push({
                topic: canonical,
                normalized: normalized,
                count: data.users.length,
                users: data.users
            });
        }
        
        // Ordenar por frecuencia (más usados primero)
        return unifiedTopics.sort((a, b) => b.count - a.count);
    },
    
    generateAvatarColor(name) {
        // Generar color basado en el nombre - paleta diversa pero cohesiva
        const colors = [
            // Morados principales de Aldea Pucela
            '#8B5CF6', '#A855F7', '#7C3AED', '#9333EA',
            // Azules complementarios
            '#6366F1', '#3B82F6', '#1D4ED8',
            // Verdes armoniosos 
            '#10B981', '#059669', '#22C55E',
            // Rosas/fucsias
            '#EC4899', '#D946EF', '#F472B6',
            // Naranjas cálidos
            '#F59E0B', '#EA580C', '#FB923C',
            // Rojos elegantes
            '#DC2626', '#B91C1C', '#EF4444'
        ];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    },
    
    getInitials(name) {
        return name.split(' ').map(word => word.charAt(0).toUpperCase()).slice(0, 2).join('');
    },
    
    processLinks(text) {
        // Convertir URLs en enlaces clicables
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return text.replace(urlRegex, '<a href="$1" target="_blank" class="message-link">$1</a>');
    }
};

// Procesamiento de datos
const DataProcessor = {
    processMessages(rawMessages) {
        const messageMap = new Map();
        
        // Filter out messages with null or empty content
        const validMessages = rawMessages.filter(item => 
            item.Content && item.Content.trim() !== ''
        );
        
        validMessages.forEach(item => {
            const messageId = item['Message ID'];
            
            if (messageMap.has(messageId)) {
                const existing = messageMap.get(messageId);
                existing.saveCount++;
                existing.savedBy.push({
                    user: item.User,
                    userId: item['User ID'],
                    createdAt: item.CreatedAt,
                    topics: item.Topic || '' // Almacenar temas de este guardado específico
                });
            } else {
                messageMap.set(messageId, {
                    messageId: messageId,
                    authorId: item['Author ID'],
                    authorName: item['Author name'],
                    content: item.Content,
                    created: item.Created,
                    telegramLink: item['Telegram link'],
                    saveCount: 1,
                    savedBy: [{
                        user: item.User,
                        userId: item['User ID'],
                        createdAt: item.CreatedAt,
                        topics: item.Topic || '' // Almacenar temas de este guardado específico
                    }],
                    createdTimestamp: new Date(item.Created).getTime()
                });
            }
        });
        
        // Procesar temas unificados para cada mensaje
        const processedMessages = Array.from(messageMap.values());
        processedMessages.forEach(message => {
            const unifiedTopics = Utils.combineAndUnifyTopics(message.savedBy);
            message.unifiedTopics = unifiedTopics;
            
            // PRE-COMPUTAR normalizaciones para evitar hacerlo repetidamente en filtros
            message.unifiedTopics.forEach(topicData => {
                topicData.normalized = Utils.normalizeTopicForComparison(topicData.topic);
            });
            
            message.topicArray = unifiedTopics.map(t => t.topic); // Para compatibilidad con filtros
            message.topic = unifiedTopics.map(t => t.topic).join(' '); // Para compatibilidad con búsqueda
        });
        
        return processedMessages;
    },
    
    extractUniqueAuthors(messages) {
        const authors = new Set();
        messages.forEach(msg => authors.add(msg.authorName));
        return Array.from(authors).sort();
    },
    
    extractUniqueTopics(messages) {
        const topicMap = new Map(); // normalizado -> canónico
        
        messages.forEach(msg => {
            if (msg.unifiedTopics) {
                msg.unifiedTopics.forEach(topicData => {
                    const normalized = Utils.normalizeTopicForComparison(topicData.topic);
                    if (!topicMap.has(normalized)) {
                        topicMap.set(normalized, topicData.topic);
                    }
                });
            }
        });
        
        return Array.from(topicMap.values()).sort();
    }
};

// Sistema de filtrado y ordenación
const FilterSystem = {
    applyFilters(messages, searchTerm, filters) {
        let filtered = [...messages];
        
        // Filtro de búsqueda por texto
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            filtered = filtered.filter(msg => 
                msg.content.toLowerCase().includes(searchLower) ||
                msg.authorName.toLowerCase().includes(searchLower) ||
                msg.topic.toLowerCase().includes(searchLower)
            );
        }
        
        // Filtro por tiempo
        if (filters.time !== 'all') {
            filtered = this.filterByTime(filtered, filters.time);
        }
        
        // Filtro por autor
        if (filters.author) {
            filtered = filtered.filter(msg => msg.authorName === filters.author);
        }
        
        // Filtro por tema
        if (filters.topic) {
            const normalizedFilter = Utils.normalizeTopicForComparison(filters.topic);
            filtered = filtered.filter(msg => {
                if (msg.unifiedTopics) {
                    // Usar las normalizaciones pre-computadas
                    return msg.unifiedTopics.some(topicData => 
                        topicData.normalized === normalizedFilter
                    );
                }
                return false;
            });
        }
        
        // Ordenación
        this.sortMessages(filtered, filters.sort);
        
        return filtered;
    },
    
    filterByTime(messages, timeFilter) {
        const now = new Date();
        let cutoffDate;
        
        switch (timeFilter) {
            case 'week':
                cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            default:
                return messages;
        }
        
        return messages.filter(msg => 
            new Date(msg.created) >= cutoffDate
        );
    },
    
    sortMessages(messages, sortType) {
        switch (sortType) {
            case 'saves-desc':
                messages.sort((a, b) => b.saveCount - a.saveCount);
                break;
            case 'saves-asc':
                messages.sort((a, b) => a.saveCount - b.saveCount);
                break;
            case 'date-desc':
                messages.sort((a, b) => b.createdTimestamp - a.createdTimestamp);
                break;
            case 'date-asc':
                messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
                break;
        }
    }
};

// Sistema de paginación
const PaginationSystem = {
    calculatePagination(totalItems, currentPage, itemsPerPage) {
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
        
        return {
            totalPages,
            startIndex,
            endIndex,
            hasNext: currentPage < totalPages,
            hasPrev: currentPage > 1
        };
    },
    
    updatePaginationUI(pagination) {
        DOM.currentPageSpan.textContent = AppState.currentPage;
        DOM.totalPagesSpan.textContent = pagination.totalPages;
        
        DOM.prevPage.disabled = !pagination.hasPrev;
        DOM.nextPage.disabled = !pagination.hasNext;
        
        DOM.pagination.style.display = pagination.totalPages > 1 ? 'flex' : 'none';
    }
};

// Sistema de renderizado
const RenderSystem = {
    createMessageHTML(message) {
        const isMultipleSaves = message.saveCount > 1;
        const contentData = Utils.truncateText(message.content);
        const avatarColor = Utils.generateAvatarColor(message.authorName);
        const initials = Utils.getInitials(message.authorName);
        const processedContent = Utils.processLinks(contentData.text);
        
        return `
            <div class="message telegram-style" data-message-id="${message.messageId}">
                <div class="message-avatar" style="background-color: ${avatarColor}">
                    ${initials}
                </div>
                
                <div class="message-content-wrapper">
                    <div class="message-header">
                        <span class="message-author">${message.authorName}</span>
                        <div class="save-counter ${isMultipleSaves ? 'multiple' : 'single'}">
                            <i class="fas fa-bookmark"></i>
                            <span>${message.saveCount}</span>
                        </div>
                    </div>
                    
                    <div class="message-content">
                        ${processedContent.replace(/\n/g, '<br>')}
                    </div>
                    
                    <div class="message-footer">
                        <div class="message-date-row">
                            <span class="message-date">${Utils.formatDate(message.created)}</span>
                        </div>
                        <div class="message-bottom">
                            <div class="tags-container">
                                ${message.unifiedTopics && message.unifiedTopics.length > 0 ? 
                                    message.unifiedTopics.map(topicData => {
                                        return `<button class="topic-tag" data-topic="${topicData.topic}" title="Usado por ${topicData.count} persona${topicData.count > 1 ? 's' : ''}">
                                            #${topicData.topic}
                                        </button>`;
                                    }).join('') : ''}
                            </div>
                            <a href="${message.telegramLink}" target="_blank" class="telegram-link">
                                <i class="fas fa-external-link-alt"></i>
                            </a>
                        </div>
                    </div>
                    
                    ${isMultipleSaves ? `
                        <div class="saved-by-details" style="display: none;">
                            <div class="saved-by-header">
                                <i class="fas fa-users"></i> Guardado por ${message.saveCount} persona${message.saveCount > 1 ? 's' : ''}
                            </div>
                            <div class="saves-grid">
                                ${message.savedBy.map(save => {
                                    const userTopics = save.topics ? Utils.extractTopics(save.topics) : [];
                                    const topicsHtml = userTopics.length > 0 
                                        ? userTopics.map(t => `<span class="user-topic">#${t}</span>`).join(' ')
                                        : '<span class="no-topics">sin temas</span>';
                                    return `
                                        <div class="save-card">
                                            <div class="save-user">
                                                <strong class="user-name">${save.user}</strong>
                                                <span class="save-date">${Utils.formatDate(save.createdAt)}</span>
                                            </div>
                                            <div class="user-topics">
                                                ${topicsHtml}
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }
};

// Funciones principales de la aplicación
const App = {
    async init() {
        try {
            await this.loadData();
            this.setupEventListeners();
            this.populateFilters();
            this.applyFiltersAndRender();
        } catch (error) {
            this.showError();
        }
    },
    
    async loadData() {
        this.showLoading();
        
        const response = await fetch(CONFIG.API_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const rawMessages = await response.json();
        
        // Limpiar cache de normalización si crece demasiado (más de 1000 entradas)
        if (Utils.normalizationCache.size > 1000) {
            Utils.normalizationCache.clear();
        }
        
        AppState.allMessages = DataProcessor.processMessages(rawMessages);
        
        this.hideLoading();
    },
    
    populateFilters() {
        // Poblar filtro de autores
        const authors = DataProcessor.extractUniqueAuthors(AppState.allMessages);
        DOM.authorFilter.innerHTML = '<option value="">Todos los autores</option>';
        authors.forEach(author => {
            DOM.authorFilter.innerHTML += `<option value="${author}">${author}</option>`;
        });
        
        // Poblar filtro de temas
        const topics = DataProcessor.extractUniqueTopics(AppState.allMessages);
        DOM.topicFilter.innerHTML = '<option value="">Todos los temas</option>';
        topics.forEach(topic => {
            DOM.topicFilter.innerHTML += `<option value="${topic}">${topic}</option>`;
        });
    },
    
    applyFiltersAndRender() {
        // Aplicar filtros
        AppState.filteredMessages = FilterSystem.applyFilters(
            AppState.allMessages,
            AppState.searchTerm,
            AppState.filters
        );
        
        // Resetear página si es necesario
        const newTotalPages = Math.ceil(AppState.filteredMessages.length / CONFIG.MESSAGES_PER_PAGE);
        if (AppState.currentPage > newTotalPages && newTotalPages > 0) {
            AppState.currentPage = 1;
        }
        
        // Calcular paginación
        const pagination = PaginationSystem.calculatePagination(
            AppState.filteredMessages.length,
            AppState.currentPage,
            CONFIG.MESSAGES_PER_PAGE
        );
        
        // Obtener mensajes para la página actual
        const pageMessages = AppState.filteredMessages.slice(
            pagination.startIndex,
            pagination.endIndex
        );
        
        // Renderizar
        this.renderMessages(pageMessages);
        this.updateStatistics();
        PaginationSystem.updatePaginationUI(pagination);
        
        // Mostrar controles si hay datos
        if (AppState.allMessages.length > 0) {
            DOM.controls.style.display = 'block';
            DOM.messagesContainer.style.display = 'block';
        }
    },
    
    renderMessages(messages) {
        if (messages.length === 0) {
            DOM.messagesContainer.innerHTML = '<p class="no-messages">No se encontraron mensajes.</p>';
            return;
        }
        
        // Limpiar contenedor - esto elimina automáticamente todos los event listeners anteriores
        DOM.messagesContainer.innerHTML = '';
        
        // Usar DocumentFragment para mejor rendimiento con muchos mensajes
        const fragment = document.createDocumentFragment();
        
        messages.forEach(message => {
            const messageElement = document.createElement('div');
            messageElement.innerHTML = RenderSystem.createMessageHTML(message);
            fragment.appendChild(messageElement.firstElementChild);
        });
        
        // Añadir todos los mensajes de una vez
        DOM.messagesContainer.appendChild(fragment);
    },
    
    updateStatistics() {
        const totalSaves = AppState.allMessages.reduce((sum, msg) => sum + msg.saveCount, 0);
        
        DOM.totalMessages.textContent = AppState.allMessages.length;
        DOM.totalSaves.textContent = totalSaves;
        DOM.showingCount.textContent = AppState.filteredMessages.length;
    },
    
    setupEventListeners() {
        // Delegación de eventos para el contenedor de mensajes (más eficiente)
        DOM.messagesContainer.addEventListener('click', (e) => {
            // Manejar clicks en contadores múltiples
            const counter = e.target.closest('.save-counter.multiple');
            if (counter) {
                const message = counter.closest('.message');
                const details = message.querySelector('.saved-by-details');
                if (details) {
                    details.style.display = details.style.display === 'none' ? 'block' : 'none';
                }
                return;
            }
            
            // Manejar clicks en tags de temas
            const tag = e.target.closest('.topic-tag');
            if (tag) {
                const topic = tag.dataset.topic;
                this.filterByTopic(topic);
                return;
            }
        });
        
        // Toggles de paneles
        DOM.searchToggle.addEventListener('click', () => this.togglePanel('search'));
        DOM.filterToggle.addEventListener('click', () => this.togglePanel('filters'));
        DOM.timeToggle.addEventListener('click', () => this.togglePanel('time'));
        DOM.sortToggle.addEventListener('click', () => this.togglePanel('sort'));
        
        // Búsqueda con debounce
        const debouncedSearch = Utils.debounce(() => {
            AppState.searchTerm = DOM.searchInput.value.trim();
            AppState.currentPage = 1;
            this.updateClearSearchButton();
            this.applyFiltersAndRender();
        }, CONFIG.SEARCH_DEBOUNCE);
        
        DOM.searchInput.addEventListener('input', debouncedSearch);
        
        // Botón limpiar búsqueda
        DOM.clearSearch.addEventListener('click', () => {
            DOM.searchInput.value = '';
            AppState.searchTerm = '';
            AppState.currentPage = 1;
            this.updateClearSearchButton();
            this.applyFiltersAndRender();
        });
        
        // Filtros
        [DOM.authorFilter, DOM.topicFilter].forEach(filter => {
            filter.addEventListener('change', () => {
                AppState.filters.author = DOM.authorFilter.value;
                AppState.filters.topic = DOM.topicFilter.value;
                AppState.currentPage = 1;
                this.applyFiltersAndRender();
            });
        });
        
        // Filtros de tiempo
        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                AppState.filters.time = e.target.dataset.time;
                AppState.currentPage = 1;
                this.applyFiltersAndRender();
            });
        });
        
        // Botones de ordenación
        document.querySelectorAll('.sort-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
                e.target.closest('.sort-btn').classList.add('active');
                AppState.filters.sort = e.target.closest('.sort-btn').dataset.sort;
                AppState.currentPage = 1;
                this.applyFiltersAndRender();
            });
        });
        
        // Reset all
        DOM.resetAll.addEventListener('click', () => {
            this.resetAllFilters();
        });
        
        // Paginación
        DOM.prevPage.addEventListener('click', () => {
            if (AppState.currentPage > 1) {
                AppState.currentPage--;
                this.applyFiltersAndRender();
            }
        });
        
        DOM.nextPage.addEventListener('click', () => {
            const maxPages = Math.ceil(AppState.filteredMessages.length / CONFIG.MESSAGES_PER_PAGE);
            if (AppState.currentPage < maxPages) {
                AppState.currentPage++;
                this.applyFiltersAndRender();
            }
        });
    },
    
    togglePanel(panelName) {
        const panels = {
            search: DOM.searchPanel,
            filters: DOM.filtersPanel,
            time: DOM.timePanel,
            sort: DOM.sortPanel
        };
        
        const buttons = {
            search: DOM.searchToggle,
            filters: DOM.filterToggle,
            time: DOM.timeToggle,
            sort: DOM.sortToggle
        };
        
        const panel = panels[panelName];
        const button = buttons[panelName];
        
        if (AppState.activePanels.has(panelName)) {
            // Cerrar panel
            panel.style.display = 'none';
            button.classList.remove('active');
            AppState.activePanels.delete(panelName);
        } else {
            // Abrir panel
            panel.style.display = 'block';
            button.classList.add('active');
            AppState.activePanels.add(panelName);
            
            // Focus en search input si es panel de búsqueda
            if (panelName === 'search') {
                setTimeout(() => DOM.searchInput.focus(), 100);
            }
        }
    },
    
    filterByTopic(topic) {
        // Actualizar filtro de tema
        AppState.filters.topic = topic;
        DOM.topicFilter.value = topic;
        
        // Abrir panel de filtros si no está abierto
        if (!AppState.activePanels.has('filters')) {
            this.togglePanel('filters');
        }
        
        // Resetear página y aplicar filtros
        AppState.currentPage = 1;
        this.applyFiltersAndRender();
    },
    
    resetAllFilters() {
        // Reset UI
        DOM.searchInput.value = '';
        DOM.authorFilter.value = '';
        DOM.topicFilter.value = '';
        
        document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.time-btn[data-time="all"]').classList.add('active');
        
        document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.sort-btn[data-sort="saves-desc"]').classList.add('active');
        
        // Cerrar todos los paneles
        AppState.activePanels.forEach(panelName => {
            this.togglePanel(panelName);
        });
        
        // Reset state
        AppState.searchTerm = '';
        AppState.filters = { sort: 'saves-desc', author: '', topic: '', time: 'all' };
        AppState.currentPage = 1;
        
        this.updateClearSearchButton();
        this.applyFiltersAndRender();
    },
    
    updateClearSearchButton() {
        DOM.clearSearch.style.display = AppState.searchTerm ? 'block' : 'none';
    },
    
    showLoading() {
        DOM.loading.style.display = 'block';
        DOM.error.style.display = 'none';
        DOM.controls.style.display = 'none';
        DOM.messagesContainer.style.display = 'none';
        DOM.pagination.style.display = 'none';
    },
    
    hideLoading() {
        DOM.loading.style.display = 'none';
    },
    
    showError() {
        DOM.loading.style.display = 'none';
        DOM.error.style.display = 'block';
        DOM.controls.style.display = 'none';
        DOM.messagesContainer.style.display = 'none';
        DOM.pagination.style.display = 'none';
    }
};

// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', () => App.init());
