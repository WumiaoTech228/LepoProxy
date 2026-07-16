// --- 主题切换逻辑 ---
const htmlEl = document.documentElement;
const themeBtns = document.querySelectorAll('.theme-btn');

// 初始主题：优先从 localStorage 读取，否则默认跟随系统的系统深色/浅色偏好
const systemDarkQuery = window.matchMedia('(prefers-color-scheme: dark)');
let currentTheme = localStorage.getItem('lepo_theme') || (systemDarkQuery.matches ? 'dark' : 'light');

export function setTheme(theme) {
    currentTheme = theme;
    if (theme === 'dark') {
        htmlEl.classList.add('dark');
    } else {
        htmlEl.classList.remove('dark');
    }
    localStorage.setItem('lepo_theme', theme);
    updateThemeUI();
}

export function updateThemeUI() {
    themeBtns.forEach(b => {
        if (b.getAttribute('data-theme') === currentTheme) {
            b.classList.add('bg-app-surface', 'text-app-text', 'shadow-sm', 'border-app-border');
            b.classList.remove('text-app-muted', 'border-transparent');
        } else {
            b.classList.remove('bg-app-surface', 'text-app-text', 'shadow-sm', 'border-app-border');
            b.classList.add('text-app-muted', 'border-transparent');
        }
    });
}

export function initTheme() {
    // 初始化应用主题
    setTheme(currentTheme);

    // 绑定用户手动点击按钮切换
    themeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const selectedTheme = e.currentTarget.getAttribute('data-theme');
            if (selectedTheme === currentTheme) return;
            setTheme(selectedTheme);
        });
    });

    // 监听系统侧更改：如果操作系统深浅色更改，则立刻跟随系统改变
    systemDarkQuery.addEventListener('change', (e) => {
        const newTheme = e.matches ? 'dark' : 'light';
        setTheme(newTheme);
    });
}
