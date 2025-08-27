// Lazy Spy Content Script
class ImageLoadingOptimizer {
  constructor() {
    this.isActive = false;
    this.showingAll = false;
    this.images = new Map();
    this.lcpCandidate = null;
    this.heroOverlayEl = null;
    this.heroTargetImg = null;
    this.boundUpdateHero = null;
    this.preloadedImages = new Set();
    this.libraryDetector = null; // Will be initialized when needed
    this.detectedLibraries = new Set();
    this.performanceData = {
      totalImages: 0,
      lazyLoaded: 0,
      eagerLoaded: 0,
      optimized: 0,
      issues: 0,
      lcpCandidates: 0,
      lcpValue: null, // Actual LCP time in milliseconds
      preloaded: 0,
      detectedLibraries: []
    };
    this.lcpValue = null; // Store the actual LCP value
    this.fileSizeCache = new Map();
    
    this.init();
  }

  init() {
    // Initialize library detector
    this.initializeLibraryDetector();
    
    // Listen for messages from popup/background
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      try {
        if (request.action === 'toggle') {
          this.toggle();
          const isActive = Boolean(this.isActive);
          sendResponse({ success: true, isActive: isActive });
        } else if (request.action === 'getStats') {
          // Ensure LCP data is included in performance data
          const statsToSend = {
            ...this.performanceData,
            lcpValue: this.lcpValue,
            lcpCandidate: this.lcpCandidate?.src,
            detectedLibraries: Array.from(this.detectedLibraries)
          };

          sendResponse({ stats: statsToSend });
        } else if (request.action === 'getDetailedImageData') {
          sendResponse({ images: this.getDetailedImageData() });
        } else if (request.action === 'toggleShowAll') {
          this.toggleShowAll();
          sendResponse({ success: true, showingAll: this.showingAll });
        } else if (request.action === 'getLibraryInfo') {
          sendResponse({ 
            detectedLibraries: Array.from(this.detectedLibraries),
            libraryDetails: this.getLibraryDetails()
          });
        } else if (request.action === 'ping') {
          // Simple ping to check if content script is ready
          sendResponse({ success: true, ready: true });
        } else {
          // Handle unknown actions
          sendResponse({ error: 'Unknown action: ' + request.action, success: false });
        }
      } catch (error) {
        console.error('Image Loading Optimizer: Error handling message:', error);
        sendResponse({ error: 'Internal error: ' + error.message, success: false });
      }
    });

    // Detect preloaded images from head
    this.detectPreloadedImages();
    
    // Set up mutation observer for dynamic content
    this.setupMutationObserver();
    
    // Note: LCP observer will be set up when extension is activated
  }

  initializeLibraryDetector() {
    // Initialize the library detector
    if (typeof LibraryDetector !== 'undefined') {
      this.libraryDetector = new LibraryDetector();
      this.detectLibrariesOnPage();
    } else {
      }
  }

  detectLibrariesOnPage() {
    // Ensure library detector is initialized
    if (!this.libraryDetector) {
      this.initializeLibraryDetector();
    }
    
    if (!this.libraryDetector) {
      this.detectLibrariesFallback();
      return;
    }
    
    try {
      const results = this.libraryDetector.detectLibraries();
      // Store detected libraries
      this.detectedLibraries.clear();
      results.detected.forEach(lib => {
        this.detectedLibraries.add(lib.name);
      });
      
      // Update performance data
      this.performanceData.detectedLibraries = Array.from(this.detectedLibraries);
    } catch (error) {
      console.error('Image Loading Optimizer: Error detecting libraries:', error);
      // Fallback to basic detection
      this.detectLibrariesFallback();
    }
  }

  detectLibrariesFallback() {
    this.detectedLibraries.clear();
    
    // Check for common lazy loading patterns
    const images = document.querySelectorAll('img');
    
    // Check for native lazy loading
    const nativeLazy = document.querySelectorAll('img[loading="lazy"]');
    if (nativeLazy.length > 0) {
      this.detectedLibraries.add('native');
      }
    
    // Check for LazySizes patterns
    const lazySizesImages = document.querySelectorAll('img[data-src], img[data-srcset]');
    if (lazySizesImages.length > 0) {
      this.detectedLibraries.add('lazysizes');
      }
    
    // Check for LoZad patterns
    const lozadImages = document.querySelectorAll('img[data-src]');
    if (lozadImages.length > 0 && !this.detectedLibraries.has('lazysizes')) {
      this.detectedLibraries.add('lozad');
      }
    
    // Check for custom patterns
    const customImages = document.querySelectorAll('img[data-lazy], img[data-original], img.lazy-load, img.lazy-image');
    if (customImages.length > 0) {
      this.detectedLibraries.add('custom');
      }
    
    // Check for Intersection Observer usage
    if (window.IntersectionObserver && document.querySelectorAll('[data-observe]').length > 0) {
      this.detectedLibraries.add('intersection-observer');
      }
    
    // Update performance data
    this.performanceData.detectedLibraries = Array.from(this.detectedLibraries);
  }

  getLibraryDetails() {
    if (!this.libraryDetector) return {};
    
    const details = {};
    this.detectedLibraries.forEach(libName => {
      const lib = this.libraryDetector.libraries[libName];
      if (lib) {
        details[libName] = {
          detected: lib.detected,
          usageCount: lib.usageCount,
          recommendations: lib.recommendations,
          migrationGuide: this.libraryDetector.generateMigrationGuide(libName)
        };
      }
    });
    return details;
  }

  toggle() {
    this.isActive = !this.isActive;
    if (this.isActive) {
      try {
        // Clear previous data and re-analyze everything
        this.images.clear();
        this.resetPerformanceData();
        // Don't reset LCP candidate - preserve the real LCP measurement
        
        // Set up LCP observer when activating
        this.setupLCPObserver();
        
        // Re-detect libraries when activating
        this.detectLibrariesOnPage();
        
        this.analyzePage();
        // Force LCP detection after a short delay
        setTimeout(() => {
          if (!this.lcpCandidate) {
            this.detectLCPFallback();
          }
        }, 1500);

        // Bind scroll/resize for potential hero overlay maintenance
        if (!this.boundUpdateHero) {
          this.boundUpdateHero = () => this.updateHeroOverlayPosition();
          window.addEventListener('scroll', this.boundUpdateHero, true);
          window.addEventListener('resize', this.boundUpdateHero, true);
        }
        
        } catch (error) {
        console.error('Image Loading Optimizer: Error during activation:', error);
        // Don't change isActive state on error
        this.isActive = false;
      }
    } else {
      try {
        this.removeOverlays();
        this.removeHeroOverlay();
        this.cleanupPeriodicDetection(); // Clean up periodic detection
        
        // Clear any LCP highlights when deactivating
        this.clearPreviousLCPFlag();
        
        if (this.boundUpdateHero) {
          window.removeEventListener('scroll', this.boundUpdateHero, true);
          window.removeEventListener('resize', this.boundUpdateHero, true);
          this.boundUpdateHero = null;
        }
        } catch (error) {
        console.error('Image Loading Optimizer: Error during deactivation:', error);
      }
    }
  }

  detectPreloadedImages() {
    try {
      const preloadLinks = document.querySelectorAll('link[rel="preload"][as="image"]');
      preloadLinks.forEach(link => {
        const href = link.href;
        // Validate href to prevent invalid preload link warnings
        if (href && href !== 'null' && href !== 'undefined' && href.trim() !== '' && href !== window.location.href) {
          this.preloadedImages.add(href);
        } else {
          // Log invalid preload links for debugging
          console.warn('Invalid preload link href detected:', href);
        }
      });
    } catch (error) {
      console.error('Error detecting preloaded images:', error);
    }
  }

  setupLCPObserver() {
    if ('PerformanceObserver' in window) {
      try {
        // Finalize LCP markings after a short window so hover/late paints don't flip UI
        if (!this.lcpFinalizeTimer) {
          this.lcpFinalized = false;
          this.lcpFinalizeTimer = setTimeout(() => { this.lcpFinalized = true; }, 5000);
        }
        const lcpObserver = new PerformanceObserver((list) => {
          // Only process LCP events when extension is active
          if (!this.isActive) return;
          
          const entries = list.getEntries();
          const entry = entries[entries.length - 1]; // only evaluate the most recent candidate
          if (!entry) return;
          if (this.lcpFinalized) return;
            const el = entry.element;
            if (!el) return;

            // Case 1: standard <img>
            if (el.tagName === 'IMG') {
              // Clear previous LCP flag if any
              this.clearPreviousLCPFlag();
              this.lcpCandidate = el;
              this.lcpValue = entry.startTime;
              this.updateImageData(el, { isLCP: true, lcpValue: entry.startTime });
              this.notifyPopupOfLCPDetection();
              return;
            }

            // Case 2: SVG <image>
            if (el.tagName === 'IMAGE' || window.SVGImageElement && el instanceof SVGImageElement) {
              try {
                const href = el.href?.baseVal || el.getAttribute('href') || el.getAttribute('xlink:href');
                if (href) {
                  this.clearPreviousLCPFlag();
                  this.lcpCandidate = el; // Track the element for consistency
                  this.lcpValue = entry.startTime;
                  const virtualImg = { src: href, width: el.clientWidth, height: el.clientHeight, naturalWidth: el.clientWidth, naturalHeight: el.clientHeight };
                  this.analyzeBackgroundImageElement(el, virtualImg);
                  // Mark as LCP by re-processing with flag via setting lcpCandidate then calling analyze again
                  this.analyzeBackgroundImageElement(el, virtualImg);
                  this.notifyPopupOfLCPDetection();
                  return;
                }
              } catch (e) { }
            }

            // Case 3: element with CSS background-image
            try {
              const style = window.getComputedStyle(el);
              const bg = style.backgroundImage;
              if (bg && bg !== 'none' && bg.includes('url(')) {
                const m = bg.match(/url\(['"]?([^'"]+)['"]?\)/);
                const src = m && m[1];
                if (src) {
                  this.clearPreviousLCPFlag();
                  this.lcpCandidate = el; // Use element for background LCP
                  this.lcpValue = entry.startTime;
                  const virtualImg = { src, width: el.clientWidth, height: el.clientHeight, naturalWidth: el.clientWidth, naturalHeight: el.clientHeight };
                  this.analyzeBackgroundImageElement(el, virtualImg);
                  this.notifyPopupOfLCPDetection();
                  return;
                }
              }
            } catch (e) { }

            // Case 4: text/content LCP - store value only
            this.clearPreviousLCPFlag();
            this.lcpCandidate = null; // Not an image
            this.lcpValue = entry.startTime;
            // Draw a purple outline around the element to make it visible
            this.showElementLCPOverlay(el);
            this.notifyPopupOfLCPDetection();
        });

        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        } catch (e) {
        // Fall back to periodic detection
        this.setupPeriodicLCPDetection();
      }
    } else {
      this.setupPeriodicLCPDetection();
    }
  }

  setupPeriodicLCPDetection() {
    // Fallback: Check for LCP every few seconds
    this.lcpCheckInterval = setInterval(() => {
      if (this.isActive && !this.lcpCandidate) {
        this.detectLCPFallback();
      }
    }, 2000);

    // Stop after 15 seconds
    setTimeout(() => {
      if (this.lcpCheckInterval) {
        clearInterval(this.lcpCheckInterval);
        this.lcpCheckInterval = null;
      }
    }, 15000);
  }

  cleanupPeriodicDetection() {
    if (this.lcpCheckInterval) {
      clearInterval(this.lcpCheckInterval);
      this.lcpCheckInterval = null;
      }
  }

  setupMutationObserver() {
    const observer = new MutationObserver((mutations) => {
      if (!this.isActive) return;
      
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === 'IMG') {
              this.analyzeImage(node);
            } else {
              const images = node.querySelectorAll('img');
              images.forEach(img => this.analyzeImage(img));
            }
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Clean up hero overlay on route changes or DOM mutations
    this.cleanupHeroOverlayIfDetached();
  }

  analyzePage() {
    const images = document.querySelectorAll('img');
    // Compute one probable LCP candidate heuristically (largest visible above-fold non-lazy image)
    this.probableLCP = null;
    try {
      let bestArea = 0;
      images.forEach(img => {
        const rect = img.getBoundingClientRect();
        const isAboveFold = rect.top < window.innerHeight && rect.bottom > 0;
        const isVisible = rect.width > 0 && rect.height > 0;
        const isNativeLazy = img.loading === 'lazy';
        const hasJsLazyAttrs = img.hasAttribute('data-src') || img.hasAttribute('data-srcset') || img.classList.contains('lazy') || img.classList.contains('lazyload');
        if (!isAboveFold || !isVisible || isNativeLazy || hasJsLazyAttrs) return;
        const area = rect.width * rect.height;
        if (area > bestArea) {
          bestArea = area;
          this.probableLCP = img;
        }
      });
      if (this.probableLCP) {
        }
    } catch (e) {
      this.probableLCP = null;
    }

    images.forEach(img => this.analyzeImage(img));
    
    // Also check picture elements
    const pictures = document.querySelectorAll('picture');
    pictures.forEach(picture => {
      const img = picture.querySelector('img');
      if (img) this.analyzeImage(img);
    });
    
    // Detect carousel and background images
    this.detectCarouselImages();
    this.detectBackgroundImages();
    
    // Try to detect LCP image if not already detected
    if (!this.lcpCandidate) {
      // Give the browser a moment to determine LCP, then use fallback
      setTimeout(() => {
        if (!this.lcpCandidate) {
          this.detectLCPFallback();
        }
      }, 1000);
    }
    
    }

  detectCarouselImages() {
    // Common carousel selectors
    const carouselSelectors = [
      '.carousel',
      '.carouselContent',
      '.js-carouselContent',
      '.slider',
      '.gallery',
      '.image-gallery',
      '.photo-gallery',
      '.image-carousel',
      '.photo-carousel',
      '[data-carousel]',
      '[data-slider]',
      '[data-gallery]',
      '.swiper-container',
      '.slick-slider',
      '.owl-carousel',
      '.flexslider',
      '.bxslider'
    ];
    
    carouselSelectors.forEach(selector => {
      const carousels = document.querySelectorAll(selector);
      carousels.forEach(carousel => {
        this.analyzeCarousel(carousel);
      });
    });
    
    // Also look for elements with carousel-like classes or attributes
    const allElements = document.querySelectorAll('*');
    allElements.forEach(element => {
      try {
        // Check if element has classList and it's iterable
        if (element.classList && typeof element.classList.forEach === 'function') {
          let hasCarouselClass = false;
          element.classList.forEach(className => {
            if (typeof className === 'string' && (
              className.includes('carousel') || 
              className.includes('slider') || 
              className.includes('gallery') ||
              className.includes('swiper') ||
              className.includes('slick') ||
              className.includes('owl') ||
              className.includes('flexslider') ||
              className.includes('bxslider')
            )) {
              hasCarouselClass = true;
            }
          });
          
          if (hasCarouselClass && !element.querySelector('.carousel, .slider, .gallery')) {
            this.analyzeCarousel(element);
          }
        } else {
          // Fallback for elements without classList
          const className = element.className || '';
          const hasCarouselClass = className.includes('carousel') || 
                                  className.includes('slider') || 
                                  className.includes('gallery') ||
                                  className.includes('swiper') ||
                                  className.includes('slick') ||
                                  className.includes('owl') ||
                                  className.includes('flexslider') ||
                                  className.includes('bxslider');
          
          if (hasCarouselClass && !element.querySelector('.carousel, .slider, .gallery')) {
            this.analyzeCarousel(element);
          }
        }
      } catch (error) {
        }
    });
  }

  analyzeCarousel(carousel) {
    // Find all images within the carousel
    const images = carousel.querySelectorAll('img');
    const backgroundImages = this.findBackgroundImagesInElement(carousel);
    
    // Analyze regular images
    images.forEach(img => {
      if (!this.images.has(img)) {
        // Mark as carousel image for special styling
        const data = this.detectLoadingStrategy(img);
        data.isCarousel = true;
        this.images.set(img, data);
        this.updatePerformanceData(data);
        this.applyOverlay(img, data);
      }
    });
    
    // Analyze background images
    backgroundImages.forEach(bgData => {
      this.analyzeBackgroundImageElement(bgData.element, bgData.virtualImg, true);
    });
    
    // Add carousel-specific recommendations
    this.addCarouselRecommendations(carousel, images.length + backgroundImages.length);
  }

  findBackgroundImagesInElement(element) {
    const backgroundImages = [];
    
    // Recursively find all child elements with background images
    const findBgImages = (el) => {
      const style = window.getComputedStyle(el);
      const backgroundImage = style.backgroundImage;
      
      if (backgroundImage && backgroundImage !== 'none' && backgroundImage.includes('url(')) {
        const urlMatch = backgroundImage.match(/url\(['"]?([^'"]+)['"]?\)/);
        if (urlMatch && urlMatch[1]) {
          const url = urlMatch[1];
          
          // Create a virtual image element for analysis
          const virtualImg = {
            src: url,
            width: el.offsetWidth,
            height: el.offsetHeight,
            naturalWidth: el.offsetWidth,
            naturalHeight: el.offsetHeight,
            loading: 'eager',
            fetchPriority: null,
            decoding: null,
            hasAttribute: () => false,
            getAttribute: () => null,
            classList: { contains: () => false },
            tagName: 'DIV',
            style: { backgroundImage: backgroundImage },
            parentElement: el
          };
          
          backgroundImages.push({
            element: el,
            virtualImg: virtualImg
          });
        }
      }
      
      // Check children
      el.childNodes.forEach(child => {
        if (child.nodeType === Node.ELEMENT_NODE) {
          findBgImages(child);
        }
      });
    };
    
    findBgImages(element);
    return backgroundImages;
  }

  addCarouselRecommendations(carousel, imageCount) {
    const recommendations = [];
    
    if (imageCount > 10) {
      recommendations.push('Consider lazy loading non-visible carousel images');
    }
    
    if (imageCount > 5) {
      recommendations.push('Optimize carousel images for faster loading');
    }
    
    // Check if carousel has proper loading attributes
    const firstImage = carousel.querySelector('img');
    if (firstImage && !firstImage.loading) {
      recommendations.push('Add loading="lazy" to carousel images');
    }
    
    // Store carousel recommendations
    if (recommendations.length > 0) {
      this.carouselRecommendations = this.carouselRecommendations || [];
      this.carouselRecommendations.push({
        carousel: carousel,
        recommendations: recommendations
      });
    }
  }

  detectBackgroundImages() {
    // Find elements with background-image CSS
    const elementsWithBg = document.querySelectorAll('*');
    let bgCount = 0;
    
    elementsWithBg.forEach(element => {
      try {
        const style = window.getComputedStyle(element);
        const backgroundImage = style.backgroundImage;
        
        if (backgroundImage && backgroundImage !== 'none' && backgroundImage.includes('url(')) {
          // Extract URL from background-image
          const urlMatch = backgroundImage.match(/url\(['"]?([^'"]+)['"]?\)/);
          if (urlMatch && urlMatch[1]) {
            const url = urlMatch[1];
            
            // Skip if this is already a carousel element (handled separately)
            if (element.closest('.carousel, .carouselContent, .js-carouselContent, .slider, .gallery')) {
              return;
            }
            
            // Create a virtual image element for analysis
            const virtualImg = {
              src: url,
              width: element.offsetWidth,
              height: element.offsetHeight,
              naturalWidth: element.offsetWidth,
              naturalHeight: element.offsetHeight,
              loading: 'eager', // Background images are typically eager loaded
              fetchPriority: null,
              decoding: null,
              hasAttribute: () => false,
              getAttribute: () => null,
              classList: { contains: () => false },
              tagName: 'DIV',
              style: { backgroundImage: backgroundImage }
            };
            
            // Analyze the background image
            this.analyzeBackgroundImageElement(element, virtualImg);
            bgCount++;
          }
        }
      } catch (error) {
        }
    });
    
    }

  analyzeImage(img) {
    if (this.images.has(img)) return;
    
    const data = this.detectLoadingStrategy(img);
    
    // Check if image is above fold and lazy loaded (performance issue)
    const rect = img.getBoundingClientRect();
    const isAboveFold = rect.top < window.innerHeight;
    data.isAboveFold = isAboveFold;
    
    // Flag lazy loading above fold as an issue
    if (isAboveFold && data.strategy === 'lazy') {
      data.recommendations.push('Issue: Lazy loading above fold - should be eager loaded');
      data.hasAboveFoldLazyIssue = true;
    }
    
    // Add advanced optimization analysis
    const optimizationAnalysis = this.analyzeImageOptimization(img);
    data.optimization = optimizationAnalysis;
    
    // Add optimization recommendations to the main recommendations array
    this.addOptimizationRecommendations(data, optimizationAnalysis);
    
    this.images.set(img, data);
    this.updatePerformanceData(data);
    this.applyOverlay(img, data);
  }

  detectLoadingStrategy(img) {
    const data = {
      src: img.src,
      loading: img.loading,
      fetchPriority: img.fetchPriority,
      decoding: img.decoding,
      width: img.width,
      height: img.height,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      strategy: 'unknown',
      library: null,
      isLCP: false,
      isPreloaded: false,
      hasDimensions: !!(img.width && img.height),
      position: this.getImagePosition(img),
      fileSize: this.estimateFileSize(img),
      recommendations: []
    };

    // Check if preloaded
    if (this.preloadedImages.has(img.src)) {
      data.isPreloaded = true;
      data.strategy = 'preload';
    }

    // Check if LCP candidate
    if (img === this.lcpCandidate) {
      data.isLCP = true;
      data.strategy = 'lcp';
    }

    // Detect loading strategy
    if (data.loading === 'lazy') {
      data.strategy = 'lazy';
      data.library = 'native';
    } else if (data.loading === 'eager') {
      data.strategy = 'eager';
    } else {
      // Check for JavaScript lazy loading
      const jsLazy = this.detectJSLazyLoading(img);
      if (jsLazy) {
        data.strategy = 'lazy';
        data.library = jsLazy;
      } else {
        data.strategy = 'eager';
      }
    }

    // Generate recommendations
    data.recommendations = this.generateRecommendations(data);

    // Determine overall strategy
    data.strategy = this.calculateOverallStrategy(data);

    return data;
  }

  detectJSLazyLoading(img) {
    // Enhanced library detection patterns
    const libraryPatterns = [
      // LazySizes patterns
      { attr: 'data-src', library: 'lazysizes', priority: 1 },
      { attr: 'data-srcset', library: 'lazysizes', priority: 1 },
      { attr: 'data-sizes', library: 'lazysizes', priority: 1 },
      { class: 'lazyload', library: 'lazysizes', priority: 1 },
      { class: 'lazyloaded', library: 'lazysizes', priority: 1 },
      
      // LoZad patterns
      { attr: 'data-src', library: 'lozad', priority: 2 },
      { class: 'lozad', library: 'lozad', priority: 2 },
      
      // React Lazy Load patterns
      { class: 'react-lazy-load', library: 'react-lazy-load', priority: 3 },
      { attr: 'data-lazy', library: 'react-lazy-load', priority: 3 },
      
      // Vue LazyLoad patterns
      { class: 'v-lazy', library: 'vue-lazyload', priority: 4 },
      { class: 'v-lazy-container', library: 'vue-lazyload', priority: 4 },
      
      // Custom patterns
      { attr: 'data-lazy', library: 'custom', priority: 5 },
      { attr: 'data-original', library: 'custom', priority: 5 },
      { class: 'lazy', library: 'custom', priority: 5 },
      { class: 'lazy-image', library: 'custom', priority: 5 },
      { class: 'lazy-load', library: 'custom', priority: 5 }
    ];

    // Check patterns in priority order (lower number = higher priority)
    const detectedLibraries = [];
    
    for (const pattern of libraryPatterns) {
      let detected = false;
      
      if (pattern.attr && img.hasAttribute(pattern.attr)) {
        detected = true;
      } else if (pattern.class && img.classList.contains(pattern.class)) {
        detected = true;
      }
      
      if (detected) {
        detectedLibraries.push({
          library: pattern.library,
          priority: pattern.priority,
          pattern: pattern.attr || pattern.class
        });
      }
    }

    // Return the highest priority library detected
    if (detectedLibraries.length > 0) {
      detectedLibraries.sort((a, b) => a.priority - b.priority);
      const primaryLibrary = detectedLibraries[0].library;
      
      // Add to detected libraries set
      this.detectedLibraries.add(primaryLibrary);
      
      return primaryLibrary;
    }

    // Check for global objects (fallback)
    if (window.lazySizes || window.LazySizes) {
      this.detectedLibraries.add('lazysizes');
      return 'lazysizes';
    }
    if (window.lozad) {
      this.detectedLibraries.add('lozad');
      return 'lozad';
    }
    if (window.LazyLoad) {
      this.detectedLibraries.add('lazyload');
      return 'lazyload';
    }

    // Only check for Intersection Observer if the image has lazy loading attributes
    // or is explicitly marked as lazy
    if ('IntersectionObserver' in window && (img.loading === 'lazy' || img.hasAttribute('data-src'))) {
      // Look for Intersection Observer usage in the page
      const hasIntersectionObserverUsage = this.checkIntersectionObserverUsage();
      if (hasIntersectionObserverUsage) {
        this.detectedLibraries.add('intersection-observer');
        return 'intersection-observer';
      }
    }

    return null;
  }

  checkIntersectionObserverUsage() {
    // Check for Intersection Observer usage in scripts
    const scripts = document.querySelectorAll('script');
    const scriptContent = Array.from(scripts)
      .map(script => script.textContent || '')
      .join(' ');
    
    const intersectionObserverPatterns = [
      'IntersectionObserver',
      'new IntersectionObserver',
      'intersection-observer',
      'intersectionobserver'
    ];
    
    return intersectionObserverPatterns.some(pattern => 
      scriptContent.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  getIntersectionObservers() {
    // This is a simplified approach - in a real implementation,
    // you might need to track observers more carefully
    return [];
  }

  getImagePosition(img) {
    try {
      // Handle virtual images (background images) that don't have getBoundingClientRect
      if (img.parentElement && typeof img.parentElement.getBoundingClientRect === 'function') {
        const rect = img.parentElement.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        
        if (rect.top < viewportHeight) {
          return 'above-fold';
        } else {
          return 'below-fold';
        }
      }
      
      // Handle regular images
      if (typeof img.getBoundingClientRect === 'function') {
        const rect = img.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        
        if (rect.top < viewportHeight) {
          return 'above-fold';
        } else {
          return 'below-fold';
        }
      }
      
      // Fallback for virtual images without parent element
      return 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  estimateFileSize(img) {
    try {
      const url = new URL(img.currentSrc || img.src, location.href).href;
      
      // Method 1: Use PerformanceResourceTiming for already loaded images
      const entries = performance.getEntriesByType('resource');
      const match = entries.find(e => e.name === url);
      if (match && typeof match.transferSize === 'number' && match.transferSize > 0) {
        const kb = Math.round(match.transferSize / 1024);
        return kb > 1024 ? `${Math.round(kb / 1024)}MB` : `${kb}KB`;
      }
      
      // Method 2: Try to fetch HEAD request for file size
      if (!this.fileSizeCache) {
        this.fileSizeCache = new Map();
      }
      
      if (this.fileSizeCache.has(url)) {
        return this.fileSizeCache.get(url);
      }
      
      // Method 3: Estimate based on image dimensions and format
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      
      if (width && height) {
        const pixels = width * height;
        let estimatedSize;
        
        // Rough estimation based on image format and quality
        if (url.includes('.webp') || url.includes('.avif')) {
          estimatedSize = Math.round(pixels * 0.1 / 1024); // WebP/AVIF: ~0.1 bytes per pixel
        } else if (url.includes('.png')) {
          estimatedSize = Math.round(pixels * 0.3 / 1024); // PNG: ~0.3 bytes per pixel
        } else if (url.includes('.jpg') || url.includes('.jpeg')) {
          estimatedSize = Math.round(pixels * 0.2 / 1024); // JPEG: ~0.2 bytes per pixel
        } else {
          estimatedSize = Math.round(pixels * 0.25 / 1024); // Default: ~0.25 bytes per pixel
        }
        
        if (estimatedSize > 0) {
          const result = estimatedSize > 1024 ? `${Math.round(estimatedSize / 1024)}MB` : `${estimatedSize}KB`;
          this.fileSizeCache.set(url, result);
          return result;
        }
      }
      
    } catch (error) {
      }

    // Fallback: unknown if not measurable
    return 'Unknown';
  }

  async fetchFileSize(url) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        const bytes = parseInt(contentLength, 10);
        const kb = Math.round(bytes / 1024);
        const result = kb > 1024 ? `${Math.round(kb / 1024)}MB` : `${kb}KB`;
        this.fileSizeCache.set(url, result);
        return result;
      }
    } catch (error) {
      }
    return 'Unknown';
  }

  generateRecommendations(data) {
    const recommendations = [];

    if (!data.hasDimensions) {
      recommendations.push('Add width and height attributes to prevent CLS');
    }

    // Check for lazy loading above-fold (performance issue)
    if (data.strategy === 'lazy' && data.position === 'above-fold') {
      recommendations.push('Avoid lazy loading above-fold images - this hurts LCP');
    }

    if (data.strategy === 'eager' && data.position === 'below-fold') {
      recommendations.push('Consider lazy loading for below-fold images');
    }

    if (data.isLCP && !data.isPreloaded) {
      recommendations.push('Preload LCP image for better performance');
    }

    if (data.fetchPriority !== 'high' && data.isLCP) {
      recommendations.push('Set fetchpriority="high" for LCP image');
    }

    if (data.decoding !== 'async') {
      recommendations.push('Add decoding="async" for non-blocking decode');
    }

    return recommendations;
  }

  calculateOverallStrategy(data) {
    if (data.isLCP) return 'lcp';
    if (data.isPreloaded) return 'preload';
    
    // If a library is detected, it's managed by that library (lazy loading)
    if (data.library && data.library !== 'none') {
      // Check if optimized (lazy + below-fold + has dimensions)
      const isOptimized = (
        data.position === 'below-fold' &&
        data.hasDimensions
      );
      
      if (isOptimized) return 'optimized';
      
      // Check for issues
      const hasIssues = (
        !data.hasDimensions ||
        data.recommendations.length > 2
      );
      
      if (hasIssues) return 'issue';
      
      return 'lazy';
    }
    
    // No library detected - use original logic
    // Check if optimized
    const isOptimized = (
      data.strategy === 'lazy' && 
      data.position === 'below-fold' &&
      data.hasDimensions
    );
    
    if (isOptimized) return 'optimized';
    
    // Check for issues
    const hasIssues = (
      !data.hasDimensions ||
      (data.strategy === 'eager' && data.position === 'below-fold') ||
      data.recommendations.length > 2
    );
    
    if (hasIssues) return 'issue';
    
    return data.strategy;
  }

  getLoadingLabel(data) {
    // If a library is detected, it's managed by that library regardless of current loading state
    if (data.library && data.library !== 'none') {
      if (data.library === 'native') return 'Lazy (native)';
      if (data.library === 'lazysizes') return 'Lazy (LazySizes)';
      if (data.library === 'lozad') return 'Lazy (LoZad)';
      if (data.library === 'react-lazy-load') return 'Lazy (React LazyLoad)';
      if (data.library === 'vue-lazyload') return 'Lazy (Vue LazyLoad)';
      if (data.library === 'intersection-observer') return 'Lazy (IntersectionObserver)';
      if (data.library === 'custom') return 'Lazy (custom)';
      return `Lazy (${this.getLibraryDisplayName(data.library)})`;
    }
    
    // No library detected - check native loading attribute
    const isLazy = data.strategy === 'lazy';
    if (isLazy) {
      return 'Lazy (native)';
    }
    
    return 'Eager (native/no library)';
  }

  getLibraryDisplayName(library) {
    const displayNames = {
      'lazysizes': 'LazySizes',
      'lozad': 'LoZad',
      'react-lazy-load': 'React',
      'vue-lazyload': 'Vue',
      'intersection-observer': 'IO',
      'custom': 'Custom',
      'native': 'Native'
    };
    return displayNames[library] || library;
  }

  getStrategyIcon(strategy) {
    const icons = {
      'optimized': '<span style="display: inline-block; width: 16px; height: 16px; background: #10b981; border-radius: 50%; margin-right: 8px; vertical-align: middle;"></span>',
      'lazy': '<span style="display: inline-block; width: 16px; height: 16px; background: #3b82f6; border-radius: 50%; margin-right: 8px; vertical-align: middle;"></span>',
      'eager': '<span style="display: inline-block; width: 16px; height: 16px; background: #f59e0b; border-radius: 50%; margin-right: 8px; vertical-align: middle;"></span>',
      'issue': '<span style="display: inline-block; width: 16px; height: 16px; background: #ef4444; border-radius: 50%; margin-right: 8px; vertical-align: middle;"></span>',
      'preload': '<span style="display: inline-block; width: 16px; height: 16px; background: #008080; border-radius: 50%; margin-right: 8px; vertical-align: middle;"></span>',
      'lcp': '<span style="display: inline-block; width: 16px; height: 16px; background: #8b5cf6; border-radius: 50%; margin-right: 8px; vertical-align: middle;"></span>'
    };
    return icons[strategy] || '';
  }

  // Advanced Analysis Methods
  analyzeImageOptimization(img) {
    const analysis = {
      missingDimensions: this.analyzeMissingDimensions(img),
      formatOptimization: this.analyzeFormatOptimization(img),
      responsiveImage: this.analyzeResponsiveImage(img),
      fileSizeOptimization: this.analyzeFileSizeOptimization(img),
      cdnAnalysis: this.analyzeCDN(img),
      heroImageAnalysis: this.analyzeHeroImage(img),
      backgroundImageAnalysis: this.analyzeBackgroundImage(img),
      serviceWorkerAnalysis: this.analyzeServiceWorker(img),
      fetchPriorityAnalysis: this.analyzeFetchPriority(img),
      preloadAnalysis: this.analyzePreloadOpportunity(img)
    };

    return analysis;
  }

  analyzeMissingDimensions(img) {
    const hasWidth = img.hasAttribute('width') || img.style.width;
    const hasHeight = img.hasAttribute('height') || img.style.height;
    
    if (!hasWidth || !hasHeight) {
      const rect = img.getBoundingClientRect();
      const naturalWidth = img.naturalWidth;
      const naturalHeight = img.naturalHeight;
      
      return {
        missing: !hasWidth || !hasHeight,
        suggestedWidth: hasWidth ? null : Math.round(rect.width || naturalWidth),
        suggestedHeight: hasHeight ? null : Math.round(rect.height || naturalHeight),
        aspectRatio: naturalWidth && naturalHeight ? (naturalWidth / naturalHeight).toFixed(2) : null,
        recommendation: `Add width="${Math.round(rect.width || naturalWidth)}" height="${Math.round(rect.height || naturalHeight)}" to prevent layout shift`
      };
    }
    
    return { missing: false };
  }

  analyzeFormatOptimization(img) {
    const src = img.src || img.currentSrc;
    if (!src) return { canOptimize: false };

    const url = new URL(src, window.location.href);
    const pathname = url.pathname.toLowerCase();
    const isJPEG = pathname.includes('.jpg') || pathname.includes('.jpeg');
    const isPNG = pathname.includes('.png');
    const isWebP = pathname.includes('.webp');
    const isAVIF = pathname.includes('.avif');

    if (isJPEG || isPNG) {
      const fileSize = this.getFileSize(img);
      const estimatedSavings = fileSize ? Math.round(fileSize * 0.4) : null;
      
      return {
        canOptimize: true,
        currentFormat: isJPEG ? 'JPEG' : 'PNG',
        suggestedFormat: 'WebP',
        estimatedSavings: estimatedSavings,
        recommendation: `Convert to WebP for ~${estimatedSavings ? estimatedSavings + 'KB' : '40%'} smaller file size`
      };
    }

    return { canOptimize: false };
  }

  analyzeResponsiveImage(img) {
    const hasSrcset = img.hasAttribute('srcset');
    const hasSizes = img.hasAttribute('sizes');
    const hasDataSrcset = img.hasAttribute('data-srcset');
    
    if (!hasSrcset && !hasDataSrcset) {
      const naturalWidth = img.naturalWidth;
      const isHighDPI = window.devicePixelRatio > 1;
      
      return {
        missing: true,
        isHighDPI: isHighDPI,
        naturalWidth: naturalWidth,
        recommendation: isHighDPI ? 
          `Add srcset for high-DPI displays (${window.devicePixelRatio}x)` :
          'Consider adding srcset for responsive images'
      };
    }
    
    return { missing: false };
  }

  analyzeFileSizeOptimization(img) {
    const fileSize = this.getFileSize(img);
    if (!fileSize) return { needsOptimization: false };

    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;
    const displayWidth = img.width || img.getBoundingClientRect().width;
    const displayHeight = img.height || img.getBoundingClientRect().height;
    
    const isOversized = naturalWidth > displayWidth * 2 || naturalHeight > displayHeight * 2;
    const isLargeFile = fileSize > 500; // 500KB threshold
    
    if (isOversized || isLargeFile) {
      return {
        needsOptimization: true,
        fileSize: fileSize,
        isOversized: isOversized,
        isLargeFile: isLargeFile,
        recommendation: isOversized ? 
          `Image is ${Math.round(naturalWidth/displayWidth)}x larger than needed. Resize to ${Math.round(displayWidth)}x${Math.round(displayHeight)}` :
          `Large file (${fileSize}KB). Consider compression or format conversion`
      };
    }
    
    return { needsOptimization: false };
  }

  analyzeCDN(img) {
    const src = img.src || img.currentSrc;
    if (!src) return { detected: false };

    const url = new URL(src, window.location.href);
    const hostname = url.hostname.toLowerCase();
    
    const cdnPatterns = {
      'cloudinary': { name: 'Cloudinary', optimizations: ['Auto-format', 'Auto-quality', 'Responsive'] },
      'imgix': { name: 'Imgix', optimizations: ['Auto-format', 'Quality optimization', 'Responsive'] },
      'cloudflare': { name: 'Cloudflare Images', optimizations: ['WebP/AVIF', 'Auto-resize', 'Quality optimization'] },
      'akamai': { name: 'Akamai Image Manager', optimizations: ['Format optimization', 'Responsive', 'Compression'] },
      'fastly': { name: 'Fastly Image Optimizer', optimizations: ['Auto-format', 'Quality optimization'] }
    };

    for (const [pattern, cdn] of Object.entries(cdnPatterns)) {
      if (hostname.includes(pattern)) {
        return {
          detected: true,
          cdn: cdn.name,
          optimizations: cdn.optimizations,
          url: url.href
        };
      }
    }
    
    return { detected: false };
  }

  analyzeHeroImage(img) {
    const rect = img.getBoundingClientRect();
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;
    const isAboveFold = rect.top < window.innerHeight;
    const isLarge = naturalWidth >= 800 && naturalHeight >= 600;
    const isProminent = rect.width >= 400 && rect.height >= 300;
    const hasHighPriority = img.fetchPriority === 'high';
    
    const heroScore = (isAboveFold ? 3 : 0) + (isLarge ? 2 : 0) + (isProminent ? 2 : 0) + (hasHighPriority ? 1 : 0);
    
    if (heroScore >= 5) {
      return {
        isHero: true,
        score: heroScore,
        shouldPreload: !this.preloadedImages.has(img.src),
        recommendation: 'This appears to be a hero image. Consider preloading with <link rel="preload">'
      };
    }
    
    return { isHero: false };
  }

  analyzeBackgroundImage(img) {
    // This would analyze CSS background images, but for now we'll focus on img elements
    // Could be extended to scan CSS for background-image properties
    return { hasBackgroundImage: false };
  }

  analyzeServiceWorker(img) {
    if ('serviceWorker' in navigator) {
      return {
        available: true,
        recommendation: 'Service Worker detected. Consider caching images for offline use'
      };
    }
    
    return { available: false };
  }

  analyzeFetchPriority(img) {
    const isAboveFold = img.getBoundingClientRect().top < window.innerHeight;
    const isLCP = img === this.lcpCandidate;
    const currentPriority = img.fetchPriority || 'auto';
    
    if (isAboveFold && currentPriority !== 'high' && !isLCP) {
      return {
        shouldUpgrade: true,
        currentPriority: currentPriority,
        recommendedPriority: 'high',
        reason: 'Above-fold image should have high fetch priority'
      };
    }
    
    if (isLCP && currentPriority !== 'high') {
      return {
        shouldUpgrade: true,
        currentPriority: currentPriority,
        recommendedPriority: 'high',
        reason: 'LCP candidate should have high fetch priority'
      };
    }
    
    return { shouldUpgrade: false };
  }

  analyzePreloadOpportunity(img) {
    const isAboveFold = img.getBoundingClientRect().top < window.innerHeight;
    const isLarge = img.naturalWidth >= 800 || img.naturalHeight >= 600;
    const isNotPreloaded = !this.preloadedImages.has(img.src);
    
    if (isAboveFold && isLarge && isNotPreloaded) {
      return {
        shouldPreload: true,
        reason: 'Large above-fold image not preloaded',
        recommendation: 'Add <link rel="preload" as="image" href="' + img.src + '"> to head'
      };
    }
    
    return { shouldPreload: false };
  }

  addOptimizationRecommendations(data, optimizationAnalysis) {
    // Missing dimensions
    if (optimizationAnalysis.missingDimensions.missing) {
      data.recommendations.push(optimizationAnalysis.missingDimensions.recommendation);
    }

    // Format optimization
    if (optimizationAnalysis.formatOptimization.canOptimize) {
      data.recommendations.push(optimizationAnalysis.formatOptimization.recommendation);
    }

    // Responsive images
    if (optimizationAnalysis.responsiveImage.missing) {
      data.recommendations.push(optimizationAnalysis.responsiveImage.recommendation);
    }

    // File size optimization
    if (optimizationAnalysis.fileSizeOptimization.needsOptimization) {
      data.recommendations.push(optimizationAnalysis.fileSizeOptimization.recommendation);
    }

    // Hero image analysis
    if (optimizationAnalysis.heroImageAnalysis.isHero && optimizationAnalysis.heroImageAnalysis.shouldPreload) {
      data.recommendations.push(optimizationAnalysis.heroImageAnalysis.recommendation);
    }

    // Fetch priority analysis
    if (optimizationAnalysis.fetchPriorityAnalysis.shouldUpgrade) {
      data.recommendations.push(`Add fetchpriority="${optimizationAnalysis.fetchPriorityAnalysis.recommendedPriority}" for ${optimizationAnalysis.fetchPriorityAnalysis.reason}`);
    }

    // Preload opportunity
    if (optimizationAnalysis.preloadAnalysis.shouldPreload) {
      data.recommendations.push(optimizationAnalysis.preloadAnalysis.recommendation);
    }

    // CDN analysis
    if (optimizationAnalysis.cdnAnalysis.detected) {
      data.recommendations.push(`CDN detected: ${optimizationAnalysis.cdnAnalysis.cdn} (${optimizationAnalysis.cdnAnalysis.optimizations.join(', ')})`);
    }

    // Service worker
    if (optimizationAnalysis.serviceWorkerAnalysis.available) {
      data.recommendations.push(optimizationAnalysis.serviceWorkerAnalysis.recommendation);
    }
  }

  updatePerformanceData(data) {
    this.performanceData.totalImages++;
    
    switch (data.strategy) {
      case 'lazy':
        this.performanceData.lazyLoaded++;
        // Count above-fold lazy loading as an issue
        if (data.hasAboveFoldLazyIssue) {
          this.performanceData.issues++;
        }
        break;
      case 'eager':
        this.performanceData.eagerLoaded++;
        break;
      case 'optimized':
        this.performanceData.optimized++;
        break;
      case 'issue':
        this.performanceData.issues++;
        break;
      case 'lcp':
        this.performanceData.lcpCandidates++;
        break;
      case 'preload':
        this.performanceData.preloaded++;
        break;
    }
  }

  updatePerformanceDataForUpdates(data, updates) {
    // Handle updates without double-counting
    if (updates.isLCP && !data.isLCP) {
      this.performanceData.lcpCandidates++;
      // Store the LCP value if provided
      if (updates.lcpValue) {
        this.performanceData.lcpValue = updates.lcpValue;
        this.lcpValue = updates.lcpValue;
        }
      // Notify popup that LCP was detected
      this.notifyPopupOfLCPDetection();
    }
  }

  notifyPopupOfLCPDetection() {
    // Send message to popup to update statistics
    chrome.runtime.sendMessage({
      action: 'lcpDetected',
      performanceData: this.performanceData
    }).then(() => {
      }).catch(error => {
      // Handle extension context invalidated error
      if (error.message && error.message.includes('Extension context invalidated')) {
        // Don't attempt fallback since context is gone
        return;
      }

      // For other errors, try fallback
      this.sendDirectLCPUpdate();
    });
  }

  clearPreviousLCPFlag() {
    // Remove previous LCP highlight from overlays if any
    try {
      const prev = this.lcpCandidate;
      if (!prev) return;
      // If previous was a wrapped <img>, remove attribute from wrapper
      const wrapper = prev.closest && prev.closest('.img-optimizer-overlay');
      if (wrapper) {
        wrapper.removeAttribute('data-lcp-highlight');
      }
    } catch (e) {
      }
  }

  sendDirectLCPUpdate() {
    try {
      // Try to find the popup window and send data directly
      chrome.runtime.sendMessage({
        action: 'directLCPUpdate',
        performanceData: this.performanceData
      }).then(() => {
        }).catch(error => {
        if (error.message && error.message.includes('Extension context invalidated')) {
          // Store LCP data for when popup becomes available again
          this.storeLCPDataForLater();
        }
      });
    } catch (syncError) {
      }
  }

  storeLCPDataForLater() {
    // Store the LCP data in a way that can be retrieved later
    // This could be in chrome.storage.local or just keep it in memory
    this.pendingLCPData = {
      performanceData: this.performanceData,
      timestamp: Date.now()
    };

    // Set up a listener to send the data when popup becomes available
    this.setupPendingDataListener();
  }

  setupPendingDataListener() {
    if (this.pendingDataListener) {
      // Already set up
      return;
    }

    this.pendingDataListener = (request, sender, sendResponse) => {
      if (request.action === 'requestPendingLCPData' && this.pendingLCPData) {
        sendResponse({
          success: true,
          pendingLCPData: this.pendingLCPData
        });

        // Clear the pending data after sending
        this.pendingLCPData = null;
      }
    };

    chrome.runtime.onMessage.addListener(this.pendingDataListener);
  }

  resetPerformanceData() {
    // Store the current LCP value before resetting
    const currentLCP = this.lcpValue;
    
    this.performanceData = {
      totalImages: 0,
      lazyLoaded: 0,
      eagerLoaded: 0,
      optimized: 0,
      issues: 0,
      lcpCandidates: 0,
      lcpValue: currentLCP, // Preserve the real LCP value
      preloaded: 0
    };
    // Don't reset this.lcpValue - keep the real LCP measurement
  }

  getDetailedImageData() {
    const detailedImages = [];
    
    // Regular images
    this.images.forEach((data, img) => {
      const rect = img.getBoundingClientRect();
      const isAboveFold = rect.top < window.innerHeight;
      
      detailedImages.push({
        src: img.src,
        fileSize: data.fileSize,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        loadingStrategy: data.strategy,
        library: data.library,
        performanceScore: this.calculateImagePerformanceScore(data),
        issues: data.recommendations.filter(rec => rec.includes('issue') || rec.includes('problem')),
        recommendations: data.recommendations,
        optimizationPotential: this.calculateOptimizationPotential(data),
        estimatedSavings: this.estimateSavings(data),
        isLCP: data.isLCP,
        isAboveFold: isAboveFold,
        isPreloaded: data.isPreloaded,
        fetchPriority: img.fetchPriority,
        decoding: img.decoding,
        hasAltText: !!img.alt,
        isResponsive: this.isResponsiveImage(img),
        type: 'img'
      });
    });
    
    // Background images
    if (this.backgroundImages) {
      this.backgroundImages.forEach((data, element) => {
        let isAboveFold = false;
        try {
          if (typeof element.getBoundingClientRect === 'function') {
            const rect = element.getBoundingClientRect();
            isAboveFold = rect.top < window.innerHeight;
          }
        } catch (error) {
          }
        
        detailedImages.push({
          src: data.src,
          fileSize: data.fileSize,
          width: data.width,
          height: data.height,
          loadingStrategy: data.strategy,
          library: data.library,
          performanceScore: this.calculateImagePerformanceScore(data),
          issues: data.recommendations.filter(rec => rec.includes('issue') || rec.includes('problem')),
          recommendations: data.recommendations,
          optimizationPotential: this.calculateOptimizationPotential(data),
          estimatedSavings: this.estimateSavings(data),
          isLCP: data.isLCP,
          isAboveFold: isAboveFold,
          isPreloaded: data.isPreloaded,
          fetchPriority: null,
          decoding: null,
          hasAltText: false,
          isResponsive: false,
          type: 'background'
        });
      });
    }
    
    return detailedImages;
  }

  calculateImagePerformanceScore(data) {
    let score = 100;
    
    // Deduct points for issues
    if (data.recommendations.length > 0) {
      score -= data.recommendations.length * 10;
    }
    
    // Add points for optimizations
    if (data.strategy === 'lazy') score += 10;
    if (data.isPreloaded) score += 5;
    if (data.isLCP) score += 5;
    
    return Math.max(0, Math.min(100, score));
  }

  calculateOptimizationPotential(data) {
    const potentials = [];
    
    if (data.strategy === 'eager' && !data.isLCP) {
      potentials.push('Lazy Loading');
    }
    
    if (!data.isPreloaded && data.isLCP) {
      potentials.push('Preloading');
    }
    
    if (data.fileSize > 100000) { // > 100KB
      potentials.push('Compression');
    }
    
    return potentials.length > 0 ? potentials.join(', ') : 'Optimized';
  }

  estimateSavings(data) {
    let savings = 0;
    
    // Parse file size to get bytes
    const fileSizeInKB = this.parseFileSizeToKB(data.fileSize);
    if (fileSizeInKB === 0) return 0;
    
    const fileSizeInBytes = fileSizeInKB * 1024;
    
    // Estimate savings from compression
    if (fileSizeInBytes > 100000) {
      savings += fileSizeInBytes * 0.3; // 30% compression
    }
    
    // Estimate savings from format optimization
    if (data.src.includes('.jpg') || data.src.includes('.png')) {
      savings += fileSizeInBytes * 0.25; // 25% format optimization
    }
    
    return Math.round(savings);
  }

  parseFileSizeToKB(fileSize) {
    if (!fileSize || fileSize === 'Unknown') return 0;
    
    if (typeof fileSize === 'number') {
      return fileSize / 1024; // Convert bytes to KB
    }
    
    if (typeof fileSize === 'string') {
      const match = fileSize.match(/^([\d.]+)(KB|MB)$/);
      if (match) {
        const value = parseFloat(match[1]);
        const unit = match[2];
        if (unit === 'MB') {
          return value * 1024; // Convert MB to KB
        } else {
          return value; // Already in KB
        }
      }
    }
    
    return 0;
  }

  isResponsiveImage(img) {
    try {
      return img.srcset || img.sizes || (img.src && img.src.includes('@2x')) || (img.src && img.src.includes('@3x'));
    } catch (error) {
      return false;
    }
  }

  applyOverlay(img, data) {
    if (!this.isActive) return;

    // Treat very large, full-bleed hero image specially: draw a separate overlay box and don't wrap
    const rectForHero = img.getBoundingClientRect();
    const isHero = rectForHero.width >= window.innerWidth * 0.8 && rectForHero.top < 200;
    const enableHeroOverlay = false; // temporarily disabled to ensure other overlays/tooltips work
    if (enableHeroOverlay && isHero) {
      // Remove existing hero overlay if any
      const oldHero = document.querySelector('.img-optimizer-hero-overlay');
      if (oldHero) oldHero.remove();

      const heroOverlay = document.createElement('div');
      heroOverlay.className = 'img-optimizer-hero-overlay';
      heroOverlay.setAttribute('data-strategy', data.strategy);
      heroOverlay.style.left = `${rectForHero.left}px`;
      heroOverlay.style.top = `${rectForHero.top}px`;
      heroOverlay.style.width = `${rectForHero.width}px`;
      heroOverlay.style.height = `${rectForHero.height}px`;

      // Badge container for hero
      const badges = document.createElement('div');
      badges.className = 'img-optimizer-badges';
      heroOverlay.appendChild(badges);
      document.body.appendChild(heroOverlay);

      // Render badges into hero overlay
      this.renderBadgesInto(badges, data);

      // Tooltip handling for hero
      if (!this.globalTooltip) {
        this.globalTooltip = document.createElement('div');
        this.globalTooltip.className = 'img-optimizer-tooltip';
        document.body.appendChild(this.globalTooltip);
      }
      const score = this.calculateScore(data);
      const html = this.buildTooltipHTML(data, score);
      heroOverlay.addEventListener('mouseenter', () => {
        this.globalTooltip.innerHTML = html;
        this.positionTooltip(heroOverlay, this.globalTooltip);
        this.globalTooltip.classList.add('is-visible');
      });
      heroOverlay.addEventListener('mouseleave', () => {
        this.globalTooltip.classList.remove('is-visible');
      });

      return; // Do not wrap hero image
    }

    // Create wrapper if needed (guard against detached nodes)
    let wrapper = img.parentElement;
    if (!wrapper) {
      return;
    }
    // Capture pre-wrap sizing context so we don't shrink full-bleed images
    const parentBeforeWrap = wrapper;
    const parentWidthBefore = parentBeforeWrap ? parentBeforeWrap.clientWidth : 0;
    const imgRectBefore = img.getBoundingClientRect();
    if (!wrapper.classList || !wrapper.classList.contains('img-optimizer-overlay')) {
      wrapper = document.createElement('div');
      wrapper.className = 'img-optimizer-overlay';
      wrapper.setAttribute('data-strategy', data.strategy);
      if (img.parentNode) {
        img.parentNode.insertBefore(wrapper, img);
      } else {
        return;
      }
      wrapper.appendChild(img);
    }

    // Update wrapper attributes
    wrapper.setAttribute('data-strategy', data.strategy);
    wrapper.setAttribute('data-library', data.library || 'none');
    
    // Mark carousel images for special styling
    if (data.isCarousel) {
      wrapper.setAttribute('data-carousel', 'true');
    }
    
    // Check if this is a small image (thumbnail)
    const imgRect = img.getBoundingClientRect();
    // Treat small thumbnails as compact to avoid unreadable badges
    if (imgRect.width < 160 || imgRect.height < 140) {
      wrapper.setAttribute('data-compact', 'true');
    }

    // LCP highlight: set attribute for purple outline and dot
    if (data.isLCP) {
      wrapper.setAttribute('data-lcp-highlight', 'true');
    } else {
      wrapper.removeAttribute('data-lcp-highlight');
    }

    // If the image was effectively full-width before wrapping, keep wrapper full-width
    if (parentWidthBefore && imgRectBefore.width >= parentWidthBefore * 0.9) {
      wrapper.setAttribute('data-fullwidth', 'true');
    } else {
      wrapper.removeAttribute('data-fullwidth');
    }

    // Create tooltip
    this.createTooltip(wrapper, data);

    // Add performance badges
    this.addPerformanceBadges(wrapper, data);
  }

  buildTooltipHTML(data, score) {
    // Handle case where score is undefined
    const scoreClass = score && score.level ? `score-${score.level}` : '';
    const strategyIcon = this.getStrategyIcon(data.strategy);
    
    // Create compact tooltip for carousel images
    if (data.isCarousel) {
      return `
        <h4>${strategyIcon} ${this.getStrategyDisplayName(data.strategy)}</h4>
        <div class="tooltip-row">
          <span class="tooltip-label">Loading:</span>
          <span class="tooltip-value">${this.getLoadingLabel(data)}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Position:</span>
          <span class="tooltip-value">${data.position}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">Size:</span>
          <span class="tooltip-value">${data.fileSize}</span>
        </div>
        ${data.isLCP ? '<div class="tooltip-row"><span class="tooltip-label">LCP:</span><span class="tooltip-value">Yes</span></div>' : ''}
        ${data.isPreloaded ? '<div class="tooltip-row"><span class="tooltip-label">Preloaded:</span><span class="tooltip-value">Yes</span></div>' : ''}
        ${data.recommendations.length > 0 ? `
          <div style="margin-top: 8px; font-size: 10px; color: #dc2626; padding-top: 8px; border-top: 1px solid #e5e7eb;">
            <strong>Issues:</strong><br>
            ${data.recommendations.slice(0, 2).map(rec => `• ${rec}`).join('<br>')}
            ${data.recommendations.length > 2 ? '<br>• ...' : ''}
          </div>
        ` : ''}
      `;
    }
    
    // Full tooltip for regular images
    return `
      <h4>${strategyIcon} ${this.getStrategyDisplayName(data.strategy)}</h4>
      <div class="tooltip-row">
        <span class="tooltip-label">Loading:</span>
        <span class="tooltip-value">${this.getLoadingLabel(data)}</span>
      </div>
      ${data.library && data.library !== 'native' ? `
        <div class="tooltip-row">
          <span class="tooltip-label">Library:</span>
          <span class="tooltip-value">${this.getLibraryDisplayName(data.library)}</span>
        </div>
      ` : ''}
      <div class="tooltip-row">
        <span class="tooltip-label">Fetch Priority:</span>
        <span class="tooltip-value">${data.fetchPriority || 'auto'}</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-label">Decoding:</span>
        <span class="tooltip-value">${data.decoding || 'auto'}</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-label">Dimensions:</span>
        <span class="tooltip-value">${data.hasDimensions ? 'Yes' : 'No'}</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-label">Position:</span>
        <span class="tooltip-value">${data.position}</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-label">Size:</span>
        <span class="tooltip-value">${data.fileSize}</span>
      </div>
      ${data.isLCP ? '<div class="tooltip-row"><span class="tooltip-label">LCP:</span><span class="tooltip-value">Yes</span></div>' : ''}
      ${data.isPreloaded ? '<div class="tooltip-row"><span class="tooltip-label">Preloaded:</span><span class="tooltip-value">Yes</span></div>' : ''}
      ${data.optimization?.cdnAnalysis?.detected ? `
        <div class="tooltip-row">
          <span class="tooltip-label">CDN:</span>
          <span class="tooltip-value">${data.optimization.cdnAnalysis.cdn}</span>
        </div>
      ` : ''}
      ${data.optimization?.heroImageAnalysis?.isHero ? `
        <div class="tooltip-row">
          <span class="tooltip-label">Hero Image:</span>
          <span class="tooltip-value">Yes (Score: ${data.optimization.heroImageAnalysis.score})</span>
        </div>
      ` : ''}

      ${data.recommendations.length > 0 ? `
        <div style="margin-top: 12px; font-size: 11px; color: #dc2626; padding-top: 12px; border-top: 1px solid #e5e7eb;">
          <strong>Optimization Recommendations:</strong><br>
          ${data.recommendations.map(rec => `• ${rec}`).join('<br>')}
        </div>
      ` : ''}
      <div style="margin-top: 12px; font-size: 10px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 12px;">
        <strong>Legend:</strong><br>
        • <strong><span style="display: inline-block; width: 12px; height: 12px; background: #10b981; border-radius: 50%; margin-right: 6px; vertical-align: middle;"></span>Green:</strong> Properly optimized (preloaded LCP, lazy-loaded below fold)<br>
        • <strong><span style="display: inline-block; width: 12px; height: 12px; background: #3b82f6; border-radius: 50%; margin-right: 6px; vertical-align: middle;"></span>Blue:</strong> Lazy loaded images<br>
        • <strong><span style="display: inline-block; width: 12px; height: 12px; background: #f59e0b; border-radius: 50%; margin-right: 6px; vertical-align: middle;"></span>Yellow:</strong> Eager loaded images<br>
        • <strong><span style="display: inline-block; width: 12px; height: 12px; background: #ef4444; border-radius: 50%; margin-right: 6px; vertical-align: middle;"></span>Red:</strong> Performance issues (missing dimensions, blocking LCP)<br>
        • <strong><span style="display: inline-block; width: 12px; height: 12px; background: #008080; border-radius: 50%; margin-right: 6px; vertical-align: middle;"></span>Teal:</strong> Preloaded images<br>
        • <strong><span style="display: inline-block; width: 12px; height: 12px; background: #8b5cf6; border-radius: 50%; margin-right: 6px; vertical-align: middle;"></span>Purple:</strong> LCP candidate images
      </div>
    `;
  }

  renderBadgesInto(container, data) {
    const add = (cls, text) => { const b = document.createElement('div'); b.className = `img-optimizer-badge ${cls}`; b.textContent = text; container.appendChild(b); };
    if (data.isLCP) add('lcp', 'LCP');
    // Only show LCP? for very large, prominent images that could realistically be LCP
    if (data.position === 'above-fold' && 
        data.strategy !== 'lazy' && 
        !data.isLCP && 
        data.naturalWidth >= 800 && 
        data.naturalHeight >= 600 && 
        data.width >= 400 && 
        data.height >= 300 &&
        data.width * data.height > 120000) { // Must be at least 400x300 display area
      add('lcp-candidate', 'LCP?');
    }
    if (data.isPreloaded) add('preload', 'PRELOAD');
    if (data.fetchPriority === 'high') add('high-priority', 'HIGH');
    if (!data.hasDimensions) add('missing-dims', 'NO DIMS');
    if (data.strategy === 'lazy' && data.position === 'above-fold') add('above-fold-lazy', 'ABOVE');
  }

  createTooltip(wrapper, data) {
    // Ensure we have one global tooltip in the document body
    if (!this.globalTooltip) {
      this.globalTooltip = document.createElement('div');
      this.globalTooltip.className = 'img-optimizer-tooltip';
      document.body.appendChild(this.globalTooltip);
    }

    // Prepare content for this image
    const score = this.calculateScore(data);
    const html = this.buildTooltipHTML(data, score);

    // Bind hover events once per wrapper to show/hide global tooltip
    if (!wrapper.__optimizerHoverBound) {
      wrapper.addEventListener('mouseenter', () => {
        this.globalTooltip.innerHTML = html;
        this.positionTooltip(wrapper, this.globalTooltip);
        this.globalTooltip.classList.add('is-visible');
      });

      wrapper.addEventListener('mouseleave', () => {
        this.globalTooltip.classList.remove('is-visible');
      });

      wrapper.__optimizerHoverBound = true;
    }
  }

  addPerformanceBadges(wrapper, data) {
    // Remove existing badges container
    const existingContainer = wrapper.querySelector('.img-optimizer-badges');
    if (existingContainer) existingContainer.remove();

    // Create container for multiple badges side-by-side
    const container = document.createElement('div');
    container.className = 'img-optimizer-badges';
    wrapper.appendChild(container);

    // Priority order for badges (only show one primary badge)
    let primaryBadgeAdded = false;

    // 1. LCP badge (highest priority - actual LCP detection)
    if (data.isLCP && !primaryBadgeAdded) {
      const badge = document.createElement('div');
      badge.className = 'img-optimizer-badge lcp';
      badge.textContent = 'LCP';
      container.appendChild(badge);
      primaryBadgeAdded = true;
    }

    // 2. LCP Candidate badge (only if not actual LCP and is the probable candidate)
    if (!data.isLCP && this.probableLCP && wrapper.contains && wrapper.contains(this.probableLCP) && !primaryBadgeAdded) {
      const badge = document.createElement('div');
      badge.className = 'img-optimizer-badge lcp-candidate';
      badge.textContent = 'LCP?';
      container.appendChild(badge);
      primaryBadgeAdded = true;
    }

    // 3. Preload badge
    if (data.isPreloaded && !primaryBadgeAdded) {
      const badge = document.createElement('div');
      badge.className = 'img-optimizer-badge preload';
      badge.textContent = 'PRELOAD';
      container.appendChild(badge);
      primaryBadgeAdded = true;
    }

    // 4. High priority badge
    if (data.fetchPriority === 'high' && !primaryBadgeAdded) {
      const badge = document.createElement('div');
      badge.className = 'img-optimizer-badge high-priority';
      badge.textContent = 'HIGH';
      container.appendChild(badge);
      primaryBadgeAdded = true;
    }

    // 5. Missing dimensions badge
    if (!data.hasDimensions && !primaryBadgeAdded) {
      const badge = document.createElement('div');
      badge.className = 'img-optimizer-badge missing-dims';
      badge.textContent = 'NO DIMS';
      container.appendChild(badge);
      primaryBadgeAdded = true;
    }

    // 6. Above-fold lazy loading warning badge
    if (data.strategy === 'lazy' && data.position === 'above-fold' && !primaryBadgeAdded) {
      const badge = document.createElement('div');
      badge.className = 'img-optimizer-badge above-fold-lazy';
      badge.textContent = 'ABOVE';
      container.appendChild(badge);
      primaryBadgeAdded = true;
    }

    // 7. Library-specific badge (only if no other primary badge)
    if (data.library && data.library !== 'native' && !primaryBadgeAdded) {
      const badge = document.createElement('div');
      badge.className = `img-optimizer-badge ${data.library}`;
      badge.textContent = this.getLibraryDisplayName(data.library);
      container.appendChild(badge);
      primaryBadgeAdded = true;
    }
  }

  getStrategyDisplayName(strategy) {
    const names = {
      'optimized': 'Well Optimized',
      'lazy': 'Lazy Loaded',
      'eager': 'Eager Loaded',
      'issue': 'Performance Issue',
      'preload': 'Preloaded',
      'lcp': 'LCP Candidate'
    };
    return names[strategy] || strategy;
  }

  calculateScore(data) {
    let score = 100;

    // Deduct points for issues
    if (!data.hasDimensions) score -= 20;
    if (data.strategy === 'eager' && data.position === 'below-fold') score -= 15;
    if (data.isLCP && !data.isPreloaded) score -= 10;
    if (data.fetchPriority !== 'high' && data.isLCP) score -= 5;
    if (data.decoding !== 'async') score -= 5;

    // Add points for optimizations
    if (data.strategy === 'lazy' && data.position === 'below-fold') score += 10;
    if (data.isPreloaded) score += 10;
    if (data.hasDimensions) score += 10;

    score = Math.max(0, Math.min(100, score));

    let level;
    if (score >= 90) level = 'excellent';
    else if (score >= 70) level = 'good';
    else if (score >= 50) level = 'needs-work';
    else level = 'poor';

    return { score, level };
  }

  updateImageData(img, updates) {
    const data = this.images.get(img);
    if (data) {
      Object.assign(data, updates);
      this.updatePerformanceDataForUpdates(data, updates);
      this.applyOverlay(img, data);
    }
  }

  removeOverlays() {
    const overlays = document.querySelectorAll('.img-optimizer-overlay');
    overlays.forEach(overlay => {
      const img = overlay.querySelector('img');
      if (img) {
        overlay.parentNode.insertBefore(img, overlay);
        overlay.remove();
      }
    });
  }

  positionTooltip(wrapper, tooltip) {
    // Wait for tooltip to be rendered
    setTimeout(() => {
      const wrapperRect = wrapper.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // Force tooltip to be visible to get its dimensions
      tooltip.style.visibility = 'visible';
      tooltip.style.opacity = '1';
      tooltip.style.position = 'fixed';
      tooltip.style.top = '0';
      tooltip.style.left = '0';
      
      const tooltipRect = tooltip.getBoundingClientRect();
      const tooltipWidth = tooltipRect.width;
      const tooltipHeight = tooltipRect.height;
      
      // Check if this is a small image (thumbnail)
      const isSmallImage = wrapperRect.width < 200 || wrapperRect.height < 150;
      
      let top, left;
      
      if (isSmallImage) {
        // For small images, position tooltip to the right or left to avoid going under
        const spaceOnRight = viewportWidth - wrapperRect.right;
        const spaceOnLeft = wrapperRect.left;
        
        if (spaceOnRight >= tooltipWidth + 20) {
          // Position to the right
          left = wrapperRect.right + 10;
          top = wrapperRect.top + (wrapperRect.height / 2) - (tooltipHeight / 2);
        } else if (spaceOnLeft >= tooltipWidth + 20) {
          // Position to the left
          left = wrapperRect.left - tooltipWidth - 10;
          top = wrapperRect.top + (wrapperRect.height / 2) - (tooltipHeight / 2);
        } else {
          // Fallback: position below
          top = wrapperRect.bottom + 10;
          left = wrapperRect.left + (wrapperRect.width / 2) - (tooltipWidth / 2);
        }
      } else {
        // For larger images, use standard positioning
        top = wrapperRect.bottom + 10;
        left = wrapperRect.left + (wrapperRect.width / 2) - (tooltipWidth / 2);
      }
      
      // Ensure tooltip stays within viewport bounds
      let placedAbove = false;
      if (top + tooltipHeight > viewportHeight - 20) {
        top = wrapperRect.top - tooltipHeight - 10;
        placedAbove = true;
      }
      
      if (left + tooltipWidth > viewportWidth - 20) {
        left = viewportWidth - tooltipWidth - 20;
      }
      
      if (left < 20) {
        left = 20;
      }
      
      if (top < 20) {
        top = wrapperRect.bottom + 10;
      }
      
      // Apply the final position and hide it
      tooltip.style.top = `${top}px`;
      tooltip.style.left = `${left}px`;
      tooltip.style.visibility = 'hidden';
      tooltip.style.opacity = '0';
      tooltip.style.transform = 'none';
      
      // Set position attribute for arrow styling
      // Determine arrow orientation and offset to aim at hovered image center
      if (isSmallImage && (left > wrapperRect.right || left < wrapperRect.left)) {
        const side = left > wrapperRect.right ? 'side-right' : 'side-left';
        tooltip.setAttribute('data-position', side);
        const arrowTop = Math.max(12, Math.min(tooltipHeight - 12, (wrapperRect.top + wrapperRect.height / 2) - top));
        tooltip.style.setProperty('--arrow-top', `${arrowTop}px`);
      } else {
        tooltip.setAttribute('data-position', placedAbove ? 'above' : 'below');
        const arrowLeft = Math.max(12, Math.min(tooltipWidth - 12, (wrapperRect.left + wrapperRect.width / 2) - left));
        tooltip.style.setProperty('--arrow-left', `${arrowLeft}px`);
      }
      
      // Debug logging
      }, 10);
  }

  // Hero overlay helpers (safe no-ops unless used)
  updateHeroOverlayPosition() {
    if (!this.heroOverlayEl || !this.heroTargetImg) return;
    const rect = this.heroTargetImg.getBoundingClientRect();
    const inView = rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
    if (!inView) {
      this.removeHeroOverlay();
      return;
    }
    this.heroOverlayEl.style.left = `${rect.left}px`;
    this.heroOverlayEl.style.top = `${rect.top}px`;
    this.heroOverlayEl.style.width = `${rect.width}px`;
    this.heroOverlayEl.style.height = `${rect.height}px`;
  }

  cleanupHeroOverlayIfDetached() {
    if (this.heroTargetImg && !document.body.contains(this.heroTargetImg)) {
      this.removeHeroOverlay();
    }
  }

  removeHeroOverlay() {
    if (this.heroOverlayEl) {
      this.heroOverlayEl.remove();
      this.heroOverlayEl = null;
      this.heroTargetImg = null;
    }
  }

  showElementLCPOverlay(targetEl) {
    try {
      // Remove existing overlay if present
      const existing = document.querySelector('.img-optimizer-hero-overlay');
      if (existing) existing.remove();

      const rect = targetEl.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) return;

      const overlay = document.createElement('div');
      overlay.className = 'img-optimizer-hero-overlay';
      overlay.setAttribute('data-strategy', 'lcp');
      overlay.style.left = `${rect.left}px`;
      overlay.style.top = `${rect.top}px`;
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;

      // Add a small badge
      const badges = document.createElement('div');
      badges.className = 'img-optimizer-badges';
      const badge = document.createElement('div');
      badge.className = 'img-optimizer-badge lcp';
      badge.textContent = 'LCP';
      badges.appendChild(badge);
      overlay.appendChild(badges);

      document.body.appendChild(overlay);
      this.heroOverlayEl = overlay;
      this.heroTargetImg = null;
    } catch (e) {
      }
  }

  detectLCPFallback() {
    // Get all images that are visible and above the fold, with stricter criteria
    const allImages = Array.from(document.querySelectorAll('img'));
    const aboveFoldImages = allImages.filter(img => {
      const rect = img.getBoundingClientRect();
      const isAboveFold = rect.top < window.innerHeight && rect.bottom > 0;
      const isVisible = rect.width > 0 && rect.height > 0;
      const hasSrc = img.src && img.src !== '';
      const isLargeEnough = rect.width >= 300 && rect.height >= 200; // Must be reasonably large
      const isNotThumbnail = rect.width * rect.height > 60000; // At least 300x200 display area

      return isAboveFold && isVisible && hasSrc && isLargeEnough && isNotThumbnail;
    });

    if (aboveFoldImages.length === 0) {
      return;
    }

    // Sort by display area (what the user actually sees) and pick the largest
    const largestImage = aboveFoldImages.reduce((largest, current) => {
      const largestArea = largest.getBoundingClientRect().width * largest.getBoundingClientRect().height;
      const currentArea = current.getBoundingClientRect().width * current.getBoundingClientRect().height;
      return currentArea > largestArea ? current : largest;
    });

    if (largestImage) {
      const area = largestImage.getBoundingClientRect().width * largestImage.getBoundingClientRect().height;
      // Estimate LCP time based on image size and connection (rough approximation)
      const estimatedLCP = this.estimateLCPTime(largestImage);
      this.lcpValue = estimatedLCP;

      this.lcpCandidate = largestImage;
      this.updateImageData(largestImage, { isLCP: true, lcpValue: estimatedLCP });

      }
  }

  getFileSize(img) {
    // Try to get file size from cache first
    const src = img.src || img.currentSrc;
    if (!src) return null;
    
    if (this.fileSizeCache.has(src)) {
      return this.fileSizeCache.get(src);
    }
    
    // Try to get file size from Content-Length header if available
    // This is a fallback method since we can't always get the actual file size
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;
    
    if (naturalWidth && naturalHeight) {
      // Estimate file size based on dimensions and format
      const format = this.getImageFormat(img);
      let bytesPerPixel = 3; // Default for JPEG
      
      if (format === 'PNG') {
        bytesPerPixel = 4; // PNG with alpha channel
      } else if (format === 'WebP') {
        bytesPerPixel = 3.5; // WebP is more efficient
      } else if (format === 'AVIF') {
        bytesPerPixel = 2.5; // AVIF is very efficient
      }
      
      // Rough estimation: pixels * bytes per pixel * compression factor
      const compressionFactor = 0.1; // Most images are compressed
      const estimatedBytes = naturalWidth * naturalHeight * bytesPerPixel * compressionFactor;
      const estimatedKB = Math.round(estimatedBytes / 1024);
      
      // Cache the result
      this.fileSizeCache.set(src, estimatedKB);
      return estimatedKB;
    }
    
    return null;
  }

  getImageFormat(img) {
    const src = img.src || img.currentSrc;
    if (!src) return 'unknown';
    
    const url = new URL(src, window.location.href);
    const pathname = url.pathname.toLowerCase();
    
    if (pathname.includes('.jpg') || pathname.includes('.jpeg')) return 'JPEG';
    if (pathname.includes('.png')) return 'PNG';
    if (pathname.includes('.webp')) return 'WebP';
    if (pathname.includes('.avif')) return 'AVIF';
    if (pathname.includes('.gif')) return 'GIF';
    if (pathname.includes('.svg')) return 'SVG';
    
    return 'unknown';
  }

  estimateLCPTime(img) {
    // Rough estimation based on image size and typical loading times
    // This is a fallback since we don't have actual PerformanceObserver data
    const fileSizeKB = this.getFileSize(img) || this.estimateFileSize(img);
    const fileSizeNum = parseFloat(fileSizeKB) || 100; // Default 100KB if unknown

    // Estimate based on file size (rough approximation)
    // Smaller images load faster, larger images take longer
    let estimatedTime = 500; // Base time

    if (fileSizeNum > 500) {
      estimatedTime += 1000; // Large images add 1s
    } else if (fileSizeNum > 200) {
      estimatedTime += 500; // Medium images add 0.5s
    } else if (fileSizeNum > 50) {
      estimatedTime += 200; // Small images add 0.2s
    }

    // Add some variance based on connection (rough estimate)
    const connectionMultiplier = navigator.connection ?
      (navigator.connection.effectiveType === '4g' ? 1 :
       navigator.connection.effectiveType === '3g' ? 2 :
       navigator.connection.effectiveType === '2g' ? 3 : 1.5) : 1;

    return Math.round(estimatedTime * connectionMultiplier);
  }

  analyzeBackgroundImageElement(element, virtualImg, isCarousel = false) {
    // Create analysis data for background image
    const data = {
      src: virtualImg.src,
      loading: 'eager', // Background images are typically eager loaded
      fetchPriority: null,
      decoding: null,
      width: virtualImg.width,
      height: virtualImg.height,
      naturalWidth: virtualImg.naturalWidth,
      naturalHeight: virtualImg.naturalHeight,
      strategy: 'eager',
      library: null,
      isLCP: false,
      isPreloaded: false,
      hasDimensions: !!(virtualImg.width && virtualImg.height),
      position: this.getImagePosition(virtualImg),
      fileSize: this.estimateFileSize(virtualImg),
      recommendations: [],
      isBackgroundImage: true,
      isCarousel: isCarousel,
      element: element
    };

    // Check if preloaded
    if (this.preloadedImages.has(virtualImg.src)) {
      data.isPreloaded = true;
      data.strategy = 'preload';
    }

    // Check if LCP candidate
    if (element === this.lcpCandidate) {
      data.isLCP = true;
      data.strategy = 'lcp';
    }

    // Generate recommendations
    data.recommendations = this.generateRecommendations(data);

    // Add background image specific recommendations
    data.recommendations.push('Background image detected - consider using <img> tag for better SEO and accessibility');

    // Determine overall strategy
    data.strategy = this.calculateOverallStrategy(data);

    // Store the analysis
    this.backgroundImages = this.backgroundImages || new Map();
    this.backgroundImages.set(element, data);
    
    // Update performance data
    this.updatePerformanceData(data);
    
    // Apply overlay to the element
    this.applyOverlayToElement(element, data);
  }

  applyOverlayToElement(element, data) {
    // Create overlay for background image element
    const overlay = document.createElement('div');
    overlay.className = 'img-optimizer-overlay';
    overlay.setAttribute('data-strategy', data.strategy);
    overlay.setAttribute('data-library', data.library || 'none');
    overlay.setAttribute('data-compact', 'true');
    
    // Mark carousel background images for special styling
    if (data.isCarousel) {
      overlay.setAttribute('data-carousel', 'true');
    }
    
    // Add badges
    const badges = document.createElement('div');
    badges.className = 'img-optimizer-badges';
    
    if (data.isLCP) {
      const lcpBadge = document.createElement('div');
      lcpBadge.className = 'img-optimizer-badge lcp-candidate';
      lcpBadge.textContent = 'LCP?';
      badges.appendChild(lcpBadge);
    }
    
    if (data.isPreloaded) {
      const preloadBadge = document.createElement('div');
      preloadBadge.className = 'img-optimizer-badge preload';
      preloadBadge.textContent = 'PRELOAD';
      badges.appendChild(preloadBadge);
    }
    
    if (data.strategy === 'eager') {
      const eagerBadge = document.createElement('div');
      eagerBadge.className = 'img-optimizer-badge eager';
      eagerBadge.textContent = 'EAGER';
      badges.appendChild(eagerBadge);
    }
    
    overlay.appendChild(badges);
    
    // Use shared tooltip system (like regular images)
    // Attach hover handlers to the background element itself so pointer events work
    this.createTooltip(element, data);
    
    // Position overlay
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '9999';
    
    // Add to element
    element.style.position = 'relative';
    element.appendChild(overlay);
  }

  toggleShowAll() {
    this.showingAll = !this.showingAll;
    const overlays = document.querySelectorAll('.img-optimizer-overlay');
    overlays.forEach(overlay => {
      if (this.showingAll) {
        overlay.classList.add('show-all');
      } else {
        overlay.classList.remove('show-all');
      }
    });
  }
}

// Initialize the optimizer when the page is ready
try {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      try {
        new ImageLoadingOptimizer();
        } catch (error) {
        console.error('Lazy Spy: Failed to initialize:', error);
      }
    });
  } else {
    try {
      new ImageLoadingOptimizer();
      } catch (error) {
      console.error('Lazy Spy: Failed to initialize:', error);
    }
  }
} catch (error) {
  console.error('Lazy Spy: Critical error during initialization:', error);
}
