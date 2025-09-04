import { writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

import { createCanvas, GlobalFonts } from "@napi-rs/canvas";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cache for registered fonts to avoid re-registration
const registeredFonts = new Set();

/**
 * QuranCanvas utility class for rendering Arabic Quran text with page-specific fonts
 */
class QuranCanvas {
  constructor() {
    this.assetsPath = join(
      __dirname,
      "..",
      "..",
      "assets",
      "fonts",
      "quran",
      "hafs"
    );
  }

  /**
   * Register a Quran font for a specific page and version
   * @param {number} page - Page number (1-604)
   * @param {string} version - Font version ("v1" or "v2")
   * @returns {string} Font family name that can be used in canvas context
   */
  registerPageFont(page, version = "v2") {
    const fontPath = join(this.assetsPath, version, "ttf", `p${page}.ttf`);
    const fontFamily = `QuranPage${page}V${version}`;

    // Check if font file exists
    if (!existsSync(fontPath)) {
      throw new Error(`Font file not found: ${fontPath}`);
    }

    // Check if already registered
    const fontKey = `${fontFamily}`;
    if (registeredFonts.has(fontKey)) {
      return fontFamily;
    }

    try {
      GlobalFonts.registerFromPath(fontPath, fontFamily);
      registeredFonts.add(fontKey);
      console.log(`Registered font: ${fontFamily} from ${fontPath}`);
      return fontFamily;
    } catch (error) {
      throw new Error(`Failed to register font ${fontPath}: ${error.message}`);
    }
  }

  /**
   * Register the general Uthmanic Hafs font
   * @returns {string} Font family name
   */
  registerUthmanicFont() {
    const fontPath = join(
      this.assetsPath,
      "uthmanic_hafs",
      "UthmanicHafs1Ver18.ttf"
    );
    const fontFamily = "UthmanicHafs";

    if (registeredFonts.has(fontFamily)) {
      return fontFamily;
    }

    if (!existsSync(fontPath)) {
      throw new Error(`Uthmanic font file not found: ${fontPath}`);
    }

    try {
      GlobalFonts.registerFromPath(fontPath, fontFamily);
      registeredFonts.add(fontFamily);
      console.log(`Registered Uthmanic font: ${fontFamily}`);
      return fontFamily;
    } catch (error) {
      throw new Error(`Failed to register Uthmanic font: ${error.message}`);
    }
  }

  /**
   * Create a canvas image with Quran glyphs rendered using page-specific fonts
   * @param {Object} options - Configuration options
   * @param {string} options.glyph - Arabic text/glyph to render
   * @param {number|number[]} options.pages - Page number(s) for font selection
   * @param {string} options.version - Font version ("v1" or "v2", default: "v2")
   * @param {number} options.width - Canvas width (default: 800)
   * @param {number} options.height - Canvas height (default: 600)
   * @param {number} options.fontSize - Font size (default: 48)
   * @param {string} options.fontColor - Text color (default: "#000000")
   * @param {string} options.backgroundColor - Background color (default: "#FFFFFF")
   * @param {string} options.textAlign - Text alignment ("left", "center", "right", default: "right")
   * @param {number} options.lineHeight - Line height multiplier (default: 1.5)
   * @param {Object} options.padding - Padding {top, right, bottom, left} (default: {top: 50, right: 50, bottom: 50, left: 50})
   * @returns {Buffer} PNG image buffer
   */
  createQuranImage(options) {
    const {
      glyph,
      pages,
      version = "v2",
      width = 800,
      height = 600,
      fontSize = 48,
      fontColor = "#000000",
      colorScheme = "dark",
      textAlign = "right",
      lineHeight = 1.5,
      padding = { top: 50, right: 50, bottom: 50, left: 0 },
    } = options;

    if (!glyph) {
      throw new Error("Glyph text is required");
    }

    if (!pages) {
      throw new Error("Page number(s) required");
    }

    // Validate version
    if (!["v2"].includes(version)) {
      throw new Error("Version must be 'v1' or 'v2'");
    }

    // Validate page numbers
    const pageArray = Array.isArray(pages) ? pages : [pages];
    for (const page of pageArray) {
      if (!Number.isInteger(page) || page < 1 || page > 604) {
        throw new Error(
          `Invalid page number: ${page}. Must be between 1 and 604.`
        );
      }
    }

    // Register fonts for all pages
    const fontFamilies = pageArray.map((page) =>
      this.registerPageFont(page, version)
    );

    // Create canvas
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // Configure text rendering
    if (colorScheme === "dark") {
      ctx.fillStyle = "#FFFFFF";
    } else {
      ctx.fillStyle = "#000000";
    }
    ctx.textAlign = textAlign;
    ctx.textBaseline = "top";

    // Split text into lines if needed
    const lines = this.wrapText(
      ctx,
      glyph,
      fontFamilies[0],
      fontSize,
      width - padding.left - padding.right
    );

    // Calculate starting position
    let startY = padding.top;
    const textWidth = width - padding.left - padding.right;

    // Render each line
    lines.forEach((line, index) => {
      // Use different fonts for different lines if multiple pages provided
      const fontFamily = fontFamilies[index % fontFamilies.length];
      ctx.font = `${fontSize}px ${fontFamily}`;

      let x;
      switch (textAlign) {
        case "center":
          x = width / 2;
          break;
        case "right":
          x = width - padding.right;
          break;
        default: // left
          x = padding.left;
      }

      const y = startY + index * fontSize * lineHeight;

      // Render the text
      ctx.fillText(line, x, y);

      // Optional: Add text stroke for better visibility
      ctx.strokeStyle = fontColor;
      ctx.lineWidth = 0.5;
      ctx.strokeText(line, x, y);
    });

    // Return image buffer
    return canvas.toBuffer("image/png");
  }

  /**
   * Wrap text to fit within specified width
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {string} text - Text to wrap
   * @param {string} fontFamily - Font family name
   * @param {number} fontSize - Font size
   * @param {number} maxWidth - Maximum width
   * @returns {string[]} Array of lines
   */
  wrapText(ctx, text, fontFamily, fontSize, maxWidth) {
    ctx.font = `${fontSize}px ${fontFamily}`;

    const words = text.split(" ");
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = ctx.measureText(currentLine + " " + word).width;

      if (width < maxWidth) {
        currentLine += " " + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
    return lines;
  }

  /**
   * Save Quran image to file
   * @param {Object} options - Same options as createQuranImage
   * @param {string} outputPath - Output file path
   */
  saveQuranImage(options, outputPath) {
    const buffer = this.createQuranImage(options);
    writeFileSync(outputPath, buffer);
    console.log(`Quran image saved to: ${outputPath}`);
  }

  /**
   * Get all registered font families
   * @returns {string[]} Array of registered font family names
   */
  getRegisteredFonts() {
    return Array.from(registeredFonts);
  }

  /**
   * Validate if a page font exists
   * @param {number} page - Page number
   * @param {string} version - Font version
   * @returns {boolean} True if font exists
   */
  isPageFontAvailable(page, version = "v2") {
    const fontPath = join(this.assetsPath, version, "ttf", `p${page}.ttf`);
    return existsSync(fontPath);
  }

  /**
   * Get available page range for a version
   * @param {string} version - Font version ("v1" or "v2")
   * @returns {Object} {min: number, max: number, available: number[]}
   */
  getAvailablePages(version = "v2") {
    const available = [];

    for (let page = 1; page <= 604; page++) {
      if (this.isPageFontAvailable(page, version)) {
        available.push(page);
      }
    }

    return {
      min: Math.min(...available),
      max: Math.max(...available),
      available: available,
      count: available.length,
    };
  }
}

export default QuranCanvas;
