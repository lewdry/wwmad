/* ============================================
   WHAT WOULD MARCUS AURELIUS DO?
   Application Logic
   ============================================ */

(function () {
  'use strict';

  // --- Constants ---
  const SWIPE_THRESHOLD = 80;
  const SWIPE_THRESHOLD_Y = 80;
  const ROTATION_MULTIPLIER = 0.1; // Degrees per pixel
  const STORAGE_KEY = 'wwmad_favourites';

  // --- State ---
  let meditations = [];
  let history = []; // Array of meditation objects
  let historyIndex = -1; // Current position in history
  let favourites = [];
  let isFirstVisit = true;

  // Swipe state
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let currentY = 0;
  let isVerticalSwipe = false;

  // --- DOM Elements ---
  const card = document.getElementById('card');
  const quoteText = document.getElementById('quote-text');
  const quoteSource = document.getElementById('quote-source');
  const mainView = document.getElementById('main-view');
  const favouritesView = document.getElementById('favourites-view');
  const favouritesList = document.getElementById('favourites-list');
  const emptyMessage = document.getElementById('empty-message');
  const favouritesTab = document.getElementById('favourites-tab');
  const closeFavourites = document.getElementById('close-favourites');
  const aboutView = document.getElementById('about-view');
  const aboutContent = document.getElementById('about-content');
  const aboutTab = document.getElementById('about-tab');
  const closeAbout = document.getElementById('close-about');
  const favouriteBtn = document.getElementById('favourite-btn');
  const swipeHints = document.querySelectorAll('.swipe-hint');
  const swipeInstruction = document.getElementById('swipe-instruction');

  // --- Initialization ---
  function init() {
    loadMeditations();
    loadFavourites();
    loadFavourites();
    goToNextMeditation();
    setupEventListeners();
    animateHintsOnFirstVisit();
  }

  // --- Data Loading ---
  function loadMeditations() {
    // Data is loaded via data.js script tag
    if (typeof MEDITATIONS_DATA !== 'undefined' && MEDITATIONS_DATA.quotes) {
      meditations = MEDITATIONS_DATA.quotes;
    } else {
      console.error('Failed to load meditations data');
      quoteText.textContent = 'Failed to load meditations. Please refresh the page.';
    }
  }

  // --- Navigation Logic ---
  function goToNextMeditation() {
    // If we are not at the end of history, just move forward
    if (historyIndex < history.length - 1) {
      historyIndex++;
      displayMeditation(history[historyIndex], 'next');
      return;
    }

    // Otherwise pick a new random one
    const randomIndex = Math.floor(Math.random() * meditations.length);
    const meditation = meditations[randomIndex];

    // Add to history
    history.push(meditation);
    historyIndex++;

    displayMeditation(meditation, 'next');
  }

  function goToPreviousMeditation() {
    if (historyIndex > 0) {
      historyIndex--;
      displayMeditation(history[historyIndex], 'prev');
    } else {
      // Reached start of history - visual feedback could go here
      triggerHaptic('failure');
      bounceCard();
    }
  }

  function displayMeditation(meditation, direction = 'none') {
    quoteText.textContent = meditation.text;

    // Format source
    const bookNum = meditation.book.replace('Book ', '');
    quoteSource.textContent = `Meditations. ${bookNum}.${meditation.section}`;

    // Update Favourite State
    updateFavouriteUI(meditation.id);

    // Animation
    if (direction !== 'none') {
      const enterClass = direction === 'next' ? 'card--enter-right' : 'card--enter-left';

      card.classList.remove('card--enter-right', 'card--enter-left', 'card--entering');
      void card.offsetWidth; // Force reflow

      // We handle the "exit" animation in the swipe/nav function, 
      // but if we are just displaying (e.g. initial load), we might want a simple fade in
      if (direction === 'initial') {
        card.classList.add('card--entering');
      } else {
        // For nav, the card element is physically the same, so we might want to just animate opacity/transform
        // But the previous implementation used a timeout to swap content.
        // Let's rely on the transition logic in completeSwipe/navigate
      }
    } else {
      card.classList.remove('card--entering');
      void card.offsetWidth;
      card.classList.add('card--entering');
    }
  }

  function updateFavouriteUI(id) {
    const isFav = isFavourited(id);
    if (isFav) {
      card.classList.add('card--favourited');
      favouriteBtn.classList.add('action-btn--active');
      favouriteBtn.setAttribute('aria-label', 'Remove from favourites');
    } else {
      card.classList.remove('card--favourited');
      favouriteBtn.classList.remove('action-btn--active');
      favouriteBtn.setAttribute('aria-label', 'Add to favourites');
    }
  }

  function bounceCard() {
    card.style.transform = 'translateX(10px)';
    setTimeout(() => {
      card.style.transform = 'translateX(-5px)';
      setTimeout(() => {
        card.style.transform = 'translateX(0)';
      }, 100);
    }, 100);
  }

  function formatSourceCondensed(book, section) {
    const bookNum = book.replace('Book ', '');
    return `Meditations. ${bookNum}.${section}`;
  }

  // --- Swipe Handling ---
  function handleDragStart(e) {
    if (e.target.closest('.favourites-view')) return;

    isDragging = true;
    isVerticalSwipe = false;
    startX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
    startY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
    currentX = 0;
    currentY = 0;

    card.classList.add('card--swiping');
    card.classList.remove('card--swipe-left', 'card--swipe-right', 'card--swipe-down');

    // Hide hints after first interaction
    if (isFirstVisit) {
      hideHints();
      isFirstVisit = false;
    }
  }

  function handleDragMove(e) {
    if (!isDragging) return;

    const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;

    const deltaX = clientX - startX;
    const deltaY = clientY - startY;

    // Determine swipe axis if not yet set
    if (!currentX && !currentY) {
      if (Math.abs(deltaY) > Math.abs(deltaX) && deltaY > 0) {
        // Vertical swipe down only (favourite)
        isVerticalSwipe = true;
      }
    }

    currentX = deltaX;
    currentY = deltaY;

    // Prevent scrolling/refresh
    if (e.cancelable) e.preventDefault();

    if (isVerticalSwipe) {
      // Handle Vertical Pull (Favourite)
      const resistance = 0.4;
      const translateY = Math.max(0, deltaY * resistance);
      const scale = 1 + (translateY / 1000);

      card.style.transform = `translateY(${translateY}px) scale(${scale})`;

      // Trigger threshold visually
      if (deltaY > SWIPE_THRESHOLD_Y * 2) {
        card.classList.add('card--swipe-down');
      } else {
        card.classList.remove('card--swipe-down');
      }

    } else {
      // Handle Horizontal Swipe (Navigation)

      // Resistance for "Back" if no history
      let effectiveX = deltaX;
      if (historyIndex === 0 && deltaX > 0) {
        effectiveX = deltaX * 0.2; // High resistance
      }

      const rotation = effectiveX * ROTATION_MULTIPLIER;
      const opacity = 1 - Math.min(Math.abs(effectiveX) / 500, 0.2);

      card.style.transform = `translateX(${effectiveX}px) rotate(${rotation}deg)`;
      card.style.opacity = opacity;

      // Show direction indicators
      // Moving Left (deltaX < 0) -> Next
      // Moving Right (deltaX > 0) -> Prev
      card.classList.toggle('card--swipe-left', deltaX < -30); // "Next" hint
      card.classList.toggle('card--swipe-right', deltaX > 30 && historyIndex > 0); // "Prev" hint

    }
  }

  function handleDragEnd() {
    if (!isDragging) return;
    isDragging = false;

    card.classList.remove('card--swiping');
    card.classList.remove('card--swipe-left', 'card--swipe-right', 'card--swipe-down');

    // Handle Vertical Swipe
    if (isVerticalSwipe) {
      if (currentY > SWIPE_THRESHOLD_Y * 2) {
        toggleFavourite(true); // true = purely visual check if needed
        // Spring back with haptic success feel
      }

      resetCardPosition();
      return;
    }

    // Handle Horizontal Swipe
    // Left Swipe (Negative X) -> Next
    if (currentX < -SWIPE_THRESHOLD) {
      completeNavigation('next');
    }
    // Right Swipe (Positive X) -> Prev
    else if (currentX > SWIPE_THRESHOLD && historyIndex > 0) {
      completeNavigation('prev');
    }
    else {
      resetCardPosition();
    }
  }

  function resetCardPosition() {
    card.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease';
    card.style.transform = '';
    card.style.opacity = '';

    setTimeout(() => {
      card.style.transition = '';
    }, 400);
  }

  function completeNavigation(direction) {
    const offscreenX = direction === 'next' ? -window.innerWidth : window.innerWidth;
    const rotation = direction === 'next' ? -20 : 20;

    // 1. Animate Out
    card.style.transition = 'transform 250ms ease-in, opacity 250ms ease-in';
    card.style.transform = `translateX(${offscreenX}px) rotate(${rotation}deg)`;
    card.style.opacity = '0';

    setTimeout(() => {
      // 2. data update
      if (direction === 'next') {
        goToNextMeditation();
      } else {
        goToPreviousMeditation();
      }

      // 3. Prepare for Enter
      // If we went next, new card comes from right.
      // If we went prev, old card comes from left.
      const enterFromX = direction === 'next' ? window.innerWidth * 0.8 : -window.innerWidth * 0.8;

      card.style.transition = 'none';
      card.style.transform = `translateX(${enterFromX}px) scale(0.9)`;
      card.style.opacity = '0';

      // Force reflow
      void card.offsetWidth;

      // 4. Animate In
      card.style.transition = 'transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 300ms ease-out';
      card.style.transform = 'translateX(0) scale(1)';
      card.style.opacity = '1';

      setTimeout(() => {
        card.style.transition = '';
      }, 400);

    }, 250);
  }

  // --- Favourites Management ---
  function loadFavourites() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      favourites = stored ? JSON.parse(stored) : [];
    } catch (e) {
      favourites = [];
    }
  }

  function saveFavourites() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favourites));
    } catch (e) {
      console.error('Failed to save favourites:', e);
    }
  }

  function isFavourited(id) {
    return favourites.some(f => f.id === id);
  }

  function toggleFavourite(fromSwipe = false) {
    if (historyIndex === -1 || !history[historyIndex]) return;

    const meditation = history[historyIndex];
    const index = favourites.findIndex(f => f.id === meditation.id);

    if (index === -1) {
      // Add to favourites
      const favourite = {
        id: meditation.id,
        text: meditation.text,
        book: meditation.book,
        section: meditation.section,
        savedAt: Date.now()
      };
      favourites.unshift(favourite);
      triggerHaptic('success');
    } else {
      // Remove from favourites
      favourites.splice(index, 1);
      triggerHaptic('light');
    }

    saveFavourites();
    updateFavouriteUI(meditation.id);
  }

  function triggerHaptic(type) {
    if (!navigator.vibrate) return;

    try {
      switch (type) {
        case 'success':
          navigator.vibrate([10, 30, 10]);
          break;
        case 'failure':
          navigator.vibrate([50, 20, 50]);
          break;
        case 'light':
          navigator.vibrate(5);
          break;
        default:
          navigator.vibrate(10);
      }
    } catch (e) {
      // Ignore haptic errors
    }
  }

  function removeFromFavourites(id) {
    favourites = favourites.filter(f => f.id !== id);
    saveFavourites();
    renderFavourites();
  }

  function renderFavourites() {
    favouritesList.innerHTML = '';

    if (favourites.length === 0) {
      emptyMessage.hidden = false;
      return;
    }

    emptyMessage.hidden = true;

    // Favourites are already in reverse chronological order
    favourites.forEach(fav => {
      const card = createFavouriteCard(fav);
      favouritesList.appendChild(card);
    });
  }

  function createFavouriteCard(favourite) {
    const card = document.createElement('article');
    card.className = 'favourite-card';
    card.dataset.id = favourite.id;

    const source = formatSourceCondensed(favourite.book, favourite.section);

    card.innerHTML = `
      <p class="favourite-card__quote">${escapeHtml(favourite.text)}</p>
      <cite class="favourite-card__source">${source}</cite>
      <p class="favourite-card__hint">← swipe to remove</p>
    `;

    // Add swipe handling for removing
    setupFavouriteCardSwipe(card, favourite.id);

    return card;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // --- Favourite Card Swipe ---
  function setupFavouriteCardSwipe(cardEl, id) {
    let startX = 0;
    let currentX = 0;
    let isDragging = false;

    const onStart = (e) => {
      isDragging = true;
      startX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
      currentX = 0;
      cardEl.classList.add('favourite-card--swiping');
    };

    const onMove = (e) => {
      if (!isDragging) return;

      const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
      currentX = clientX - startX;

      // Only allow swiping left
      if (currentX > 0) currentX = 0;

      if (e.cancelable) e.preventDefault();

      const opacity = 1 - Math.min(Math.abs(currentX) / 200, 0.7);
      cardEl.style.transform = `translateX(${currentX}px)`;
      cardEl.style.opacity = opacity;
    };

    const onEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      cardEl.classList.remove('favourite-card--swiping');

      if (currentX < -SWIPE_THRESHOLD) {
        // Remove from favourites
        cardEl.classList.add('favourite-card--removing');
        setTimeout(() => {
          removeFromFavourites(id);
        }, 300);
      } else {
        // Spring back
        cardEl.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        cardEl.style.transform = '';
        cardEl.style.opacity = '';
        setTimeout(() => {
          cardEl.style.transition = '';
        }, 300);
      }
    };

    cardEl.addEventListener('touchstart', onStart, { passive: true });
    cardEl.addEventListener('touchmove', onMove, { passive: false });
    cardEl.addEventListener('touchend', onEnd);
    cardEl.addEventListener('mousedown', onStart);
    cardEl.addEventListener('mousemove', onMove);
    cardEl.addEventListener('mouseup', onEnd);
    cardEl.addEventListener('mouseleave', onEnd);
  }

  // --- View Switching ---
  function showFavourites() {
    renderFavourites();
    favouritesView.hidden = false;
    favouritesView.focus();
  }

  function hideFavourites() {
    favouritesView.hidden = true;
    mainView.focus();
  }

  function showAbout() {
    const aboutText = `# What Would Marcus Aurelius Do?

A simple web app for browsing random passages from Marcus Aurelius's Meditations. When you need a bit of Stoic wisdom, swipe through quotes and save the ones that resonate.

## How it works

Open the page and you'll see a quote from the Meditations. Swipe left to see the previous one, swipe right for a new one. If you find something worth keeping, swipe down or tap the heart button to save it to your favorites.

Your favorites are stored locally in your browser, so they'll be there next time you visit. Tap the Favourites button at the bottom to see everything you've saved, and swipe left on any quote to remove it.

## About the text

The quotes come from C. R. Haines's 1916 translation of the Meditations, which is in the public domain.`;
    
    aboutContent.innerHTML = convertMarkdownToHTML(aboutText);
    aboutView.hidden = false;
    aboutView.focus();
  }

  function hideAbout() {
    aboutView.hidden = true;
    mainView.focus();
  }

  function convertMarkdownToHTML(markdown) {
    // Split into blocks by double newlines
    const blocks = markdown.split('\n\n').filter(b => b.trim());
    
    const html = blocks.map(block => {
      const trimmed = block.trim();
      
      // H1
      if (trimmed.startsWith('# ')) {
        return `<h1>${trimmed.substring(2)}</h1>`;
      }
      // H2
      if (trimmed.startsWith('## ')) {
        return `<h2>${trimmed.substring(3)}</h2>`;
      }
      // H3
      if (trimmed.startsWith('### ')) {
        return `<h3>${trimmed.substring(4)}</h3>`;
      }
      // Paragraph - join lines with spaces
      return `<p>${trimmed.replace(/\n/g, ' ')}</p>`;
    }).join('');
    
    return html;
  }

  // --- Hints ---
  function animateHintsOnFirstVisit() {
    // Check if user has interacted before
    if (localStorage.getItem('wwmad_visited')) {
      swipeHints.forEach(hint => hint.classList.remove('swipe-hint--animate'));
      swipeInstruction.style.display = 'none';
      isFirstVisit = false;
      return;
    }

    swipeHints.forEach(hint => hint.classList.add('swipe-hint--animate'));
  }

  function hideHints() {
    swipeHints.forEach(hint => {
      hint.classList.remove('swipe-hint--animate');
      hint.style.transition = 'opacity 0.5s ease';
      hint.style.opacity = '0.3';
    });

    swipeInstruction.style.transition = 'opacity 0.5s ease';
    swipeInstruction.style.opacity = '0';

    localStorage.setItem('wwmad_visited', 'true');
  }

  // --- Event Listeners ---
  function setupEventListeners() {
    // Card swipe - touch
    card.addEventListener('touchstart', handleDragStart, { passive: true });
    document.addEventListener('touchmove', handleDragMove, { passive: false });
    document.addEventListener('touchend', handleDragEnd);

    // Card swipe - mouse
    card.addEventListener('mousedown', handleDragStart);
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);

    // Buttons
    favouritesTab.addEventListener('click', showFavourites);
    closeFavourites.addEventListener('click', hideFavourites);
    aboutTab.addEventListener('click', showAbout);
    closeAbout.addEventListener('click', hideAbout);
    favouriteBtn.addEventListener('click', () => toggleFavourite(false));

    // Keyboard support
    document.addEventListener('keydown', (e) => {
      if (favouritesView.hidden && aboutView.hidden) {
        if (e.key === 'ArrowLeft') {
          // Left = Prev in typical slideshows, but here we want "Back"
          goToPreviousMeditation();
        } else if (e.key === 'ArrowRight') {
          // Right = Next
          goToNextMeditation();
        } else if (e.key === ' ' || e.key === 'Enter') {
          toggleFavourite();
        }
      } else {
        if (e.key === 'Escape') {
          hideFavourites();
          hideAbout();
        }
      }
    });
  }

  // --- Start ---
  document.addEventListener('DOMContentLoaded', init);
})();
