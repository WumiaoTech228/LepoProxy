// --- LepoProxy Premium Custom Dialog and Toast Helper Logic ---
let dialogResolve = null;

export function showConfirm(title, message, isAlert = false) {
    return new Promise((resolve) => {
        dialogResolve = resolve;
        const overlay = document.getElementById('customDialogOverlay');
        const card = document.getElementById('customDialogCard');
        const titleEl = document.getElementById('customDialogTitle');
        const msgEl = document.getElementById('customDialogMessage');
        const cancelBtn = document.getElementById('customDialogCancelBtn');
        const confirmBtn = document.getElementById('customDialogConfirmBtn');
        const iconEl = document.getElementById('customDialogIcon');
        const iconContainer = document.getElementById('customDialogIconContainer');

        if (!overlay || !card) return resolve(false);

        titleEl.textContent = title;
        msgEl.textContent = message;

        if (isAlert) {
            cancelBtn.classList.add('hidden');
            confirmBtn.textContent = '我知道了';
            confirmBtn.className = "px-4 py-1.5 bg-app-text text-app-base hover:opacity-90 text-[10px] font-semibold rounded-lg transition-colors btn-press";
            iconEl.className = "ph ph-info text-lg";
            iconContainer.className = "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-app-primary/10 text-app-primary";
        } else {
            cancelBtn.classList.remove('hidden');
            confirmBtn.textContent = '确认';
            confirmBtn.className = "px-3 py-1.5 bg-red-500 text-white hover:bg-red-600 text-[10px] font-semibold rounded-lg transition-colors btn-press";
            iconEl.className = "ph ph-warning text-lg";
            iconContainer.className = "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-rose-500/10 text-rose-500";
        }

        overlay.classList.remove('opacity-0', 'pointer-events-none');
        card.classList.remove('scale-95', 'opacity-0');
        card.classList.add('scale-100', 'opacity-100');
    });
}

export function closeDialog(result) {
    const overlay = document.getElementById('customDialogOverlay');
    const card = document.getElementById('customDialogCard');
    
    if (!overlay || !card) return;
    card.classList.remove('scale-100', 'opacity-100');
    card.classList.add('scale-95', 'opacity-0');
    overlay.classList.add('opacity-0', 'pointer-events-none');
    
    if (dialogResolve) {
        dialogResolve(result);
        dialogResolve = null;
    }
}

export function initDialogs() {
    const cancelBtn = document.getElementById('customDialogCancelBtn');
    const confirmBtn = document.getElementById('customDialogConfirmBtn');
    const overlay = document.getElementById('customDialogOverlay');

    if (cancelBtn) cancelBtn.addEventListener('click', () => closeDialog(false));
    if (confirmBtn) confirmBtn.addEventListener('click', () => closeDialog(true));
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                const cBtn = document.getElementById('customDialogCancelBtn');
                if (cBtn && !cBtn.classList.contains('hidden')) {
                    closeDialog(false);
                } else {
                    closeDialog(true);
                }
            }
        });
    }
}

// Premium Toast System
export function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `flex items-center gap-2 px-3 py-2 bg-app-surface/95 backdrop-blur border border-app-border shadow-xl rounded-xl pointer-events-auto transform translate-y-[-10px] opacity-0 transition-all duration-300 theme-transition w-full`;
    
    let iconClass = 'ph-check-circle text-emerald-500';
    if (type === 'warning') iconClass = 'ph-warning text-amber-500';
    if (type === 'error') iconClass = 'ph-x-circle text-red-500';
    if (type === 'info') iconClass = 'ph-info text-app-primary';

    toast.innerHTML = `
        <i class="ph ${iconClass} text-sm flex-shrink-0"></i>
        <span class="text-[10px] font-semibold text-app-text whitespace-nowrap overflow-hidden text-ellipsis flex-1">${message}</span>
    `;

    container.appendChild(toast);

    // Fade in
    setTimeout(() => {
        toast.classList.remove('translate-y-[-10px]', 'opacity-0');
        toast.classList.add('translate-y-0', 'opacity-100');
    }, 50);

    // Fade out and remove
    setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-[-10px]', 'opacity-0');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 2500);
}
