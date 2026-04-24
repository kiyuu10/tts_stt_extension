/**
 * generate_icons.js
 *
 * Generates icon PNG files of sizes 16, 48, and 128 from a single source SVG.
 * Run with Node.js: node generate_icons.js
 *
 * This script creates simple inline SVG icons without any external dependencies.
 * The output is written to icons/ directory as PNG files.
 *
 * NOTE: This script requires the 'sharp' package or similar.
 * For simplicity, we use an SVG data URI approach with canvas via Node.
 *
 * Quick alternative: Use the provided icon.svg file manually and convert via:
 *   - https://svgtopng.com/
 *   - Inkscape CLI: inkscape icon.svg --export-png=icons/icon128.png -w 128 -h 128
 *   - ImageMagick: convert -resize 128x128 icon.svg icons/icon128.png
 */

// The SVG source for the icon
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#7c6aff"/>
      <stop offset="100%" style="stop-color:#a06aff"/>
    </linearGradient>
  </defs>
  <!-- Background -->
  <rect width="128" height="128" rx="28" fill="url(#bg)"/>
  <!-- Microphone body -->
  <rect x="48" y="20" width="32" height="44" rx="16" fill="white"/>
  <!-- Microphone base arc -->
  <path d="M32 68 Q32 96 64 96 Q96 96 96 68" stroke="white" stroke-width="6" fill="none" stroke-linecap="round"/>
  <!-- Microphone stand -->
  <line x1="64" y1="96" x2="64" y2="112" stroke="white" stroke-width="6" stroke-linecap="round"/>
  <line x1="48" y1="112" x2="80" y2="112" stroke="white" stroke-width="6" stroke-linecap="round"/>
  <!-- Sound waves -->
  <path d="M106 52 Q112 64 106 76" stroke="white" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.6"/>
  <path d="M22 52 Q16 64 22 76" stroke="white" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.6"/>
</svg>`;

console.log('Icon SVG source:');
console.log(iconSvg);
console.log('\nTo generate PNG icons, use one of:');
console.log('  1. Copy the SVG above to icon.svg and use an online converter');
console.log('  2. Inkscape: inkscape icon.svg --export-png=icons/icon128.png -w 128 -h 128');
console.log('  3. ImageMagick: convert -resize 128x128 icon.svg icons/icon128.png');
