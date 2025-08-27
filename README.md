# Lazy Spy - Image Loading Optimizer Chrome Extension

A powerful Chrome extension that provides visual analysis of image loading strategies and performance optimization techniques on any webpage. The extension highlights different loading patterns, priorities, and optimization attributes to help developers identify performance opportunities and validate their image optimization implementations.

## 🚀 Features

### Visual Highlighting System
- **Color-coded overlays** on images based on loading strategy:
  - ![Green](icons/color-green.svg) **Green**: Properly optimized (preloaded LCP, lazy-loaded below fold)
  - ![Blue](icons/color-blue.svg) **Blue**: Lazy loaded images
  - ![Yellow](icons/color-yellow.svg) **Yellow**: Eager loaded images
  - ![Red](icons/color-red.svg) **Red**: Performance issues (missing dimensions, blocking LCP, etc.)
  - ![Teal](icons/color-teal.svg) **Teal**: Preloaded images
  - ![Purple](icons/color-purple.svg) **Purple**: LCP candidate images

### Enhanced Library Detection
- **Automatic detection** of popular lazy loading libraries:
  - **LazySizes**: Detects `data-src`, `data-srcset`, `lazyload` classes
  - **LoZad**: Detects `data-src` and `lozad` classes
  - **React Lazy Load**: Detects `react-lazy-load` classes and `data-lazy`
  - **Vue LazyLoad**: Detects `v-lazy` and `v-lazy-container` classes
  - **Intersection Observer**: Detects custom implementations
  - **Custom implementations**: Detects various data attributes and classes
  - **Native lazy loading**: Detects `loading="lazy"` attribute

### Library-Specific Visual Indicators
- **Border styles** differentiate between libraries:
  - **Solid borders**: LazySizes
  - **Dashed borders**: LoZad
  - **Dotted borders**: React LazyLoad
  - **Double borders**: Vue LazyLoad
  - **Groove borders**: Intersection Observer
  - **Ridge borders**: Custom implementations

### Advanced Detection
- **Native Lazy Loading**: Detect `loading="lazy"` attribute
- **JavaScript Libraries**: Intersection Observer, LazyLoad, Lozad, custom implementations
- **Performance Metrics**: LCP detection, fetch priority, preload status, decode strategy
- **Dynamic Content**: Monitor for images added via JavaScript after page load

### Interactive Tooltips
Hover over any highlighted image to see detailed information:
- Loading strategy and library used
- Fetch priority and decoding strategy
- Dimensions and file size estimation
- Position relative to viewport fold
- LCP candidate status
- **CDN detection** and optimization features
- **Hero image identification** with scoring
- **Comprehensive optimization recommendations**:
  - Missing dimensions suggestions
  - Format conversion opportunities
  - Responsive image improvements
  - File size optimization
  - Preloading opportunities
  - Fetch priority guidance

### Performance Dashboard
- Real-time statistics and metrics
- Overall performance scoring
- Exportable reports in CSV format
- Visual performance indicators
- **Library detection summary** with usage counts
- **Migration recommendations** for detected libraries

### Advanced Optimization Analysis
The extension provides comprehensive optimization recommendations for each image:

#### Missing Dimensions Calculator
- **Auto-calculates** suggested width/height attributes
- **Prevents layout shift** with precise dimension suggestions
- **Aspect ratio preservation** recommendations

#### Format Conversion Suggestions
- **WebP optimization**: "This JPEG could be 40% smaller as WebP"
- **AVIF detection**: Identifies opportunities for next-gen formats
- **Format-specific savings** estimates

#### Above-Fold Eager Loading Detection
- **Flags lazy-loaded images** that should be eager loaded
- **Performance impact analysis** for above-fold lazy loading
- **Automatic strategy recommendations**

#### Smart Preloading Analysis
- **Hero image identification** with scoring algorithm
- **Viewport analysis** for preload opportunities
- **Priority-based recommendations** for critical images

#### Fetch Priority Guidance
- **Critical image detection** for high priority
- **LCP candidate optimization** recommendations
- **Above-fold image priority** suggestions

#### Responsive Image Suggestions
- **High-DPI display detection** (2x, 3x)
- **Missing srcset identification**
- **Responsive breakpoint recommendations**

#### Image Size Optimization
- **File size alerts** for images over 500KB
- **Oversized image detection** (2x+ larger than display)
- **Compression recommendations** with estimated savings

#### CDN Analysis
- **Automatic CDN detection** (Cloudinary, Imgix, Cloudflare, etc.)
- **CDN optimization features** identification
- **Performance benefit analysis**

#### Service Worker Detection
- **Caching strategy identification**
- **Offline capability analysis**
- **Performance optimization suggestions**

#### Compression Analysis
- **Potential savings estimation** from better compression
- **Format-specific optimization** recommendations
- **Quality vs. size trade-off** guidance

## 📦 Installation

### Development Installation

1. **Clone or download** this repository to your local machine

2. **Open Chrome** and navigate to `chrome://extensions/`

3. **Enable Developer Mode** by toggling the switch in the top-right corner

4. **Click "Load unpacked"** and select the extension directory

5. **Pin the extension** to your toolbar for easy access

### Production Installation

Once the extension is published to the Chrome Web Store:
1. Visit the extension page in the Chrome Web Store
2. Click "Add to Chrome"
3. Confirm the installation

## 🎯 Usage

### Basic Usage

1. **Navigate** to any webpage you want to analyze
2. **Click the extension icon** in your Chrome toolbar
3. **Toggle the extension on** using the switch in the popup
4. **Observe** the color-coded overlays on images throughout the page
5. **Hover over images** to see detailed tooltips with performance information

### Advanced Features

#### Performance Dashboard
- View real-time statistics in the popup
- Monitor optimization metrics
- Track performance scores
- Export detailed reports
- **Library Detection**: See which lazy loading libraries are detected
- **Migration Guidance**: Get recommendations for optimizing detected libraries

#### Export Reports
- Click "Export Report" in the popup
- Download a CSV file with comprehensive analysis
- Includes recommendations for optimization

#### Help System
- Click "Help" for detailed usage instructions
- Learn about color coding and optimization strategies

## 🔧 Technical Details

### Architecture

The extension consists of three main components:

1. **Content Script** (`content.js`)
   - Scans DOM for images
   - Detects loading strategies
   - Applies visual overlays
   - Monitors dynamic content

2. **Background Script** (`background.js`)
   - Manages extension state
   - Handles communication
   - Processes reports
   - Manages tab states

3. **Popup Interface** (`popup.html/js/css`)
   - User controls and settings
   - Performance dashboard
   - Export functionality

### Detection Algorithms

#### Lazy Loading Detection
```javascript
// Native lazy loading
if (element.loading === 'lazy') return 'native';

// JavaScript libraries
if (element.dataset.src) return 'custom';
if (element.classList.contains('lazyload')) return 'class-based';
if (window.LazyLoad) return 'lazyload';
```

#### Performance Scoring
- **Excellent (90-100)**: Optimal configuration
- **Good (70-89)**: Minor optimizations needed
- **Needs Work (50-69)**: Several improvements required
- **Poor (0-49)**: Significant optimization needed

### Supported Loading Strategies

- ✅ **Native `loading="lazy"`**
- ✅ **LazySizes** library (`data-src`, `data-srcset`, `lazyload` classes)
- ✅ **LoZad** library (`data-src`, `lozad` classes)
- ✅ **React Lazy Load** (`react-lazy-load` classes, `data-lazy`)
- ✅ **Vue LazyLoad** (`v-lazy`, `v-lazy-container` classes)
- ✅ **Intersection Observer** implementations
- ✅ **Custom implementations** (various data attributes and classes)
- ✅ **Class-based lazy loading** (`lazy`, `lazy-image`, `lazy-load`)
- ✅ **Preload links** (`<link rel="preload" as="image">`)
- ✅ **Fetch priority attributes** (`fetchpriority="high/low"`)
- ✅ **Decoding strategies** (`decoding="async/sync"`)

## 🎨 Customization

### Color Scheme
The extension uses a colorblind-friendly palette:
- ![Green](icons/color-green.svg) **Green (#10b981)**: Optimized (preloaded LCP, lazy-loaded below fold)
- ![Blue](icons/color-blue.svg) **Blue (#3b82f6)**: Lazy loaded images
- ![Yellow](icons/color-yellow.svg) **Yellow (#f59e0b)**: Eager loaded images
- ![Red](icons/color-red.svg) **Red (#ef4444)**: Performance issues (missing dimensions, blocking LCP)
- ![Teal](icons/color-teal.svg) **Teal (#008080)**: Preloaded images
- ![Purple](icons/color-purple.svg) **Purple (#8b5cf6)**: LCP candidate images

### Border Styles for Libraries
- **Solid borders**: LazySizes library
- **Dashed borders**: LoZad library
- **Dotted borders**: React LazyLoad
- **Double borders**: Vue LazyLoad
- **Groove borders**: Intersection Observer
- **Ridge borders**: Custom implementations

### Styling
All visual styles can be customized in `content.css` and `popup.css`:
- Overlay colors and opacity
- Tooltip appearance
- Badge styling
- Responsive design

## 🐛 Troubleshooting

### Common Issues

**Extension not working on a page:**
- Ensure the page is fully loaded
- Check if the page has any images
- Try refreshing the page and toggling the extension

**No overlays appearing:**
- Verify the extension is activated
- Check browser console for errors
- Ensure the page allows content scripts

**Performance data not updating:**
- Click the refresh button in the popup
- Wait for the page to fully load
- Check for dynamic content loading

### Debug Mode

To enable debug logging:
1. Open Chrome DevTools
2. Go to the Console tab
3. Look for messages from "Image Loading Optimizer"

## 📈 Performance Impact

The extension is designed to be lightweight and non-intrusive:
- **Minimal overhead**: Only active when toggled on
- **Efficient detection**: Uses optimized algorithms
- **Non-blocking**: Doesn't interfere with page performance
- **Memory efficient**: Cleans up when deactivated

## 🤝 Contributing

### Development Setup

1. **Fork** the repository
2. **Create** a feature branch
3. **Make** your changes
4. **Test** thoroughly
5. **Submit** a pull request

### Code Style

- Use ES6+ features
- Follow Chrome extension best practices
- Maintain consistent formatting
- Add comments for complex logic

### Testing

Test the extension on various websites:
- E-commerce sites (many images)
- News sites (dynamic content)
- Portfolio sites (optimized images)
- Social media platforms

#### Test Page
Use the included `test-page.html` to test all features:
- **Library Detection**: Tests all supported lazy loading libraries
- **Visual Indicators**: Demonstrates all color-coded overlays
- **Performance Scenarios**: Shows various optimization states
- **Interactive Examples**: Hover over images to see detailed tooltips

To use the test page:
1. Open `test-page.html` in your browser
2. Activate the Lazy Spy extension
3. Observe the different visual indicators and library detection

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Chrome Extensions API documentation
- Web Performance community
- Image optimization best practices
- Modern web development standards

## 📞 Support

For issues, questions, or feature requests:
- Create an issue on GitHub
- Check the troubleshooting section
- Review the help documentation

---

**Happy optimizing! 🚀**
