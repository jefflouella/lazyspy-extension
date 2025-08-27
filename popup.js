// Lazy Spy Popup Controller
class PopupController {
  constructor() {
    this.currentTab = null;
    this.isActive = false;
    this.csvExporter = null;
    this.libraryDetector = null;
    this.performanceData = null; // Store current performance data
    this.lastKnownLCPData = null; // Track LCP data changes
    this.init();
  }

  async init() {
    try {
      // Get current active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0) {
        this.currentTab = tabs[0];
        this.initializeAdvancedFeatures();
        this.initializeUI();
        this.checkExtensionState();

        // Delay initial stats load to give content script time to detect LCP
        setTimeout(() => {
          this.loadStats();
          this.loadLibraryInfo(); // Load library info
          // Also request any pending LCP data that might have been stored
          this.requestPendingLCPData();
        }, 1000);
        
        // Listen for LCP detection updates
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
          if (request.action === 'updateStatsFromLCP') {
            console.log('Popup: Received LCP update from background:', request.performanceData);
            this.updateStatsFromLCP(request.performanceData);
          } else if (request.action === 'directLCPUpdate') {
            console.log('Popup: Received direct LCP update:', request.performanceData);
            this.updateStatsFromLCP(request.performanceData);
          }
        });
      } else {
        this.showError('No active tab found');
      }
    } catch (error) {
      this.showError(`Failed to initialize: ${error.message}`);
    }
  }

  async initializeAdvancedFeatures() {
    try {
      // Initialize CSV exporter
      this.csvExporter = new CSVExporter();

      // Initialize library detector
      this.libraryDetector = new LibraryDetector();
    } catch (error) {
      console.error('Failed to initialize advanced features:', error);
    }
  }

  async checkExtensionState() {
    if (!this.currentTab) return;

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getActiveTabs'
      });

      if (response.activeTabs && response.activeTabs.includes(this.currentTab.id)) {
        this.isActive = true;
        this.updateToggleState();
      }
    } catch (error) {
      console.log('Could not check extension state:', error.message);
    }
  }

  initializeUI() {
    if (!this.currentTab) return;

    // Initialize toggle button
    const toggleBtn = document.getElementById('toggleBtn');
    toggleBtn.addEventListener('click', () => this.toggleExtension());

    // Initialize refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    refreshBtn.addEventListener('click', () => this.loadStats());

    // Initialize export button
    const exportBtn = document.getElementById('exportBtn');
    exportBtn.addEventListener('click', () => this.exportReport());

    // Show tab info
    this.showTabInfo();
    
    // Initialize toggle state
    this.updateToggleState();
  }

  showTabInfo() {
    if (!this.currentTab) return;
    
    const tabInfo = document.getElementById('tabInfo');
    const url = new URL(this.currentTab.url);
    tabInfo.textContent = `${url.hostname}${url.pathname}`;
  }

  async toggleExtension() {
    if (!this.currentTab) return;

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'toggle',
        tabId: this.currentTab.id
      });

      if (response.success) {
        this.isActive = response.isActive;
        this.updateToggleState();
        
        if (this.isActive) {
          this.loadStats();
          this.loadLibraryInfo(); // Load library info when activating
          // Start periodic refresh to catch LCP updates
          this.startPeriodicRefresh();
        } else {
          this.stopPeriodicRefresh();
        }
      } else {
        this.showError(response.error || 'Failed to toggle extension');
      }
    } catch (error) {
      this.showError(`Toggle failed: ${error.message}`);
    }
  }

  updateToggleState() {
    const toggleBtn = document.getElementById('toggleBtn');
    const toggleLabel = document.querySelector('.toggle-label');
    
    if (this.isActive) {
      toggleBtn.classList.add('active');
      toggleLabel.textContent = 'Active';
    } else {
      toggleBtn.classList.remove('active');
      toggleLabel.textContent = 'Click to Activate';
    }
  }

  async loadStats() {
    if (!this.currentTab) return;

    try {
      console.log('Popup: Loading stats for tab:', this.currentTab.id);
      const response = await chrome.runtime.sendMessage({
        action: 'getStats',
        tabId: this.currentTab.id
      });

      if (response.stats) {
        console.log('Popup: Received stats:', response.stats);
        console.log('Popup: LCP value in response:', response.stats.lcpValue);
        console.log('Popup: LCP candidate in response:', response.stats.lcpCandidate);

        this.updateStats(response.stats);

        // Check if LCP data has changed since our last known data
        if (this.hasLCPDataChanged(response.stats)) {
          console.log('Popup: LCP data has changed, updating display');
          this.lastKnownLCPData = response.stats;

          // Force immediate update of LCP display
          const lcpElement = document.getElementById('lcpValue');
          if (lcpElement && response.stats.lcpValue !== null && response.stats.lcpValue !== undefined) {
            const lcpMs = Math.round(response.stats.lcpValue);
            console.log('Popup: Force updating LCP display to:', lcpMs);
            lcpElement.textContent = lcpMs;
            lcpElement.className = 'stat-number';
            if (lcpMs <= 2500) {
              lcpElement.classList.add('lcp-good');
            } else if (lcpMs <= 4000) {
              lcpElement.classList.add('lcp-needs-improvement');
            } else {
              lcpElement.classList.add('lcp-poor');
            }
          }
        }
      } else {
        console.error('Popup: No stats received:', response);
        this.showError(response.error || 'Failed to load stats');
      }
    } catch (error) {
      console.error('Popup: Error loading stats:', error);
      this.showError(`Failed to load stats: ${error.message}`);
    }
  }

  updateStats(stats) {
    // Store performance data for export
    this.performanceData = stats;

    document.getElementById('totalImages').textContent = stats.totalImages || 0;
    document.getElementById('optimized').textContent = stats.optimized || 0;
    document.getElementById('lazyLoaded').textContent = stats.lazyLoaded || 0;
    document.getElementById('eagerLoaded').textContent = stats.eagerLoaded || 0;
    document.getElementById('issues').textContent = stats.issues || 0;

    // Display LCP value with proper formatting
    const lcpElement = document.getElementById('lcpValue');
    console.log('Popup: Updating LCP display, element found:', !!lcpElement);

    if (!lcpElement) {
      console.error('Popup: LCP element not found!');
      return;
    }

    console.log('Popup: LCP value to display:', stats.lcpValue);
    console.log('Popup: LCP value type:', typeof stats.lcpValue);
    console.log('Popup: LCP value === null:', stats.lcpValue === null);
    console.log('Popup: LCP value === undefined:', stats.lcpValue === undefined);

    // Try to convert to number if it's a string
    let lcpValue = stats.lcpValue;
    if (typeof lcpValue === 'string') {
      lcpValue = parseFloat(lcpValue);
      console.log('Popup: Converted string to number:', lcpValue);
    }

    // More robust check for valid LCP value
    const isValidLCP = lcpValue !== null && lcpValue !== undefined && !isNaN(lcpValue) && lcpValue > 0;

    console.log('Popup: Is LCP value valid?', isValidLCP);

    if (isValidLCP) {
      const lcpMs = Math.round(lcpValue);
      console.log('Popup: Setting LCP display to:', lcpMs, 'ms');

      try {
        lcpElement.textContent = lcpMs;

        // Color code based on LCP performance (Core Web Vitals thresholds)
        lcpElement.className = 'stat-number'; // Reset classes
        if (lcpMs <= 2500) {
          lcpElement.classList.add('lcp-good');
          console.log('Popup: Added lcp-good class');
        } else if (lcpMs <= 4000) {
          lcpElement.classList.add('lcp-needs-improvement');
          console.log('Popup: Added lcp-needs-improvement class');
        } else {
          lcpElement.classList.add('lcp-poor');
          console.log('Popup: Added lcp-poor class');
        }

        console.log('Popup: Final element text:', lcpElement.textContent);
        console.log('Popup: Final element classes:', lcpElement.className);
      } catch (error) {
        console.error('Popup: Error updating LCP element:', error);
      }
    } else {
      console.log('Popup: LCP value is null/undefined/NaN, setting to N/A');
      try {
        lcpElement.textContent = 'N/A';
        lcpElement.className = 'stat-number';
      } catch (error) {
        console.error('Popup: Error setting LCP to N/A:', error);
      }
    }

    // Additional check: if we have LCP data in performanceData but not in stats, use it
    if (this.performanceData && this.performanceData.lcpValue !== null && this.performanceData.lcpValue !== undefined && (stats.lcpValue === null || stats.lcpValue === undefined)) {
      console.log('Popup: Using LCP data from stored performanceData:', this.performanceData.lcpValue);
      const lcpMs = Math.round(this.performanceData.lcpValue);
      lcpElement.textContent = lcpMs;
      lcpElement.className = 'stat-number';
      if (lcpMs <= 2500) {
        lcpElement.classList.add('lcp-good');
      } else if (lcpMs <= 4000) {
        lcpElement.classList.add('lcp-needs-improvement');
      } else {
        lcpElement.classList.add('lcp-poor');
      }
    }
  }

  updateStatsFromLCP(performanceData) {
    console.log('Popup: ===== LCP UPDATE START =====');
    console.log('Popup: Updating stats from LCP detection:', performanceData);
    console.log('Popup: LCP value from LCP detection:', performanceData.lcpValue);

    this.updateStats(performanceData);

    // Store the LCP data to compare against future updates
    this.lastKnownLCPData = {
      ...performanceData,
      timestamp: Date.now()
    };

    // Force refresh the stats to ensure consistency
    setTimeout(() => {
      console.log('Popup: Refreshing stats after LCP update');
      this.loadStats();
    }, 100);

    console.log('Popup: ===== LCP UPDATE END =====');
  }

  // Missing methods that are being called
  loadLibraryInfo() {
    try {
      // Get library information from content script instead of detecting locally
      chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'getLibraryInfo'
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.log('No library info available from content script');
          this.updateLibraryInfoDisplay({ error: 'Could not get library info from page' });
          return;
        }
        
        if (response && response.detectedLibraries) {
          console.log('Library info received from content script:', response);
          
          // Convert the detected libraries array to the expected format
          const libraryInfo = {
            detected: response.detectedLibraries.map(libName => ({
              name: libName,
              detected: true,
              usageCount: 1
            })),
            summary: {
              status: response.detectedLibraries.length > 0 
                ? `${response.detectedLibraries.length} lazy loading library(ies) detected`
                : 'No lazy loading detected',
              recommendation: response.detectedLibraries.length > 0
                ? 'Consider migrating to native lazy loading for better performance'
                : 'Consider implementing lazy loading for better performance'
            }
          };
          
          this.updateLibraryInfoDisplay(libraryInfo);
        } else {
          this.updateLibraryInfoDisplay({ error: 'No library data received' });
        }
      });
    } catch (error) {
      console.error('Failed to load library info:', error);
      this.updateLibraryInfoDisplay({ error: 'Failed to load library info' });
    }
  }

  updateLibraryInfoDisplay(libraryInfo) {
    const libraryInfoElement = document.getElementById('libraryInfo');
    if (!libraryInfoElement) return;

    if (libraryInfo.error) {
      libraryInfoElement.innerHTML = `<div class="error">${libraryInfo.error}</div>`;
      return;
    }

    if (!libraryInfo || !libraryInfo.detected || libraryInfo.detected.length === 0) {
      libraryInfoElement.innerHTML = '<div class="no-libraries">No lazy loading libraries detected</div>';
      return;
    }

    // Create HTML for detected libraries
    let html = '';
    for (const library of libraryInfo.detected) {
      html += `
        <div class="library-item">
          <div class="library-name">${library.name}</div>
          <div class="library-details">
            <span class="usage-count">Usage: ${library.usageCount}</span>
          </div>
        </div>
      `;
    }

    // Add summary if available
    if (libraryInfo.summary) {
      html += `
        <div class="library-summary">
          <div class="summary-status">${libraryInfo.summary.status}</div>
          <div class="summary-recommendation">${libraryInfo.summary.recommendation}</div>
        </div>
      `;
    }

    libraryInfoElement.innerHTML = html;
  }

  hasLCPDataChanged(newStats) {
    if (!this.lastKnownLCPData) return true;
    
    const oldLCP = this.lastKnownLCPData.lcpValue;
    const newLCP = newStats.lcpValue;
    
    // Check if LCP value has changed
    if (oldLCP !== newLCP) return true;
    
    // Check if LCP candidate has changed
    const oldCandidate = this.lastKnownLCPData.lcpCandidate;
    const newCandidate = newStats.lcpCandidate;
    
    return oldCandidate !== newCandidate;
  }

  showError(message) {
    console.error('Popup Error:', message);
    
    // Create or update error display
    let errorElement = document.getElementById('error-message');
    if (!errorElement) {
      errorElement = document.createElement('div');
      errorElement.id = 'error-message';
      errorElement.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: #ff4444;
        color: white;
        padding: 10px;
        border-radius: 5px;
        z-index: 1000;
        max-width: 300px;
        word-wrap: break-word;
      `;
      document.body.appendChild(errorElement);
    }
    
    errorElement.textContent = message;
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (errorElement && errorElement.parentNode) {
        errorElement.parentNode.removeChild(errorElement);
      }
    }, 5000);
  }

  requestPendingLCPData() {
    try {
      // Request any pending LCP data from the content script
      chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'getPendingLCPData'
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.log('No pending LCP data available');
          return;
        }
        
        if (response && response.lcpData) {
          this.updateStatsFromLCP(response.lcpData);
        }
      });
    } catch (error) {
      console.error('Failed to request pending LCP data:', error);
    }
  }

  startPeriodicRefresh() {
    // Clear any existing interval
    this.stopPeriodicRefresh();
    
    // Start periodic refresh every 2 seconds to catch LCP updates
    this.refreshInterval = setInterval(() => {
      console.log('Popup: Periodic refresh - checking for LCP data');
      this.loadStats();
    }, 2000);
  }

  stopPeriodicRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  // Debug function to manually test LCP update
  forceLCPUpdate() {
    console.log('Popup: Force LCP update called');

    // Manually set LCP data for testing
    const testData = {
      totalImages: 336,
      lazyLoaded: 32,
      eagerLoaded: 173,
      optimized: 122,
      issues: 41,
      lcpCandidates: 1,
      lcpValue: 500,
      preloaded: 0
    };

    console.log('Popup: Applying test LCP data:', testData);
    this.updateStats(testData);
  }

  // Debug function to test DOM manipulation directly
  testDOMUpdate() {
    console.log('Popup: Testing DOM manipulation directly');

    const lcpElement = document.getElementById('lcpValue');
    console.log('Popup: LCP element found:', !!lcpElement);

    if (lcpElement) {
      console.log('Popup: Current LCP element text:', lcpElement.textContent);
      console.log('Popup: Current LCP element classes:', lcpElement.className);

      // Try to update it directly
      try {
        lcpElement.textContent = '999';
        lcpElement.className = 'stat-number lcp-good';
        console.log('Popup: Successfully updated LCP element to 999');
        console.log('Popup: New LCP element text:', lcpElement.textContent);
        console.log('Popup: New LCP element classes:', lcpElement.className);
      } catch (error) {
        console.error('Popup: Error updating LCP element:', error);
      }
    } else {
      console.error('Popup: LCP element not found in DOM!');
    }
  }

  // Debug function to force LCP update with known data
  forceLCPUpdate() {
    console.log('Popup: Force LCP update called');

    // Manually set LCP data for testing
    const testData = {
      totalImages: 336,
      lazyLoaded: 32,
      eagerLoaded: 173,
      optimized: 122,
      issues: 41,
      lcpCandidates: 1,
      lcpValue: 500,
      preloaded: 0
    };

    console.log('Popup: Applying test LCP data:', testData);
    this.updateStats(testData);
  }

  // Request any pending LCP data that was stored while popup was closed
  requestPendingLCPData() {
    console.log('Popup: Requesting pending LCP data from content script');

    chrome.runtime.sendMessage({
      action: 'requestPendingLCPData'
    }).then(response => {
      if (response && response.success && response.pendingLCPData) {
        console.log('Popup: Received pending LCP data:', response.pendingLCPData);
        const pendingData = response.pendingLCPData;

        // Check if this data is newer than what we have
        if (this.shouldUsePendingData(pendingData)) {
          console.log('Popup: Using pending LCP data');
          this.updateStatsFromLCP(pendingData.performanceData);
        } else {
          console.log('Popup: Pending LCP data is not newer, ignoring');
        }
      } else {
        console.log('Popup: No pending LCP data available');
      }
    }).catch(error => {
      console.log('Popup: Error requesting pending LCP data:', error.message);
    });
  }

  shouldUsePendingData(pendingData) {
    // Use pending data if we don't have LCP data yet, or if it's newer
    const hasCurrentLCP = this.lastKnownLCPData && this.lastKnownLCPData.lcpValue !== null && this.lastKnownLCPData.lcpValue !== undefined;
    const hasPendingLCP = pendingData && pendingData.performanceData && pendingData.performanceData.lcpValue !== null && pendingData.performanceData.lcpValue !== undefined;

    if (!hasCurrentLCP && hasPendingLCP) {
      return true; // Use pending data if we don't have any LCP data
    }

    if (hasCurrentLCP && hasPendingLCP) {
      // Use pending data if it's newer (by comparing timestamps)
      const currentTime = this.lastKnownLCPData.timestamp || 0;
      const pendingTime = pendingData.timestamp || 0;
      return pendingTime > currentTime;
    }

    return false;
  }

  hasLCPDataChanged(newStats) {
    // Check if LCP value has changed
    const oldLCP = this.lastKnownLCPData?.lcpValue;
    const newLCP = newStats.lcpValue;

    // Also check if we went from no LCP data to having LCP data
    const hadNoLCP = oldLCP === null || oldLCP === undefined;
    const hasLCP = newLCP !== null && newLCP !== undefined;

    if (oldLCP !== newLCP && hasLCP) {
      console.log('Popup: LCP changed from', oldLCP, 'to', newLCP);
      return true;
    }

    // Special case: if we previously had no LCP data but now we do
    if (hadNoLCP && hasLCP) {
      console.log('Popup: LCP data appeared for the first time:', newLCP);
      return true;
    }

    return false;
  }

  startPeriodicRefresh() {
    // Stop any existing interval
    this.stopPeriodicRefresh();

    // Refresh stats every 2 seconds for the first 15 seconds to catch LCP updates
    this.refreshInterval = setInterval(() => {
      if (this.isActive) {
        this.loadStats();
      }
    }, 2000);

    // Stop after 15 seconds
    setTimeout(() => {
      this.stopPeriodicRefresh();
      console.log('Popup: Periodic refresh stopped');

      // Do a final check for pending LCP data
      setTimeout(() => {
        console.log('Popup: Doing final check for pending LCP data');
        this.requestPendingLCPData();
      }, 500);
    }, 15000);
  }

  stopPeriodicRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }





  async exportReport() {
    if (!this.currentTab) return;

    try {
      // Get detailed image data from content script
      const imageResponse = await chrome.runtime.sendMessage({
        action: 'getDetailedImageData',
        tabId: this.currentTab.id
      });

      if (imageResponse.error) {
        this.showError(imageResponse.error);
        return;
      }



      // Get library detection results
      const libraryData = this.libraryDetector ? this.libraryDetector.detectLibraries() : null;

      // Prepare page info
      const pageInfo = {
        url: this.currentTab.url,
        title: this.currentTab.title
      };

      // Generate comprehensive CSV report
      if (this.csvExporter) {
        try {
          const report = this.csvExporter.generateComprehensiveReport(
            imageResponse.images || [],
            this.performanceData || {}, // Pass current performance data including LCP value
            libraryData || {},
            pageInfo
          );

          // Show success notification
          const btn = document.getElementById('exportBtn');
          const originalText = btn.textContent;
          btn.textContent = 'Exported!';
          btn.style.background = '#10b981';
          btn.style.color = 'white';
          
          setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '';
            btn.style.color = '';
          }, 2000);

          console.log('Report exported successfully:', report);
        } catch (error) {
          console.error('CSV export error:', error);
          this.showError('Failed to generate CSV report: ' + error.message);
        }
      } else {
        // Fallback to original export method
        const response = await chrome.runtime.sendMessage({
          action: 'exportReport',
          tabId: this.currentTab.id
        });

        if (!response.success) {
          this.showError(response.error || 'Failed to export report');
        }
      }
    } catch (error) {
      this.showError(`Export failed: ${error.message}`);
    }
  }

  showError(message) {
    console.error('Popup error:', message);
    
    // Create error element if it doesn't exist
    let errorEl = document.querySelector('.error');
    if (!errorEl) {
      errorEl = document.createElement('div');
      errorEl.className = 'error';
      document.querySelector('.content').insertBefore(errorEl, document.querySelector('.stats-grid'));
    }
    
    errorEl.textContent = message;
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (errorEl.parentNode) {
        errorEl.remove();
      }
    }, 5000);
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const popupController = new PopupController();
  // Make it available for debugging
  window.popupController = popupController;
  window.forceLCPUpdate = () => popupController.forceLCPUpdate();
  window.testDOMUpdate = () => popupController.testDOMUpdate();
  window.checkLCPDisplay = () => {
    const el = document.getElementById('lcpValue');
    console.log('LCP Element:', el);
    console.log('LCP Text:', el ? el.textContent : 'NOT FOUND');
    console.log('LCP Classes:', el ? el.className : 'NOT FOUND');
    return el;
  };
  window.debugLCPState = () => {
    console.log('=== LCP DEBUG STATE ===');
    console.log('Popup performanceData:', popupController.performanceData);
    console.log('Popup lastKnownLCPData:', popupController.lastKnownLCPData);
    checkLCPDisplay();
    console.log('======================');
  };
});

