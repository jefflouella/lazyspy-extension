// Library Detector for Lazy Spy
// Identifies lazy loading libraries and provides optimization recommendations

class LibraryDetector {
  constructor() {
    this.libraries = {
      'lazysizes': {
        detected: false,
        usageCount: 0,
        patterns: ['data-src', 'data-srcset', 'data-sizes'],
        globalObject: 'lazySizes',
        recommendations: [
          'Use data-srcset for responsive images',
          'Implement data-sizes for proper sizing',
          'Consider using native lazy loading for better performance',
          'Add width and height attributes to prevent CLS'
        ]
      },
      'lozad': {
        detected: false,
        usageCount: 0,
        patterns: ['data-src'],
        globalObject: 'lozad',
        recommendations: [
          'Ensure Intersection Observer is supported',
          'Add fallback for older browsers',
          'Consider using native lazy loading',
          'Optimize image formats for better performance'
        ]
      },
      'intersection-observer': {
        detected: false,
        usageCount: 0,
        patterns: [],
        globalObject: null,
        recommendations: [
          'Add polyfill for older browsers',
          'Consider using native lazy loading',
          'Optimize threshold values for better UX',
          'Monitor performance impact'
        ]
      },
      'custom': {
        detected: false,
        usageCount: 0,
        patterns: ['data-lazy', 'lazy-load', 'lazy-image', 'data-original'],
        globalObject: null,
        recommendations: [
          'Review implementation for best practices',
          'Consider migrating to native lazy loading',
          'Add proper error handling',
          'Optimize for performance'
        ]
      },
      'native': {
        detected: false,
        usageCount: 0,
        patterns: ['loading="lazy"'],
        globalObject: null,
        recommendations: [
          'Ensure browser compatibility',
          'Add fallback for older browsers',
          'Use fetchpriority for critical images',
          'Consider preloading above-fold images'
        ]
      },
      'react-lazy-load': {
        detected: false,
        usageCount: 0,
        patterns: ['react-lazy-load', 'data-lazy'],
        globalObject: null,
        recommendations: [
          'Consider using React Suspense for better UX',
          'Optimize bundle size',
          'Add proper loading states',
          'Monitor performance impact'
        ]
      },
      'vue-lazyload': {
        detected: false,
        usageCount: 0,
        patterns: ['v-lazy', 'v-lazy-container'],
        globalObject: null,
        recommendations: [
          'Use Vue 3 composition API for better performance',
          'Add proper error handling',
          'Consider using native lazy loading',
          'Optimize for mobile performance'
        ]
      }
    };
  }

  detectLibraries() {
    this.resetDetection();
    
    // Check for global objects
    this.detectGlobalObjects();
    
    // Check for DOM patterns
    this.detectDOMPatterns();
    
    // Check for script tags
    this.detectScriptTags();
    
    // Check for Intersection Observer usage
    this.detectIntersectionObserver();
    
    // Check for native lazy loading
    this.detectNativeLazyLoading();
    
    return this.getDetectionResults();
  }

  resetDetection() {
    Object.values(this.libraries).forEach(lib => {
      lib.detected = false;
      lib.usageCount = 0;
    });
  }

  detectGlobalObjects() {
    Object.entries(this.libraries).forEach(([name, lib]) => {
      if (lib.globalObject && window[lib.globalObject]) {
        lib.detected = true;
        lib.usageCount = 1;
        console.log(`Library Detector: Detected ${name} via global object`);
      }
    });
  }

  detectDOMPatterns() {
    Object.entries(this.libraries).forEach(([name, lib]) => {
      lib.patterns.forEach(pattern => {
        const elements = document.querySelectorAll(`[${pattern}]`);
        if (elements.length > 0) {
          lib.detected = true;
          lib.usageCount += elements.length;
          console.log(`Library Detector: Detected ${name} via pattern ${pattern} (${elements.length} elements)`);
        }
      });
    });
  }

  detectScriptTags() {
    const scripts = document.querySelectorAll('script[src]');
    const scriptSources = Array.from(scripts).map(script => script.src.toLowerCase());
    
    // Check for common lazy loading library CDNs
    const cdnPatterns = {
      'lazysizes': ['lazysizes', 'lazysizes.min.js'],
      'lozad': ['lozad', 'lozad.min.js'],
      'react-lazy-load': ['react-lazy-load', 'react-lazyload'],
      'vue-lazyload': ['vue-lazyload', 'vue-lazyload.min.js']
    };
    
    Object.entries(cdnPatterns).forEach(([name, patterns]) => {
      if (scriptSources.some(src => patterns.some(pattern => src.includes(pattern)))) {
        this.libraries[name].detected = true;
        this.libraries[name].usageCount = 1;
        console.log(`Library Detector: Detected ${name} via script tag`);
      }
    });
  }

  detectIntersectionObserver() {
    // Check if Intersection Observer is being used
    if ('IntersectionObserver' in window) {
      // Look for Intersection Observer usage in the page
      const hasIntersectionObserverUsage = this.checkIntersectionObserverUsage();
      
      if (hasIntersectionObserverUsage) {
        this.libraries['intersection-observer'].detected = true;
        this.libraries['intersection-observer'].usageCount = 1;
        console.log('Library Detector: Detected Intersection Observer usage');
      }
    }
  }

  checkIntersectionObserverUsage() {
    // This is a simplified check - in a real implementation, you might want to
    // analyze the page's JavaScript more thoroughly
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

  detectNativeLazyLoading() {
    const lazyImages = document.querySelectorAll('img[loading="lazy"]');
    if (lazyImages.length > 0) {
      this.libraries['native'].detected = true;
      this.libraries['native'].usageCount = lazyImages.length;
      console.log(`Library Detector: Detected native lazy loading (${lazyImages.length} images)`);
    }
  }

  getDetectionResults() {
    const detected = Object.entries(this.libraries)
      .filter(([name, lib]) => lib.detected)
      .map(([name, lib]) => ({
        name,
        detected: lib.detected,
        usageCount: lib.usageCount,
        recommendations: lib.recommendations
      }));
    
    return {
      detected,
      totalLibraries: detected.length,
      summary: this.generateSummary(detected)
    };
  }

  generateSummary(detected) {
    if (detected.length === 0) {
      return {
        status: 'No lazy loading detected',
        recommendation: 'Consider implementing lazy loading for better performance',
        priority: 'medium'
      };
    }
    
    if (detected.length === 1 && detected[0].name === 'native') {
      return {
        status: 'Native lazy loading detected',
        recommendation: 'Excellent! Native lazy loading provides the best performance',
        priority: 'low'
      };
    }
    
    if (detected.some(lib => lib.name === 'native')) {
      return {
        status: 'Mixed lazy loading approaches detected',
        recommendation: 'Consider migrating all images to native lazy loading',
        priority: 'medium'
      };
    }
    
    return {
      status: `${detected.length} lazy loading library(ies) detected`,
      recommendation: 'Consider migrating to native lazy loading for better performance',
      priority: 'high'
    };
  }

  getLibrarySpecificRecommendations(libraryName) {
    const library = this.libraries[libraryName];
    if (!library) return [];
    
    return library.recommendations;
  }

  generateMigrationGuide(fromLibrary, toLibrary = 'native') {
    const migrationGuides = {
      'lazysizes': {
        title: 'Migrating from LazySizes to Native Lazy Loading',
        steps: [
          'Replace data-src with src',
          'Add loading="lazy" attribute',
          'Remove LazySizes script and CSS',
          'Update responsive images to use srcset',
          'Test thoroughly across browsers'
        ],
        benefits: [
          'Better performance',
          'Smaller bundle size',
          'Native browser optimization',
          'Reduced JavaScript overhead'
        ]
      },
      'lozad': {
        title: 'Migrating from LoZad to Native Lazy Loading',
        steps: [
          'Replace data-src with src',
          'Add loading="lazy" attribute',
          'Remove LoZad initialization',
          'Update Intersection Observer callbacks',
          'Test performance improvements'
        ],
        benefits: [
          'Simplified implementation',
          'Better browser support',
          'Reduced maintenance',
          'Improved performance'
        ]
      },
      'custom': {
        title: 'Migrating Custom Lazy Loading to Native',
        steps: [
          'Audit current implementation',
          'Replace custom attributes with loading="lazy"',
          'Remove custom JavaScript',
          'Update responsive image handling',
          'Add fallback for older browsers'
        ],
        benefits: [
          'Standardized approach',
          'Better browser optimization',
          'Reduced code complexity',
          'Future-proof implementation'
        ]
      }
    };
    
    return migrationGuides[fromLibrary] || {
      title: 'General Migration Guide',
      steps: [
        'Replace custom lazy loading with loading="lazy"',
        'Remove library dependencies',
        'Test across target browsers',
        'Monitor performance improvements'
      ],
      benefits: [
        'Better performance',
        'Reduced bundle size',
        'Simplified maintenance',
        'Native browser optimization'
      ]
    };
  }

  getBrowserSupport() {
    return {
      'native': {
        chrome: 76,
        firefox: 75,
        safari: 15.4,
        edge: 79,
        support: 'Good'
      },
      'intersection-observer': {
        chrome: 51,
        firefox: 55,
        safari: 12.1,
        edge: 15,
        support: 'Excellent'
      }
    };
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LibraryDetector;
}

// Make available globally for content script
if (typeof window !== 'undefined') {
  window.LibraryDetector = LibraryDetector;
}
