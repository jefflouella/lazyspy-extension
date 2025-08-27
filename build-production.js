const fs = require('fs');
const path = require('path');

console.log('🔧 Building production version...');

// Remove debug console logs from content.js
const contentJsPath = 'content.js';
let contentJs = fs.readFileSync(contentJsPath, 'utf8');

// Remove console.log statements (keep console.error for critical errors)
contentJs = contentJs.replace(/console\.log\([^)]*\);?\s*/g, '');
contentJs = contentJs.replace(/console\.warn\([^)]*\);?\s*/g, '');

// Remove test page specific code more carefully
contentJs = contentJs.replace(
  /\/\/ Only warn about lazy loading above-fold if it's not a test page scenario[\s\S]*?const isTestPage = window\.location\.href\.includes\('test-page'\) \|\|[\s\S]*?window\.location\.href\.includes\('127\.0\.0\.1'\);[\s\S]*?if \(data\.strategy === 'lazy' && data\.position === 'above-fold' && !isTestPage\) \{[\s\S]*?recommendations\.push\('Avoid lazy loading above-fold images - this hurts LCP'\);/g,
  `// Check for lazy loading above-fold (performance issue)
    if (data.strategy === 'lazy' && data.position === 'above-fold') {
      recommendations.push('Avoid lazy loading above-fold images - this hurts LCP');
    }`
);

fs.writeFileSync('content.js', contentJs);

// Remove debug code from popup.js
const popupJsPath = 'popup.js';
let popupJs = fs.readFileSync(popupJsPath, 'utf8');

// Remove debug console logs
popupJs = popupJs.replace(/console\.log\([^)]*\);?\s*/g, '');
popupJs = popupJs.replace(/console\.warn\([^)]*\);?\s*/g, '');

// Remove debug functions more carefully
popupJs = popupJs.replace(
  /\/\/ Debug function to manually test LCP update[\s\S]*?window\.debugLCPState[\s\S]*?\};[\s\S]*?document\.addEventListener\('DOMContentLoaded', \(\) => \{[\s\S]*?const popupController = new PopupController\(\);[\s\S]*?window\.debugLCPState[\s\S]*?\};[\s\S]*?\}\);/g,
  `// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const popupController = new PopupController();
});`
);

fs.writeFileSync('popup.js', popupJs);

// Remove debug code from background.js
const backgroundJsPath = 'background.js';
let backgroundJs = fs.readFileSync(backgroundJsPath, 'utf8');

// Remove debug console logs
backgroundJs = backgroundJs.replace(/console\.log\([^)]*\);?\s*/g, '');
backgroundJs = backgroundJs.replace(/console\.warn\([^)]*\);?\s*/g, '');

fs.writeFileSync('background.js', backgroundJs);

// Update manifest.json for production
const manifestPath = 'manifest.json';
let manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// Update version for production
manifest.version = '1.0.0';

// Add production description
manifest.description = 'Professional image loading analyzer that visualizes lazy loading strategies, performance issues, and optimization opportunities on any webpage. Perfect for developers and performance engineers.';

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

console.log('✅ Production build completed!');
console.log('📦 Ready for Chrome Web Store submission');
