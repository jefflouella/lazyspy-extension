// Lazy Spy Background Script
class BackgroundService {
  constructor() {
    this.activeTabs = new Set();
    this.init();
  }

  init() {
    // Listen for messages from popup and content scripts
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep message channel open for async response
    });

    // Handle tab updates
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && this.activeTabs.has(tabId)) {
        // Re-activate the extension for this tab
        this.activateForTab(tabId);
      }
    });

    // Handle tab removal
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.activeTabs.delete(tabId);
    });
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'toggle':
          await this.handleToggle(request, sender, sendResponse);
          break;
        case 'getStats':
          await this.handleGetStats(request, sender, sendResponse);
          break;
        case 'getActiveTabs':
          await this.handleGetActiveTabs(request, sender, sendResponse);
          break;
        case 'exportReport':
          await this.handleExportReport(request, sender, sendResponse);
          break;
        case 'toggleShowAll':
          await this.handleToggleShowAll(request, sender, sendResponse);
          break;
        case 'getDetailedImageData':
          await this.handleGetDetailedImageData(request, sender, sendResponse);
          break;
        case 'getLibraryInfo':
          await this.handleGetLibraryInfo(request, sender, sendResponse);
          break;
        case 'lcpDetected':
          await this.handleLCPDetected(request, sender, sendResponse);
          break;
        default:
          sendResponse({ error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Background script error:', error);
      sendResponse({ error: error.message });
    }
  }

  async handleToggle(request, sender, sendResponse) {
    const tabId = request.tabId || sender.tab?.id;
    if (!tabId) {
      sendResponse({ error: 'No tab context' });
      return;
    }

    try {
      // First, check if content script is ready by sending a ping
      try {
        await chrome.tabs.sendMessage(tabId, { action: 'ping' });
      } catch (pingError) {
        await this.injectContentScript(tabId);
        // Wait a moment for the script to initialize
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Send toggle message to content script
      const response = await chrome.tabs.sendMessage(tabId, { action: 'toggle' });
      
      // Ensure response has the expected structure
      if (response && typeof response.isActive === 'boolean') {
        if (response.isActive) {
          this.activeTabs.add(tabId);
        } else {
          this.activeTabs.delete(tabId);
        }
        sendResponse(response);
      } else {
        console.error('Background: Invalid response structure:', response);
        console.error('Background: Response type:', typeof response);
        console.error('Background: Response keys:', response ? Object.keys(response) : 'undefined');
        console.error('Background: Response values:', response);
        
        // Try to extract isActive from response if it exists but is not boolean
        if (response && response.hasOwnProperty('isActive')) {
          console.error('Background: isActive exists but is not boolean:', response.isActive, 'type:', typeof response.isActive);
          const isActive = Boolean(response.isActive);
          if (isActive) {
            this.activeTabs.add(tabId);
          } else {
            this.activeTabs.delete(tabId);
          }
          sendResponse({ success: true, isActive: isActive });
        } else {
          sendResponse({ error: 'Invalid response from content script', success: false });
        }
      }
    } catch (error) {
      // Content script might not be ready yet
      if (error.message.includes('Could not establish connection')) {
        try {
          // Inject content script and try again
          await this.injectContentScript(tabId);
          // Wait a moment for the script to initialize
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const response = await chrome.tabs.sendMessage(tabId, { action: 'toggle' });
          
          // Ensure response has the expected structure
          if (response && typeof response.isActive === 'boolean') {
            if (response.isActive) {
              this.activeTabs.add(tabId);
            }
            sendResponse(response);
          } else {
            console.error('Background: Invalid response structure after injection:', response);
            sendResponse({ error: 'Invalid response from content script', success: false });
          }
        } catch (injectionError) {
          console.error('Background: Failed to inject content script:', injectionError);
          sendResponse({ error: 'Failed to inject content script: ' + injectionError.message, success: false });
        }
      } else {
        sendResponse({ error: error.message, success: false });
      }
    }
  }

  async handleGetStats(request, sender, sendResponse) {
    const tabId = request.tabId || sender.tab?.id;
    if (!tabId) {
      sendResponse({ error: 'No tab context' });
      return;
    }

    try {
      const response = await chrome.tabs.sendMessage(tabId, { action: 'getStats' });
      sendResponse(response);
    } catch (error) {
      // Content script might not be ready yet
      if (error.message.includes('Could not establish connection')) {
        try {
          // Inject content script and try again
          await this.injectContentScript(tabId);
          const response = await chrome.tabs.sendMessage(tabId, { action: 'getStats' });
          sendResponse(response);
        } catch (injectionError) {
          console.error('Background: Failed to inject content script for stats:', injectionError);
          sendResponse({ error: 'Failed to inject content script: ' + injectionError.message });
        }
      } else {
        sendResponse({ error: error.message });
      }
    }
  }

  async handleGetActiveTabs(request, sender, sendResponse) {
    const activeTabs = Array.from(this.activeTabs);
    sendResponse({ activeTabs });
  }

  async handleExportReport(request, sender, sendResponse) {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ error: 'No tab context' });
      return;
    }

    try {
      // Get current tab info
      const tab = await chrome.tabs.get(tabId);
      
      // Get stats from content script
      const statsResponse = await chrome.tabs.sendMessage(tabId, { action: 'getStats' });
      
      if (statsResponse.error) {
        sendResponse({ error: statsResponse.error });
        return;
      }

      // Generate report
      const report = this.generateReport(tab, statsResponse.stats);
      
      // Create and download report
      const blob = new Blob([report], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      
      await chrome.downloads.download({
        url: url,
        filename: `image-optimization-report-${new Date().toISOString().split('T')[0]}.csv`,
        saveAs: true
      });

      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ error: error.message });
    }
  }

  generateReport(tab, stats) {
    const timestamp = new Date().toISOString();
    const url = tab.url;
    const title = tab.title;

    const csv = [
      'Image Loading Optimization Report',
      `Generated: ${timestamp}`,
      `URL: ${url}`,
      `Page Title: ${title}`,
      '',
      'Metric,Count,Percentage',
      `Total Images,${stats.totalImages},100%`,
      `Lazy Loaded,${stats.lazyLoaded},${stats.totalImages ? Math.round((stats.lazyLoaded / stats.totalImages) * 100) : 0}%`,
      `Eager Loaded,${stats.eagerLoaded},${stats.totalImages ? Math.round((stats.eagerLoaded / stats.totalImages) * 100) : 0}%`,
      `Optimized,${stats.optimized},${stats.totalImages ? Math.round((stats.optimized / stats.totalImages) * 100) : 0}%`,
      `Performance Issues,${stats.issues},${stats.totalImages ? Math.round((stats.issues / stats.totalImages) * 100) : 0}%`,
      `LCP Candidates,${stats.lcpCandidates},${stats.totalImages ? Math.round((stats.lcpCandidates / stats.totalImages) * 100) : 0}%`,
      `LCP Value (ms),${stats.lcpValue !== null ? Math.round(stats.lcpValue) : 'N/A'},${stats.lcpValue !== null ? (stats.lcpValue <= 2500 ? 'Good' : stats.lcpValue <= 4000 ? 'Needs Work' : 'Poor') : 'N/A'}`,
      `Preloaded,${stats.preloaded},${stats.totalImages ? Math.round((stats.preloaded / stats.totalImages) * 100) : 0}%`,
      '',
      'Recommendations:',
      '- Add width and height attributes to prevent CLS',
      '- Use lazy loading for below-fold images',
      '- Preload LCP images for better performance',
      '- Set fetchpriority="high" for LCP images',
      '- Add decoding="async" for non-blocking decode'
    ].join('\n');

    return csv;
  }

  async injectContentScript(tabId) {
    try {
      // First check if we can inject into this tab
      const tab = await chrome.tabs.get(tabId);
      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        throw new Error('Cannot inject into chrome:// or chrome-extension:// pages');
      }
      
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js']
      });
      
      // Also inject CSS
      try {
        await chrome.scripting.insertCSS({
          target: { tabId },
          files: ['content.css']
        });
        } catch (cssError) {
        }
      
    } catch (error) {
      console.error('Background: Failed to inject content script:', error);
      throw error;
    }
  }

  async activateForTab(tabId) {
    if (this.activeTabs.has(tabId)) {
      try {
        await chrome.tabs.sendMessage(tabId, { action: 'toggle' });
      } catch (error) {
        // Content script not ready, will be handled on next toggle
        }
    }
  }

  async handleGetDetailedImageData(request, sender, sendResponse) {
    const tabId = request.tabId || sender.tab?.id;
    if (!tabId) {
      sendResponse({ error: 'No tab context' });
      return;
    }

    try {
      const response = await chrome.tabs.sendMessage(tabId, { action: 'getDetailedImageData' });
      sendResponse(response);
    } catch (error) {
      // Content script might not be ready yet
      if (error.message.includes('Could not establish connection')) {
        try {
          // Inject content script and try again
          await this.injectContentScript(tabId);
          const response = await chrome.tabs.sendMessage(tabId, { action: 'getDetailedImageData' });
          sendResponse(response);
        } catch (injectionError) {
          console.error('Background: Failed to inject content script for detailed data:', injectionError);
          sendResponse({ error: 'Failed to inject content script: ' + injectionError.message });
        }
      } else {
        sendResponse({ error: error.message });
      }
    }
  }

  async handleLCPDetected(request, sender, sendResponse) {
    // Forward the LCP detection to the popup
    try {
      // Send message to popup to update statistics
      const messageResult = await chrome.runtime.sendMessage({
        action: 'updateStatsFromLCP',
        performanceData: request.performanceData
      });

      } catch (error) {
      // This might happen if popup is not open or listening
    }

    sendResponse({ success: true });
  }

  async handleGetLibraryInfo(request, sender, sendResponse) {
    const tabId = request.tabId || sender.tab?.id;
    if (!tabId) {
      sendResponse({ error: 'No tab context' });
      return;
    }

    try {
      const response = await chrome.tabs.sendMessage(tabId, { action: 'getLibraryInfo' });
      sendResponse(response);
    } catch (error) {
      // Content script might not be ready yet
      if (error.message.includes('Could not establish connection')) {
        try {
          // Inject content script and try again
          await this.injectContentScript(tabId);
          const response = await chrome.tabs.sendMessage(tabId, { action: 'getLibraryInfo' });
          sendResponse(response);
        } catch (injectionError) {
          console.error('Background: Failed to inject content script for library info:', injectionError);
          sendResponse({ error: 'Failed to inject content script: ' + injectionError.message });
        }
      } else {
        sendResponse({ error: error.message });
      }
    }
  }

  async handleToggleShowAll(request, sender, sendResponse) {
    const tabId = request.tabId || sender.tab?.id;
    if (!tabId) {
      sendResponse({ error: 'No tab context' });
      return;
    }

    try {
      const response = await chrome.tabs.sendMessage(tabId, { action: 'toggleShowAll' });
      sendResponse(response);
    } catch (error) {
      // Content script might not be ready yet
      if (error.message.includes('Could not establish connection')) {
        try {
          // Inject content script and try again
          await this.injectContentScript(tabId);
          const response = await chrome.tabs.sendMessage(tabId, { action: 'toggleShowAll' });
          sendResponse(response);
        } catch (injectionError) {
          console.error('Background: Failed to inject content script for show all:', injectionError);
          sendResponse({ error: 'Failed to inject content script: ' + injectionError.message });
        }
      } else {
        sendResponse({ error: error.message });
      }
    }
  }
}

// Initialize background service
new BackgroundService();
