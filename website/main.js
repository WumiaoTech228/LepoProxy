/**
 * LepoProxy Website Interactivity Controller
 * Handcrafted to coordinate the premium VitePress-styled site interactions.
 * Manages mobile responsive navigations and copy-to-clipboard terminal bindings.
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Mobile navigation menu
    initNavigation();
    
    // 2. Command terminal copier
    initCodeCopier();
});

/* ==========================================================================
   1. Mobile Navigation Menu Toggle
   ========================================================================== */
function initNavigation() {
    const menuToggle = document.getElementById('menu-toggle');
    const mainNav = document.getElementById('main-nav');
    
    if (menuToggle && mainNav) {
        menuToggle.addEventListener('click', () => {
            menuToggle.classList.toggle('active');
            mainNav.classList.toggle('active');
            
            // Toggle hamburger icon transforms
            const spans = menuToggle.querySelectorAll('span');
            if (spans.length >= 3) {
                if (menuToggle.classList.contains('active')) {
                    spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
                    spans[1].style.opacity = '0';
                    spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
                } else {
                    spans[0].style.transform = 'none';
                    spans[1].style.opacity = '1';
                    spans[2].style.transform = 'none';
                    spans[3].style.transform = 'none';
                }
            }
        });
        
        // Close menu when clicking nav links
        const navLinks = mainNav.querySelectorAll('a');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                menuToggle.classList.remove('active');
                mainNav.classList.remove('active');
                
                const spans = menuToggle.querySelectorAll('span');
                if (spans.length >= 3) {
                    spans[0].style.transform = 'none';
                    spans[1].style.opacity = '1';
                    spans[2].style.transform = 'none';
                }
            });
        });
    }
}

/* ==========================================================================
   2. Copy-to-Clipboard Terminal Command Handler
   ========================================================================== */
function initCodeCopier() {
    const copyBtn = document.getElementById('copy-bash-btn');
    const bashCode = document.getElementById('bash-code');
    const btnText = document.getElementById('copy-btn-text');
    
    if (copyBtn && bashCode && btnText) {
        copyBtn.addEventListener('click', () => {
            const rawText = bashCode.innerText || bashCode.textContent;
            
            navigator.clipboard.writeText(rawText).then(() => {
                btnText.innerHTML = '<i class="ph ph-check"></i> 已复制!';
                copyBtn.style.color = 'var(--emerald)';
                copyBtn.style.borderColor = 'var(--emerald-border)';
                
                setTimeout(() => {
                    btnText.innerHTML = '<i class="ph ph-copy"></i> 复制';
                    copyBtn.style.color = '';
                    copyBtn.style.borderColor = '';
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy code snippet: ', err);
            });
        });
    }
}

