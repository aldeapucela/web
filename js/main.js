// Telegram Modal Logic

// Global support function for handling modal triggers ensuring robustness
function openTelegramModal(e) {
    if (e) e.preventDefault();
    const modal = document.getElementById('js-telegram-modal');
    if (modal) {
        modal.classList.add('is-visible');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Re-initialize icons
    if (window.lucide) {
        lucide.createIcons();
    }

    const modal = document.getElementById('js-telegram-modal');
    const closeBtns = document.querySelectorAll('.js-modal-close');

    // Close buttons logic
    if (closeBtns) {
        closeBtns.forEach(btn => btn.addEventListener('click', () => {
            if (modal) modal.classList.remove('is-visible');
        }));
    }

    // Close on outside click
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('is-visible');
        });
    }
});

// Theme Toggle Logic
document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('theme-toggle');
    const html = document.documentElement;

    // 1. Check persistence or system preference
    // 1. Check persistence or system preference
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)');

    // Debug
    console.log('Theme Debug:', { savedTheme, systemMatches: systemPrefersDark.matches });

    // Initial check
    if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark.matches)) {
        html.setAttribute('data-theme', 'dark');
    } else {
        // Explicitly ensure we are in light mode if that's the logic (default is usually light but good to be sure)
        html.removeAttribute('data-theme');
    }

    // Listener for system preference changes (only if no manual override)
    systemPrefersDark.addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
            console.log('System preference changed:', e.matches);
            if (e.matches) {
                html.setAttribute('data-theme', 'dark');
            } else {
                html.removeAttribute('data-theme');
            }
        }
    });

    // 2. Toggle Event
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const currentTheme = html.getAttribute('data-theme');
            if (currentTheme === 'dark') {
                html.removeAttribute('data-theme');
                localStorage.setItem('theme', 'light');
            } else {
                html.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
            }
        });
    }
});
