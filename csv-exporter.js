// CSV Exporter for Lazy Spy
// Generates comprehensive image-by-image analysis reports

class CSVExporter {
  constructor() {
    this.headers = [
      'Image URL',
      'File Size (KB)',
      'Dimensions',
      'Loading Strategy',
      'Library Used',
      'Performance Score',
      'Issues Found',
      'Recommendations',
      'Optimization Potential',
      'Estimated Savings (KB)',
      'LCP Candidate',
      'Above Fold',
      'Preloaded',
      'Fetch Priority',
      'Decoding',
      'Alt Text Present',
      'Responsive Image'
    ];
  }

  generateImageAnalysisCSV(images, pageInfo = {}, performanceData = null) {
    const rows = [];
    
    // Add page information as metadata
    rows.push(['Page Analysis Report']);
    rows.push(['Generated', new Date().toISOString()]);
    rows.push(['URL', pageInfo.url || window.location.href]);
    rows.push(['Title', pageInfo.title || document.title]);
    rows.push([]);
    
    // Add headers
    rows.push(this.headers);
    
    // Add image data
    images.forEach(img => {
      const row = [
        this.sanitizeCSVValue(img.src),
        this.formatFileSize(img.fileSize),
        `${img.width}x${img.height}`,
        img.loadingStrategy || 'Unknown',
        img.library || 'None',
        img.performanceScore || 'N/A',
        this.formatArray(img.issues),
        this.formatArray(img.recommendations),
        img.optimizationPotential || 'Unknown',
        this.formatFileSize(img.estimatedSavings),
        img.isLCP ? 'Yes' : 'No',
        img.isAboveFold ? 'Yes' : 'No',
        img.isPreloaded ? 'Yes' : 'No',
        img.fetchPriority || 'None',
        img.decoding || 'None',
        img.hasAltText ? 'Yes' : 'No',
        img.isResponsive ? 'Yes' : 'No'
      ];
      
      rows.push(row);
    });
    
    // Add summary statistics
    rows.push([]);
    rows.push(['Summary Statistics']);
    rows.push(['Total Images', images.length]);
    rows.push(['Total File Size (KB)', this.calculateTotalFileSize(images)]);
    rows.push(['Average File Size (KB)', this.calculateAverageFileSize(images)]);
    rows.push(['Lazy Loaded Images', this.countByStrategy(images, 'lazy')]);
    rows.push(['Eager Loaded Images', this.countByStrategy(images, 'eager')]);
    rows.push(['Optimized Images', this.countOptimized(images)]);
    rows.push(['Images with Issues', this.countWithIssues(images)]);
    rows.push(['LCP Candidates', this.countLCPCandidates(images)]);

    // Add LCP value if available (passed from performance data)
    console.log('CSVExporter: performanceData received:', performanceData);
    console.log('CSVExporter: lcpValue check:', performanceData?.lcpValue);
    
    if (performanceData && performanceData.lcpValue !== null && performanceData.lcpValue !== undefined) {
      const lcpMs = Math.round(performanceData.lcpValue);
      const lcpStatus = lcpMs <= 2500 ? 'Good' : lcpMs <= 4000 ? 'Needs Work' : 'Poor';
      rows.push(['LCP Value (ms)', lcpMs]);
      rows.push(['LCP Status', lcpStatus]);
      console.log('CSVExporter: Added LCP to CSV:', lcpMs, lcpStatus);
    } else {
      rows.push(['LCP Value (ms)', 'Not Detected']);
      rows.push(['LCP Status', 'Unknown']);
      console.log('CSVExporter: LCP not detected in performanceData');
    }

    rows.push(['Estimated Total Savings (KB)', this.calculateTotalSavings(images)]);
    
    return this.createCSV(rows);
  }

  generatePerformanceReportCSV(performanceData, pageInfo = {}) {
    const rows = [];
    
    // Add report header
    rows.push(['Performance Analysis Report']);
    rows.push(['Generated', new Date().toISOString()]);
    rows.push(['URL', pageInfo.url || window.location.href]);
    rows.push(['Title', pageInfo.title || document.title]);
    rows.push([]);
    
    // Add Core Web Vitals
    rows.push(['Core Web Vitals']);
    rows.push(['Metric', 'Value', 'Score', 'Status']);
    
    if (performanceData.metrics.lcp) {
      rows.push(['LCP', `${performanceData.metrics.lcp.value}ms`, performanceData.scores.lcp, this.getStatus(performanceData.scores.lcp)]);
    }
    if (performanceData.metrics.fid) {
      rows.push(['FID', `${performanceData.metrics.fid.value}ms`, performanceData.scores.fid, this.getStatus(performanceData.scores.fid)]);
    }
    if (performanceData.metrics.cls) {
      rows.push(['CLS', performanceData.metrics.cls.value, performanceData.scores.cls, this.getStatus(performanceData.scores.cls)]);
    }
    if (performanceData.metrics.fcp) {
      rows.push(['FCP', `${performanceData.metrics.fcp.value}ms`, performanceData.scores.fcp, this.getStatus(performanceData.scores.fcp)]);
    }
    if (performanceData.metrics.ttfb) {
      rows.push(['TTFB', `${performanceData.metrics.ttfb.value}ms`, performanceData.scores.ttfb, this.getStatus(performanceData.scores.ttfb)]);
    }
    
    rows.push([]);
    rows.push(['Overall Performance Score', performanceData.scores.overall, '', this.getStatus(performanceData.scores.overall)]);
    
    // Add optimization opportunities
    if (performanceData.opportunities && performanceData.opportunities.length > 0) {
      rows.push([]);
      rows.push(['Optimization Opportunities']);
      rows.push(['Type', 'Priority', 'Description', 'Recommendations']);
      
      performanceData.opportunities.forEach(opp => {
        rows.push([
          opp.type.toUpperCase(),
          opp.priority,
          opp.description,
          opp.recommendations.join('; ')
        ]);
      });
    }
    
    return this.createCSV(rows);
  }

  generateLibraryAnalysisCSV(libraries, pageInfo = {}) {
    const rows = [];
    
    rows.push(['Lazy Loading Library Analysis']);
    rows.push(['Generated', new Date().toISOString()]);
    rows.push(['URL', pageInfo.url || window.location.href]);
    rows.push([]);
    
    rows.push(['Library', 'Detected', 'Usage Count', 'Recommendations']);
    
    Object.entries(libraries).forEach(([library, data]) => {
      rows.push([
        library,
        data.detected ? 'Yes' : 'No',
        data.usageCount || 0,
        data.recommendations ? data.recommendations.join('; ') : 'None'
      ]);
    });
    
    return this.createCSV(rows);
  }

  createCSV(rows) {
    return rows.map(row => 
      row.map(cell => this.sanitizeCSVValue(cell)).join(',')
    ).join('\n');
  }

  sanitizeCSVValue(value) {
    if (value === null || value === undefined) return '';
    
    const stringValue = String(value);
    
    // If value contains comma, quote, or newline, wrap in quotes and escape internal quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    
    return stringValue;
  }

  formatFileSize(bytes) {
    if (!bytes || bytes === 'Unknown') return 'Unknown';
    
    // If it's already a formatted string (like "150KB" or "2.5MB"), return as is
    if (typeof bytes === 'string' && (bytes.includes('KB') || bytes.includes('MB'))) {
      return bytes;
    }
    
    // If it's a number, convert to KB
    if (typeof bytes === 'number') {
      return (bytes / 1024).toFixed(2);
    }
    
    return 'Unknown';
  }

  formatArray(array) {
    if (!array || !Array.isArray(array) || array.length === 0) return 'None';
    return array.join('; ');
  }

  getStatus(score) {
    if (score >= 90) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Needs Improvement';
    return 'Poor';
  }

  parseFileSize(fileSize) {
    if (!fileSize || fileSize === 'Unknown') return 0;
    
    if (typeof fileSize === 'number') {
      return fileSize;
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

  calculateTotalFileSize(images) {
    return images.reduce((total, img) => {
      const sizeInKB = this.parseFileSize(img.fileSize);
      return total + sizeInKB;
    }, 0);
  }

  calculateAverageFileSize(images) {
    const totalSize = this.calculateTotalFileSize(images);
    return images.length > 0 ? (totalSize / images.length).toFixed(2) : 0;
  }

  countByStrategy(images, strategy) {
    return images.filter(img => img.loadingStrategy === strategy).length;
  }

  countOptimized(images) {
    return images.filter(img => img.optimizationScore > 80).length;
  }

  countWithIssues(images) {
    return images.filter(img => img.issues && img.issues.length > 0).length;
  }

  countLCPCandidates(images) {
    return images.filter(img => img.isLCP).length;
  }

  calculateTotalSavings(images) {
    return images.reduce((total, img) => {
      const savingsInKB = this.parseFileSize(img.estimatedSavings);
      return total + savingsInKB;
    }, 0);
  }

  // Download CSV file
  downloadCSV(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  // Generate comprehensive report
  generateComprehensiveReport(images, performanceData, libraries, pageInfo = {}) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `lazy-spy-report-${timestamp}.csv`;
    
    // Generate image analysis CSV
    const imageCSV = this.generateImageAnalysisCSV(images, pageInfo, performanceData);
    
    // Generate library analysis CSV
    const libraryCSV = this.generateLibraryAnalysisCSV(libraries, pageInfo);
    
    // Combine CSV content (skip performance data since it's not available)
    const csvContent = imageCSV + '\n\n' + libraryCSV;
    
    this.downloadCSV(csvContent, filename);
    
    return {
      filename,
      rowCount: this.countRows(csvContent),
      fileSize: this.formatFileSize(csvContent.length)
    };
  }

  countRows(csvContent) {
    return csvContent.split('\n').length;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CSVExporter;
}

// Make available globally for popup
if (typeof window !== 'undefined') {
  window.CSVExporter = CSVExporter;
}
