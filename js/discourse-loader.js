
/**
 * Aldea Pucela Discourse Loader
 * Fetches latest topics from the forum and renders them as rich cards.
 */

document.addEventListener('DOMContentLoaded', function () {
    const forumContainer = document.getElementById('foro');
    if (!forumContainer) return;

    // Loading state
    forumContainer.innerHTML = '<div class="loading-state">Cargando temas destacados...</div>';

    fetch('https://foro.aldeapucela.org/top.json?period=weekly')
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            if (!data.topic_list || !data.topic_list.topics) {
                throw new Error('Invalid data format');
            }
            renderTopics(data.topic_list.topics, data.users);
        })
        .catch(error => {
            console.error('Error fetching topics:', error);
            renderFallback('No pudimos cargar los temas en este momento.');
        });
});

function renderTopics(topics, users) {
    const container = document.getElementById('foro');
    const topicList = topics.slice(0, 5); // Show top 5 topics

    let html = `
        <h2><i data-lucide="message-square"></i> Popular esta semana</h2>
        <div class="topics-grid">
    `;

    topicList.forEach(topic => {
        // Find user avatar
        let avatarUrl = '/img/default-avatar.png'; // Fallback

        // Find poster (usually OP)
        const authorPoster = topic.posters?.find(p => p.description?.includes('Original Poster')) || topic.posters?.[0];
        const authorUser = users.find(u => u.id === authorPoster?.user_id);

        if (authorUser && authorUser.avatar_template) {
            avatarUrl = `https://foro.aldeapucela.org${authorUser.avatar_template.replace('{size}', '60')}`;
        }

        const authorName = authorUser?.username || topic.last_poster_username || 'Anónimo';

        // Logic for Thumbnail / Image
        const imageUrl = topic.image_url;

        // Date formatting
        const date = new Date(topic.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

        html += `
            <a href="https://foro.aldeapucela.org/t/${topic.slug}/${topic.id}" class="topic-card">
                <div class="topic-image ${!imageUrl ? 'is-placeholder' : ''}" 
                     style="${imageUrl ? `background-image: url('${imageUrl}')` : ''}">
                     ${!imageUrl ? '<i data-lucide="message-square-text" class="placeholder-icon"></i>' : ''}
                </div>
                
                <div class="topic-content">
                    <div class="topic-meta-top">
                        <span class="topic-category-dot"></span>
                        <span class="topic-date">${date}</span>
                    </div>
                    
                    <h3 class="topic-title">${topic.title}</h3>
                    
                    <div class="topic-meta-bottom">
                        <div class="topic-author">
                            <img src="${avatarUrl}" alt="${authorName}" loading="lazy">
                            <span class="author-name">${authorName}</span>
                        </div>
                        <div class="topic-stats">
                            <span class="stat"><i data-lucide="message-circle"></i> ${topic.posts_count - 1}</span>
                        </div>
                    </div>
                </div>
            </a>
        `;
    });

    html += `
        </div>
        <p class="more-topics"><a href="https://foro.aldeapucela.org/top?period=weekly">Ver más &rarr;</a></p>
    `;

    container.innerHTML = html;

    // Re-init icons for the new content
    if (window.lucide) {
        lucide.createIcons();
    }
}

function renderFallback(message) {
    const container = document.getElementById('foro');
    container.innerHTML = `
        <div class="topic-error">
            <p>${message}</p>
            <a href="https://foro.aldeapucela.org/" class="btn btn-secondary">Ir al foro</a>
        </div>
    `;
}
