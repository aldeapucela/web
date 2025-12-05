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
