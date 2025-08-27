# Lazy Spy - Image Performance Analyzer

A professional Chrome extension that analyzes and visualizes image loading strategies on webpages to help developers optimize performance.

![Lazy Spy Logo](lazyspylogo.png)

## 🚀 Features

### 🔍 **Image Loading Analysis**
- **Lazy Loading Detection**: Identifies LazySizes, LoZad, Intersection Observer, React Lazy Load, Vue LazyLoad, and custom implementations
- **Native Lazy Loading**: Detects `loading="lazy"` attributes
- **Preload Detection**: Identifies preloaded images and resources
- **Background Image Analysis**: Analyzes CSS background images and carousel implementations

### 🎨 **Visual Overlays**
- **Color-Coded System**:
  - 🟢 **Green**: Optimized images (preloaded LCP, lazy-loaded below fold)
  - 🔵 **Blue**: Lazy loaded images
  - 🟡 **Yellow**: Eager loaded images
  - 🔴 **Red**: Performance issues (missing dimensions, blocking LCP)
  - 🟠 **Teal**: Preloaded images
  - 🟣 **Purple**: LCP candidate images

### 📊 **Performance Metrics**
- **LCP (Largest Contentful Paint)**: Real-time detection and analysis
- **Loading Strategy Analysis**: Comprehensive breakdown of image loading methods
- **Performance Scoring**: Individual image optimization scores
- **Issue Detection**: Missing dimensions, format optimization, CDN analysis

### 📈 **Advanced Features**
- **CSV Export**: Detailed performance reports for team sharing
- **Library Detection**: Automatic detection of popular lazy loading libraries
- **Responsive Analysis**: Srcset and responsive image detection
- **Hero Image Identification**: Automatic detection of above-fold critical images

## 🛠️ Installation

### From Chrome Web Store (Recommended)
1. Visit the Chrome Web Store
2. Search for "Lazy Spy - Image Performance Analyzer"
3. Click "Add to Chrome"

### From Source (Development)
1. Clone the repository:
   ```bash
   git clone https://github.com/jefflouella/lazyspy-extension.git
   cd lazyspy-extension
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

4. Load in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the project directory

## 🎯 Usage

### Basic Analysis
1. **Navigate** to any webpage you want to analyze
2. **Click** the Lazy Spy extension icon in your toolbar
3. **Toggle** the extension on using the bomb button
4. **Observe** color-coded overlays on images throughout the page

### Understanding the Overlays
- **Hover** over any image to see detailed tooltips
- **Check** the extension popup for performance summary
- **Export** CSV reports for detailed analysis

### Performance Summary
The extension popup shows:
- **Total Images**: Count of all images on the page
- **Optimized**: Images with good loading strategies
- **Lazy Loaded**: Images using lazy loading
- **Eager Loaded**: Images loaded immediately
- **Issues**: Images with performance problems
- **LCP (ms)**: Largest Contentful Paint timing

## 🔧 Development

### Project Structure
```
lazyspy-extension/
├── src/
│   ├── background.js      # Background service worker
│   ├── content.js         # Content script for page analysis
│   ├── popup.js          # Popup interface logic
│   └── popup.html        # Popup interface
├── dist/                 # Built files (generated)
├── icons/               # Extension icons
├── manifest.json        # Extension manifest
└── webpack.config.js    # Build configuration
```

### Build Commands
```bash
# Development build
npm run build

# Production build
npm run build:prod

# Watch mode for development
npm run watch
```

### Key Technologies
- **Chrome Extension Manifest V3**
- **Webpack** for bundling
- **Intersection Observer API** for lazy loading detection
- **Performance Observer API** for LCP detection
- **CSS Grid/Flexbox** for responsive UI

## 📊 Supported Libraries

### Lazy Loading Libraries
- **LazySizes**: `lazyload` class detection
- **LoZad**: Intersection Observer implementation
- **React Lazy Load**: React-specific implementations
- **Vue LazyLoad**: Vue.js lazy loading
- **Custom Implementations**: Intersection Observer patterns
- **Native Lazy Loading**: `loading="lazy"` attribute

### Performance Analysis
- **LCP Detection**: Real-time Largest Contentful Paint measurement
- **File Size Analysis**: Image optimization recommendations
- **Format Optimization**: WebP, AVIF conversion suggestions
- **CDN Detection**: Cloudinary, Imgix, and other CDN analysis
- **Responsive Images**: Srcset and picture element analysis

## 🎨 Visual Indicators

### Border Styles
- **Solid borders**: LazySizes
- **Dashed borders**: LoZad
- **Dotted borders**: Intersection Observer
- **Double borders**: React Lazy Load
- **Grooved borders**: Vue LazyLoad
- **Ridge borders**: Custom implementations
- **Inset borders**: Native lazy loading
- **Outset borders**: Preloaded images

### Badge System
- **LCP**: Largest Contentful Paint candidates
- **PRELOAD**: Preloaded images
- **LAZY**: Lazy loaded images
- **EAGER**: Eager loaded images
- **OPTIMIZED**: Well-optimized images
- **ISSUE**: Performance issues detected

## 📈 Performance Recommendations

The extension provides actionable recommendations for:
- **Missing Dimensions**: Add width/height attributes
- **Format Optimization**: Convert to WebP/AVIF
- **Lazy Loading**: Implement for below-fold images
- **Preloading**: Preload critical above-fold images
- **CDN Usage**: Optimize image delivery
- **Compression**: Reduce file sizes
- **Responsive Images**: Add srcset attributes

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and commit: `git commit -m 'Add feature'`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: Report bugs and feature requests on [GitHub Issues](https://github.com/jefflouella/lazyspy-extension/issues)
- **Documentation**: Check the [Wiki](https://github.com/jefflouella/lazyspy-extension/wiki) for detailed guides
- **Discussions**: Join the conversation in [GitHub Discussions](https://github.com/jefflouella/lazyspy-extension/discussions)

## 🏆 Chrome Web Store

**Lazy Spy - Image Performance Analyzer** is available on the Chrome Web Store for easy installation and automatic updates.

---

**Made with ❤️ for the web performance community**
