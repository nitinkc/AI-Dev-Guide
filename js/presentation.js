// Initialize Reveal.js
document.addEventListener('DOMContentLoaded', function() {
    Reveal.initialize({
        hash: true,
        transition: 'fade',
        transitionSpeed: 'fast',
        width: '100%',
        height: '100%',
        margin: 0.05,
        minScale: 0.2,
        maxScale: 4.0,
        keyboard: true,
        touch: true,
        overview: true,
        center: true,
        slideNumber: 'c/t',
        help: true,
        plugins: [
            RevealMarkdown,
            RevealHighlight
        ],
        embedded: true,
        parallaxBackgroundImage: '',
        parallaxBackgroundSize: '',
        touch: {
            vertical: true,
            horizontal: true
        }
    });

    // Initialize Mermaid
    if (typeof mermaid !== 'undefined') {
        mermaid.initialize({
            startOnLoad: true,
            theme: 'dark',
            securityLevel: 'loose'
        });
        mermaid.contentLoaded();
    }

    // Add smooth scrolling to slide sections
    const sections = document.querySelectorAll('.reveal section');
    sections.forEach(section => {
        section.addEventListener('wheel', function(e) {
            // Allow natural scrolling within the section
            if (this.scrollHeight > this.clientHeight) {
                if ((this.scrollTop === 0 && e.deltaY < 0) ||
                    (this.scrollTop + this.clientHeight === this.scrollHeight && e.deltaY > 0)) {
                    // At boundaries, allow Reveal.js to handle navigation
                    return;
                }
                // Otherwise, allow normal scrolling
                e.stopPropagation();
            }
        }, { passive: true });
    });

    // Keyboard shortcuts info
    console.log('%c Presentation Shortcuts', 'font-size: 14px; color: #58a6ff; font-weight: bold;');
    console.log('%c → Arrow Keys or Space: Navigate slides', 'font-size: 12px; color: #e6edf3;');
    console.log('%c ESC: Slide overview', 'font-size: 12px; color: #e6edf3;');
    console.log('%c F: Fullscreen', 'font-size: 12px; color: #e6edf3;');
    console.log('%c S: Speaker view', 'font-size: 12px; color: #e6edf3;');
    console.log('%c Scroll within slides to see all content', 'font-size: 12px; color: #79c0ff; font-style: italic;');
});

