
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
    const topicList = topics.slice(0, 3); // Show the three most popular topics

    let html = `
        <div class="forum-heading">
            <h2>Conversaciones populares</h2>
        </div>
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
                     ${!imageUrl ? '<i class="fa-regular fa-message placeholder-icon" aria-hidden="true"></i>' : ''}
                </div>
                
                <div class="topic-content">
                    <h3 class="topic-title">${topic.title}</h3>

                    <div class="topic-meta-line">
                        <span class="topic-meta-date">
                            <span class="topic-category-dot"></span>
                            <span class="topic-date">${date}</span>
                        </span>
                        <span class="topic-meta-author">
                            <img src="${avatarUrl}" alt="" loading="lazy">
                            <span class="author-name">${authorName}</span>
                        </span>
                        <span class="topic-meta-comments">
                            <i class="fa-regular fa-comment" aria-hidden="true"></i>
                            <span>${topic.posts_count - 1}</span>
                        </span>
                    </div>
                </div>
            </a>
        `;
    });

    html += `
        </div>
        <p class="more-topics"><a href="https://foro.aldeapucela.org/top?period=weekly">Ver más</a></p>
    `;

    container.innerHTML = html;

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
