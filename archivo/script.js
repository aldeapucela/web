// Configuración de la aplicación
const CONFIG = {
    API_URL: 'https://proyectos.aldeapucela.org/exports/guardados/data.json',
    MESSAGES_PER_PAGE: 20,
    MAX_CONTENT_LENGTH: 600,
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
    
    // Panel de temas populares
    popularTopicsPanel: document.getElementById('popular-topics-panel'),
    popularTopicsList: document.getElementById('popular-topics-list'),
    
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
        if (text.length <= maxLength) return { text, truncated: false, original: text };
        
        // Find a good breaking point near the max length (prefer word boundaries)
        let breakPoint = maxLength;
        const nearBreakPoint = text.substring(maxLength - 50, maxLength + 50);
        const spaceIndex = nearBreakPoint.lastIndexOf(' ');
        
        if (spaceIndex !== -1 && spaceIndex > 25) {
            breakPoint = maxLength - 50 + spaceIndex;
        }
        
        return {
            text: text.substring(0, breakPoint).trim() + '...',
            truncated: true,
            original: text,
            previewLength: breakPoint
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
    
    // Lista de palabras vacías en español que no deben usarse como temas
    spanishStopwords: new Set([
        // Artículos
        'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
        // Preposiciones
        'a', 'ante', 'bajo', 'con', 'contra', 'de', 'desde', 'en', 'entre', 'hacia', 'hasta', 'para', 'por', 'según', 'sin', 'sobre', 'tras',
        // Conjunciones
        'y', 'e', 'ni', 'o', 'u', 'pero', 'sino', 'que', 'si', 'como', 'cuando', 'donde', 'mientras', 'aunque',
        // Pronombres
        'yo', 'tú', 'él', 'ella', 'nosotros', 'vosotros', 'ellos', 'ellas', 'me', 'te', 'se', 'nos', 'os', 'le', 'les', 'lo', 'la', 'los', 'las',
        // Adverbios comunes
        'no', 'sí', 'también', 'tampoco', 'muy', 'más', 'menos', 'tanto', 'tan', 'bien', 'mal', 'aquí', 'ahí', 'allí', 'hoy', 'ayer', 'mañana',
        // Verbos auxiliares comunes
        'es', 'son', 'está', 'están', 'ser', 'estar', 'tener', 'haber', 'hay',
        // Otras palabras comunes
        'del', 'al', 'todo', 'todos', 'toda', 'todas', 'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'esos', 'esas', 'aquel', 'aquella', 'aquellos', 'aquellas'
    ]),
    
    extractTopics(topicString) {
        if (!topicString) return [];
        return topicString.split(/\s+/)
            .map(topic => topic.trim())
            .filter(topic => {
                if (!topic) return false;
                const normalized = topic.toLowerCase();
                // Filtrar palabras vacías y palabras muy cortas (menos de 3 caracteres)
                return !this.spanishStopwords.has(normalized) && normalized.length >= 3;
            });
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
    },
    
    // Cache para imágenes de Telegram para evitar múltiples solicitudes
    telegramImageCache: new Map(),
    
    // Sistema de cola para controlar peticiones
    imageQueue: [],
    isProcessingQueue: false,
    
    // Intersection Observer para detectar imágenes visibles
    imageObserver: null,
    
    // Procesar cola de imágenes con delay entre peticiones
    async processImageQueue() {
        if (this.isProcessingQueue || this.imageQueue.length === 0) {
            return;
        }
        
        this.isProcessingQueue = true;
        
        while (this.imageQueue.length > 0) {
            const { container, telegramUrl, callback } = this.imageQueue.shift();
            
            // Cambiar a estado de loading activo
            if (container) {
                container.classList.remove('lazy-loading');
                container.classList.add('loading');
                const loadingText = container.querySelector('.image-loading span');
                if (loadingText) {
                    loadingText.textContent = 'Cargando imagen...';
                }
            }
            
            try {
                const imageUrl = await this.getTelegramImageWithRetry(telegramUrl);
                callback(container, imageUrl, telegramUrl);
            } catch (error) {
                console.warn('Failed to load image after retries:', error.message);
                callback(container, null, telegramUrl);
            }
            
            // Delay entre peticiones para evitar rate limiting
            if (this.imageQueue.length > 0) {
                await this.delay(500); // 500ms entre peticiones
            }
        }
        
        this.isProcessingQueue = false;
    },
    
    // Añadir imagen a la cola
    queueImageLoad(container, telegramUrl, callback) {
        this.imageQueue.push({ container, telegramUrl, callback });
        this.processImageQueue();
    },
    
    // Delay utility
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },
    
    async getTelegramImageWithRetry(telegramUrl, maxRetries = 2) {
        // Verificar cache primero
        if (this.telegramImageCache.has(telegramUrl)) {
            return this.telegramImageCache.get(telegramUrl);
        }
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const imageUrl = await this.tryExtractWithProxy(telegramUrl);
                
                // Guardar en cache
                this.telegramImageCache.set(telegramUrl, imageUrl);
                return imageUrl;
            } catch (error) {
                console.warn(`Attempt ${attempt}/${maxRetries} failed for ${telegramUrl}:`, error.message);
                
                if (attempt < maxRetries) {
                    // Esperar más tiempo antes del retry
                    await this.delay(1000 * attempt);
                } else {
                    // Último intento fallido, guardar null en cache
                    this.telegramImageCache.set(telegramUrl, null);
                    throw error;
                }
            }
        }
    },
    
    async getTelegramImage(telegramUrl) {
        // Esta función ahora es un wrapper que usa la cola
        return new Promise((resolve) => {
            this.queueImageLoad(null, telegramUrl, (container, imageUrl) => {
                resolve(imageUrl);
            });
        });
    },
    
    async tryExtractWithProxy(telegramUrl) {
        try {
            // Si es una URL de t.me, intentar diferentes formatos que contengan metadatos
            const telegramMatch = telegramUrl.match(/t\.me\/([^/]+)\/([0-9]+)/);
            if (telegramMatch) {
                const channel = telegramMatch[1];
                const messageId = telegramMatch[2];
                
                // Probar diferentes formatos de URL que pueden tener metadatos
                const urlsToTry = [
                    `${telegramUrl}?embed=1&mode=tme`,
                    `https://t.me/${channel}/${messageId}?embed=1`,
                    `https://t.me/s/${channel}/${messageId}`,  // Formato "s/" a veces tiene más metadatos
                    telegramUrl  // Original como fallback
                ];
                
                for (const testUrl of urlsToTry) {
                    const result = await this.tryUrlForMetadata(testUrl);
                    if (result) {
                        return result;
                    }
                }
                
                return null;
            }
            
            // Si no es URL de Telegram, usar directamente
            return await this.tryUrlForMetadata(telegramUrl);
        } catch (error) {
            console.warn('Error extracting image:', error.message);
            return null;
        }
    },
    
    async tryUrlForMetadata(url) {
        try {
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
            const response = await fetch(proxyUrl);
            
            if (!response.ok) {
                return null;
            }
            
            const data = await response.json();
            const htmlContent = data.contents;
            
            if (!htmlContent) {
                return null;
            }
            
            // Buscar metadatos Open Graph en el HTML con múltiples patrones
            const metaPatterns = [
                /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i,
                /<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i,
                /<meta\s+property=["']twitter:image["']\s+content=["']([^"']+)["']/i,
                // Patrones adicionales que Telegram puede usar
                /<meta\s+property=["']og:image:url["']\s+content=["']([^"']+)["']/i,
                /<meta\s+name=["']image["']\s+content=["']([^"']+)["']/i,
                /<meta\s+property=["']image["']\s+content=["']([^"']+)["']/i
            ];
            
            for (const pattern of metaPatterns) {
                const match = htmlContent.match(pattern);
                if (match && match[1]) {
                    return match[1];
                }
            }
            
            return null;
        } catch (error) {
            console.warn('Error extracting metadata:', error.message);
            return null;
        }
    },
    
    
    // Inicializar Intersection Observer para detectar imágenes visibles
    initImageObserver() {
        if (!this.imageObserver) {
            this.imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const container = entry.target;
                        const telegramUrl = container.dataset.telegramUrl;
                        
                        // Desconectar observer para este elemento
                        this.imageObserver.unobserve(container);
                        
                        // Añadir a la cola de carga
                        this.queueImageLoad(container, telegramUrl, (container, imageUrl, telegramUrl) => {
                            if (imageUrl) {
                                App.displayTelegramImage(container, imageUrl, telegramUrl);
                            } else {
                                App.displayImageError(container);
                            }
                        });
                    }
                });
            }, {
                rootMargin: '100px' // Empezar a cargar 100px antes de que sea visible
            });
        }
        return this.imageObserver;
    },
    
    // Observar contenedor de imagen para carga lazy
    observeImageContainer(container) {
        const observer = this.initImageObserver();
        observer.observe(container);
    },
    
    // El fallback no puede generar URLs de imagen válidas, solo mostrar error
    getTelegramImageFallback(telegramUrl) {
        // Telegram no expone URLs de imagen públicas de forma predecible
        // El único recurso real es usar los metadatos, si fallan, no hay imagen
        console.warn('No fallback available for Telegram images - showing error state');
        return null;
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
                    hasImage: item.Image === true || item.Image === 'true',
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
    
    extractUniqueTopicsWithCounts(messages) {
        const topicMap = new Map(); // normalizado -> { canonical: string, count: number }
        
        messages.forEach(msg => {
            if (msg.unifiedTopics) {
                msg.unifiedTopics.forEach(topicData => {
                    const normalized = Utils.normalizeTopicForComparison(topicData.topic);
                    if (!topicMap.has(normalized)) {
                        topicMap.set(normalized, { topic: topicData.topic, count: 0 });
                    }
                    // Contar cuántas veces aparece este tema (considerando la frecuencia por mensaje)
                    topicMap.get(normalized).count += topicData.count;
                });
            }
        });
        
        // Ordenar por popularidad (más usados primero) y luego alfabéticamente
        return Array.from(topicMap.values())
            .sort((a, b) => {
                // Primer criterio: por frecuencia (descendente)
                if (b.count !== a.count) {
                    return b.count - a.count;
                }
                // Segundo criterio: alfabéticamente (ascendente)
                return a.topic.localeCompare(b.topic, 'es', { sensitivity: 'base' });
            });
    },
    
    extractUniqueTopics(messages) {
        return this.extractUniqueTopicsWithCounts(messages).map(item => item.topic);
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
        const fullProcessedContent = contentData.truncated ? Utils.processLinks(contentData.original) : processedContent;
        
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
                    
                    <div class="message-content ${contentData.truncated ? 'truncated' : ''}" data-expanded="false">
                        <div class="content-preview">
                            ${processedContent.replace(/\n/g, '<br>')}
                        </div>
                        ${contentData.truncated ? `
                            <div class="content-full" style="display: none;">
                                ${fullProcessedContent.replace(/\n/g, '<br>')}
                            </div>
                            <button class="expand-btn" data-action="expand">
                                <i class="fas fa-chevron-down"></i> Mostrar más
                            </button>
                        ` : ''}
                        ${message.hasImage ? `
                            <div class="message-image-container" data-telegram-url="${message.telegramLink}">
                                <div class="image-loading">
                                    <i class="fas fa-image"></i>
                                    <span>Imagen disponible - se cargará al entrar en vista</span>
                                </div>
                            </div>
                        ` : ''}
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
        
        // Poblar filtro de temas con contadores
        const topicsData = DataProcessor.extractUniqueTopicsWithCounts(AppState.allMessages);
        DOM.topicFilter.innerHTML = '<option value="">Todos los temas</option>';
        topicsData.forEach(topicData => {
            const countText = topicData.count > 1 ? ` (${topicData.count})` : '';
            DOM.topicFilter.innerHTML += `<option value="${topicData.topic}">${topicData.topic}${countText}</option>`;
        });
        
        // Guardar datos de temas para el panel de populares
        AppState.topicsData = topicsData;
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
            this.renderPopularTopics();
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
        
        // Configurar lazy loading para imágenes de Telegram
        this.setupLazyImageLoading();
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
            
            // Manejar clicks en botones de expandir/contraer contenido
            const expandBtn = e.target.closest('.expand-btn');
            if (expandBtn) {
                this.toggleMessageContent(expandBtn);
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
        
        // Actualizar estado visual del panel de temas populares
        this.renderPopularTopics();
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
        
        // Actualizar estado visual del panel de temas populares
        this.renderPopularTopics();
    },
    
    updateClearSearchButton() {
        DOM.clearSearch.style.display = AppState.searchTerm ? 'block' : 'none';
    },
    
    toggleMessageContent(expandBtn) {
        const messageContent = expandBtn.closest('.message-content');
        const contentPreview = messageContent.querySelector('.content-preview');
        const contentFull = messageContent.querySelector('.content-full');
        const isExpanded = messageContent.dataset.expanded === 'true';
        
        if (isExpanded) {
            // Contraer
            contentPreview.style.display = 'block';
            contentFull.style.display = 'none';
            messageContent.dataset.expanded = 'false';
            expandBtn.innerHTML = '<i class="fas fa-chevron-down"></i> Mostrar más';
            expandBtn.dataset.action = 'expand';
        } else {
            // Expandir
            contentPreview.style.display = 'none';
            contentFull.style.display = 'block';
            messageContent.dataset.expanded = 'true';
            expandBtn.innerHTML = '<i class="fas fa-chevron-up"></i> Mostrar menos';
            expandBtn.dataset.action = 'collapse';
        }
    },
    
    setupLazyImageLoading() {
        // Configurar lazy loading para todas las imágenes
        const imageContainers = document.querySelectorAll('.message-image-container');
        
        imageContainers.forEach(container => {
            const telegramUrl = container.dataset.telegramUrl;
            
            if (!telegramUrl) {
                console.warn('No telegram URL found in container');
                this.displayImageError(container);
                return;
            }
            
            // Añadir clase para indicar que está pendiente de carga
            container.classList.add('lazy-loading');
            
            // Configurar observer para este contenedor
            Utils.observeImageContainer(container);
        });
    },
    
    displayTelegramImage(container, imageUrl, telegramUrl) {
        // Limpiar estados de carga
        container.classList.remove('lazy-loading', 'loading');
        
        // Limpiar el contenedor completamente
        container.innerHTML = '';
        
        // Crear elementos del DOM de forma segura
        const imageDiv = document.createElement('div');
        imageDiv.className = 'message-image';
        
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = 'Imagen del mensaje';
        img.loading = 'lazy';
        img.style.cursor = 'pointer';
        
        // Agregar eventos de forma segura
        img.onclick = () => window.open(telegramUrl, '_blank');
        img.onerror = () => {
            console.warn('Image failed to load, showing placeholder');
            this.displayImageError(container);
        };
        
        const overlay = document.createElement('div');
        overlay.className = 'image-overlay';
        overlay.innerHTML = '<i class="fas fa-external-link-alt"></i>';
        
        imageDiv.appendChild(img);
        imageDiv.appendChild(overlay);
        container.appendChild(imageDiv);
    },
    
    displayImageError(container) {
        // Limpiar estados de carga
        container.classList.remove('lazy-loading', 'loading');
        
        const telegramUrl = container.dataset.telegramUrl;
        container.innerHTML = `
            <div class="image-placeholder" onclick="window.open('${telegramUrl}', '_blank')">
                <i class="fas fa-image"></i>
                <span>Clic para ver imagen</span>
            </div>
        `;
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
    
    renderPopularTopics() {
        // Solo mostrar si hay temas
        if (!AppState.topicsData || AppState.topicsData.length === 0) {
            DOM.popularTopicsPanel.style.display = 'none';
            return;
        }
        
        // Mostrar solo los 6 temas más populares
        const topTopics = AppState.topicsData.slice(0, 6);
        
        DOM.popularTopicsList.innerHTML = topTopics
            .map(topicData => {
                const isActive = AppState.filters.topic === topicData.topic ? 'active' : '';
                return `<button class="popular-topic-tag ${isActive}" data-topic="${topicData.topic}">
                    #${topicData.topic}
                </button>`;
            })
            .join('');
            
        DOM.popularTopicsPanel.style.display = 'block';
        
        // Event listeners para los tags populares
        DOM.popularTopicsList.addEventListener('click', (e) => {
            const tag = e.target.closest('.popular-topic-tag');
            if (tag) {
                const topic = tag.dataset.topic;
                this.filterByTopic(topic);
            }
        });
    },
    
    showError() {
        DOM.loading.style.display = 'none';
        DOM.error.style.display = 'block';
        DOM.controls.style.display = 'none';
        DOM.messagesContainer.style.display = 'none';
        DOM.pagination.style.display = 'none';
        DOM.popularTopicsPanel.style.display = 'none';
    }
};

// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', () => App.init());
