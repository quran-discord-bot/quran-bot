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
    const canvas = createCanvas(Math.min(width, glyph.length * 30), height);
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
   * Create a canvas image with two Quran glyphs rendered vertically (top and bottom)
   * @param {Object} options - Configuration options
   * @param {Object} options.glyph1 - First glyph configuration (top)
   * @param {string} options.glyph1.text - Arabic text/glyph to render for first verse
   * @param {number|number[]} options.glyph1.pages - Page number(s) for font selection for first verse
   * @param {number} options.glyph1.fontSize - Font size for first verse (optional, uses global default)
   * @param {string} options.glyph1.fontColor - Text color for first verse (optional, uses global default)
   * @param {Object} options.glyph2 - Second glyph configuration (bottom)
   * @param {string} options.glyph2.text - Arabic text/glyph to render for second verse
   * @param {number|number[]} options.glyph2.pages - Page number(s) for font selection for second verse
   * @param {number} options.glyph2.fontSize - Font size for second verse (optional, uses global default)
   * @param {string} options.glyph2.fontColor - Text color for second verse (optional, uses global default)
   * @param {string} options.version - Font version ("v1" or "v2", default: "v2")
   * @param {number} options.width - Canvas width (default: 800)
   * @param {number} options.height - Canvas height (default: 1000)
   * @param {number} options.fontSize - Default font size (default: 48)
   * @param {string} options.fontColor - Default text color (default: "#000000")
   * @param {string} options.colorScheme - Color scheme ("dark" or "light", default: "dark")
   * @param {string} options.textAlign - Text alignment ("left", "center", "right", default: "right")
   * @param {number} options.lineHeight - Line height multiplier (default: 1.5)
   * @param {Object} options.padding - Padding {top, right, bottom, left} (default: {top: 80, right: 50, bottom: 50, left: 50})
   * @param {number} options.dividerWidth - Width of horizontal divider between glyphs (default: 2)
   * @param {string} options.dividerColor - Color of divider (default: "#666666")
   * @param {boolean} options.showLabels - Show "First Verse" and "Second Verse" labels (default: true)
   * @param {number} options.labelFontSize - Font size for labels (default: 24)
   * @param {string} options.labelFont - Font family for labels (default: "Arial")
   * @returns {Buffer} PNG image buffer
   */
  createDualQuranImage(options) {
    const {
      glyph1,
      glyph2,
      version = "v2",
      width = 800,
      height = 1000,
      fontSize = 48,
      fontColor = "#000000",
      colorScheme = "dark",
      textAlign = "right",
      lineHeight = 1.5,
      padding = { top: 80, right: 50, bottom: 50, left: 50 },
      dividerWidth = 2,
      dividerColor = "#666666",
      showLabels = true,
      labelFontSize = 24,
      labelFont = "Arial",
    } = options;

    // Validate required parameters
    if (!glyph1 || !glyph1.text || !glyph1.pages) {
      throw new Error("First glyph text and pages are required");
    }
    if (!glyph2 || !glyph2.text || !glyph2.pages) {
      throw new Error("Second glyph text and pages are required");
    }

    // Validate version
    if (!["v2"].includes(version)) {
      throw new Error("Version must be 'v1' or 'v2'");
    }

    // Calculate dimensions for each glyph area (vertical layout)
    const totalContentWidth = width - padding.left - padding.right;
    const totalContentHeight = height - padding.top - padding.bottom;
    const glyphWidth = totalContentWidth;
    const glyphHeight = (totalContentHeight - dividerWidth) / 2;

    // Register fonts for both glyphs
    const glyph1PageArray = Array.isArray(glyph1.pages)
      ? glyph1.pages
      : [glyph1.pages];
    const glyph2PageArray = Array.isArray(glyph2.pages)
      ? glyph2.pages
      : [glyph2.pages];

    // Validate page numbers
    [...glyph1PageArray, ...glyph2PageArray].forEach((page) => {
      if (!Number.isInteger(page) || page < 1 || page > 604) {
        throw new Error(
          `Invalid page number: ${page}. Must be between 1 and 604.`
        );
      }
    });

    const glyph1FontFamilies = glyph1PageArray.map((page) =>
      this.registerPageFont(page, version)
    );
    const glyph2FontFamilies = glyph2PageArray.map((page) =>
      this.registerPageFont(page, version)
    );

    // Create canvas
    const canvas = createCanvas(Math.min(width, glyph.length * 30), height);
    const ctx = canvas.getContext("2d");

    // Fill background
    ctx.fillStyle = colorScheme === "dark" ? "#1a1a1a" : "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Configure text rendering
    const textColor = colorScheme === "dark" ? "#ffffff" : "#000000";
    ctx.textBaseline = "top";

    // Draw labels if enabled
    let labelOffset = 0;
    if (showLabels) {
      labelOffset = labelFontSize + 15;
      ctx.fillStyle = textColor;
      ctx.font = `${labelFontSize}px ${labelFont}`;
      ctx.textAlign = "center";

      // First verse label (top area)
      const glyph1CenterX = padding.left + glyphWidth / 2;
      ctx.fillText("First Verse", glyph1CenterX, padding.top);

      // Second verse label (bottom area)
      const glyph2Y = padding.top + glyphHeight + dividerWidth + labelOffset;
      ctx.fillText("Second Verse", glyph1CenterX, glyph2Y);
    }

    // Render first glyph (top area)
    this.renderGlyphInArea(ctx, {
      text: glyph1.text,
      fontFamilies: glyph1FontFamilies,
      fontSize: glyph1.fontSize || fontSize,
      fontColor: glyph1.fontColor || fontColor,
      colorScheme,
      textAlign,
      lineHeight,
      x: padding.left,
      y: padding.top + labelOffset,
      width: glyphWidth,
      height: glyphHeight - labelOffset,
    });

    // Render second glyph (bottom area)
    this.renderGlyphInArea(ctx, {
      text: glyph2.text,
      fontFamilies: glyph2FontFamilies,
      fontSize: glyph2.fontSize || fontSize,
      fontColor: glyph2.fontColor || fontColor,
      colorScheme,
      textAlign,
      lineHeight,
      x: padding.left,
      y: padding.top + glyphHeight + dividerWidth + labelOffset,
      width: glyphWidth,
      height: glyphHeight - labelOffset,
    });

    // Draw horizontal divider line between top and bottom glyphs
    ctx.fillStyle = dividerColor;
    const dividerY = padding.top + glyphHeight + dividerWidth / 2 + labelOffset;
    ctx.fillRect(
      padding.left,
      dividerY - dividerWidth / 2,
      glyphWidth,
      dividerWidth
    );

    // Return image buffer
    return canvas.toBuffer("image/png");
  }

  /**
   * Helper method to render a glyph within a specific area
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} options - Rendering options
   */
  renderGlyphInArea(ctx, options) {
    const {
      text,
      fontFamilies,
      fontSize,
      fontColor,
      colorScheme,
      textAlign,
      lineHeight,
      x,
      y,
      width,
      height,
    } = options;

    // Save context state
    ctx.save();

    // Set text color
    ctx.fillStyle = colorScheme === "dark" ? "#ffffff" : "#000000";
    ctx.textAlign = textAlign;

    // Wrap text to fit within the area
    const lines = this.wrapText(ctx, text, fontFamilies[0], fontSize, width);

    // Calculate total text height
    const totalTextHeight = lines.length * fontSize * lineHeight;

    // Center text vertically in the available area
    const startY = y + (height - totalTextHeight) / 2;

    // Render each line
    lines.forEach((line, index) => {
      const fontFamily = fontFamilies[index % fontFamilies.length];
      ctx.font = `${fontSize}px ${fontFamily}`;

      let textX;
      switch (textAlign) {
        case "center":
          textX = x + width / 2;
          break;
        case "right":
          textX = x + width - 20; // Small margin from right edge
          break;
        default: // left
          textX = x + 20; // Small margin from left edge
      }

      const textY = startY + index * fontSize * lineHeight;

      // Render the text
      ctx.fillText(line, textX, textY);

      // Optional: Add text stroke for better visibility
      ctx.strokeStyle = fontColor;
      ctx.lineWidth = 0.5;
      ctx.strokeText(line, textX, textY);
    });

    // Restore context state
    ctx.restore();
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
   * Save dual Quran image to file
   * @param {Object} options - Same options as createDualQuranImage
   * @param {string} outputPath - Output file path
   */
  saveDualQuranImage(options, outputPath) {
    const buffer = this.createDualQuranImage(options);
    writeFileSync(outputPath, buffer);
    console.log(`Dual Quran image saved to: ${outputPath}`);
  }

  /**
   * Create a canvas image with a full verse where specific words are highlighted in light pink
   * @param {Object} options - Configuration options
   * @param {string} options.fullVerse - Complete Arabic text/glyph to render
   * @param {string} options.highlightedWords - Words to highlight in light pink (space-separated)
   * @param {number|number[]} options.pages - Page number(s) for font selection
   * @param {string} options.version - Font version ("v1" or "v2", default: "v2")
   * @param {number} options.width - Canvas width (default: 800)
   * @param {number} options.height - Canvas height (default: 600)
   * @param {number} options.fontSize - Font size (default: 48)
   * @param {string} options.baseColor - Base text color (default: "#000000")
   * @param {string} options.highlightColor - Highlight color (default: "#FFB6C1" - light pink)
   * @param {string} options.colorScheme - Color scheme ("dark" or "light", default: "dark")
   * @param {string} options.textAlign - Text alignment ("left", "center", "right", default: "right")
   * @param {number} options.lineHeight - Line height multiplier (default: 1.5)
   * @param {Object} options.padding - Padding {top, right, bottom, left} (default: {top: 50, right: 50, bottom: 50, left: 50})
   * @returns {Buffer} PNG image buffer
   */
  createHighlightedVerseImage(options) {
    const {
      fullVerse,
      highlightedWords,
      pages,
      version = "v2",
      width = 800,
      height = 600,
      fontSize = 48,
      baseColor = null,
      highlightColor = "#FFB6C1", // Light pink
      colorScheme = "dark",
      textAlign = "right",
      lineHeight = 1.5,
      padding = { top: 50, right: 50, bottom: 50, left: 50 },
    } = options;

    if (!fullVerse) {
      throw new Error("Full verse text is required");
    }

    if (!highlightedWords) {
      throw new Error("Highlighted words are required");
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
    const canvas = createCanvas(Math.min(width, glyph.length * 30), height);
    const ctx = canvas.getContext("2d");

    // Fill background
    ctx.fillStyle = colorScheme === "dark" ? "#1a1a1a" : "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Set default base color based on color scheme
    const defaultBaseColor = colorScheme === "dark" ? "#ffffff" : "#000000";
    const textBaseColor = baseColor || defaultBaseColor;

    // Configure text rendering
    ctx.textAlign = textAlign;
    ctx.textBaseline = "top";
    ctx.font = `${fontSize}px ${fontFamilies[0]}`;

    // Split both full verse and highlighted words
    const fullVerseWords = fullVerse.trim().split(/\s+/);
    const highlightWordsArray = highlightedWords.trim().split(/\s+/);

    // Create a set for faster lookup
    const highlightSet = new Set(highlightWordsArray);

    // Calculate starting position
    let currentX = textAlign === "right" ? width - padding.right : padding.left;
    let currentY = padding.top;
    const maxWidth = width - padding.left - padding.right;

    // Process each word
    fullVerseWords.forEach((word, index) => {
      const fontFamily = fontFamilies[0]; // Use first font family
      ctx.font = `${fontSize}px ${fontFamily}`;

      // Measure word width
      const wordWidth = ctx.measureText(word + " ").width;

      // Check if we need to wrap to next line
      if (textAlign === "right") {
        if (currentX - wordWidth < padding.left) {
          currentY += fontSize * lineHeight;
          currentX = width - padding.right;
        }
      } else {
        if (currentX + wordWidth > width - padding.right) {
          currentY += fontSize * lineHeight;
          currentX = padding.left;
        }
      }

      // Determine if this word should be highlighted
      const shouldHighlight = highlightSet.has(word);

      // Set color
      ctx.fillStyle = shouldHighlight ? highlightColor : textBaseColor;

      // Calculate text position
      let textX = currentX;
      if (textAlign === "right") {
        textX = currentX - ctx.measureText(word).width + 100;
      }

      // Render the word
      ctx.fillText(word, textX, currentY);

      // Add subtle stroke for better visibility
      ctx.strokeStyle = shouldHighlight ? highlightColor : textBaseColor;
      ctx.lineWidth = 0.5;
      ctx.strokeText(word, textX, currentY);

      // Update position for next word
      if (textAlign === "right") {
        currentX -= wordWidth;
      } else {
        currentX += wordWidth;
      }
    });

    // Return image buffer
    return canvas.toBuffer("image/png");
  }

  /**
   * Create a quiz canvas with a question glyph at the top and multiple choice options below
   * @param {Object} options - Configuration options
   * @param {string} options.questionGlyph - Arabic text/glyph for the question (code_v2)
   * @param {number} options.questionPage - Page number for the question glyph font
   * @param {Array} options.choices - Array of choice objects
   * @param {string} options.choices[].glyph - Arabic text/glyph for the choice (code_v2)
   * @param {number} options.choices[].page - Page number for the choice glyph font
   * @param {string} options.version - Font version ("v1" or "v2", default: "v2")
   * @param {number} options.width - Canvas width (default: 900)
   * @param {number} options.height - Canvas height (default: 800)
   * @param {number} options.questionFontSize - Font size for question (default: 40)
   * @param {number} options.choiceFontSize - Font size for choices (default: 32)
   * @param {string} options.colorScheme - Color scheme ("dark" or "light", default: "dark")
   * @param {string} options.textAlign - Text alignment ("left", "center", "right", default: "right")
   * @param {number} options.lineHeight - Line height multiplier (default: 1.4)
   * @param {Object} options.padding - Padding {top, right, bottom, left} (default: {top: 60, right: 60, bottom: 60, left: 60})
   * @param {number} options.questionSpacing - Space between question and choices (default: 80)
   * @param {number} options.choiceSpacing - Space between choices (default: 50)
   * @param {string} options.labelFont - Font family for choice labels (default: "Arial")
   * @param {number} options.labelFontSize - Font size for choice labels (default: 28)
   * @returns {Buffer} PNG image buffer
   */
  createQuizCanvas(options) {
    const {
      questionGlyph,
      questionPage,
      choices = [],
      version = "v2",
      width = 900,
      height = 800,
      questionFontSize = 40,
      choiceFontSize = 32,
      colorScheme = "dark",
      textAlign = "right",
      lineHeight = 1.4,
      padding = { top: 60, right: 60, bottom: 60, left: 60 },
      questionSpacing = 80,
      choiceSpacing = 50,
      labelFont = "Arial",
      labelFontSize = 28,
    } = options;

    // Validate required parameters
    if (!questionGlyph) {
      throw new Error("Question glyph is required");
    }

    if (
      !questionPage ||
      !Number.isInteger(questionPage) ||
      questionPage < 1 ||
      questionPage > 604
    ) {
      throw new Error("Valid question page number (1-604) is required");
    }

    if (!choices || choices.length === 0) {
      throw new Error("At least one choice is required");
    }

    // Validate version
    if (!["v2"].includes(version)) {
      throw new Error("Version must be 'v1' or 'v2'");
    }

    // Validate all choice pages
    choices.forEach((choice, index) => {
      if (!choice.glyph) {
        throw new Error(`Choice ${index + 1} glyph is required`);
      }
      if (
        !choice.page ||
        !Number.isInteger(choice.page) ||
        choice.page < 1 ||
        choice.page > 604
      ) {
        throw new Error(
          `Choice ${index + 1} requires valid page number (1-604)`
        );
      }
    });

    // Register fonts
    const questionFontFamily = this.registerPageFont(questionPage, version);
    const choiceFontFamilies = choices.map((choice) =>
      this.registerPageFont(choice.page, version)
    );

    // Create canvas
    const canvas = createCanvas(Math.min(width, glyph.length * 30), height);
    const ctx = canvas.getContext("2d");

    // Fill background
    ctx.fillStyle = colorScheme === "dark" ? "#1a1a1a" : "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Set text color
    const textColor = colorScheme === "dark" ? "#ffffff" : "#000000";
    const labelColor = colorScheme === "dark" ? "#cccccc" : "#333333";

    // Configure text rendering
    ctx.textBaseline = "top";
    ctx.fillStyle = textColor;

    // Calculate content area
    const contentWidth = width - padding.left - padding.right;
    let currentY = padding.top;

    // Render question glyph
    ctx.font = `${questionFontSize}px ${questionFontFamily}`;
    ctx.textAlign = textAlign;

    // Wrap question text
    const questionLines = this.wrapText(
      ctx,
      questionGlyph,
      questionFontFamily,
      questionFontSize,
      contentWidth
    );

    // Calculate question text position
    questionLines.forEach((line, index) => {
      let questionX;
      switch (textAlign) {
        case "center":
          questionX = width / 2;
          break;
        case "right":
          questionX = width - padding.right;
          break;
        default: // left
          questionX = padding.left;
      }

      const questionY = currentY + index * questionFontSize * lineHeight;

      // Render question line
      ctx.fillStyle = textColor;
      ctx.fillText(line, questionX, questionY);

      // Add subtle stroke for better visibility
      ctx.strokeStyle = textColor;
      ctx.lineWidth = 0.5;
      ctx.strokeText(line, questionX, questionY);
    });

    // Update Y position after question
    currentY +=
      questionLines.length * questionFontSize * lineHeight + questionSpacing;

    // Render choices
    choices.forEach((choice, index) => {
      const choiceLetter = String.fromCharCode(65 + index); // A, B, C, D, E...
      const choiceFontFamily = choiceFontFamilies[index];

      // Set up choice font
      ctx.font = `${choiceFontSize}px ${choiceFontFamily}`;

      // Wrap choice text
      const choiceLines = this.wrapText(
        ctx,
        choice.glyph,
        choiceFontFamily,
        choiceFontSize,
        contentWidth - 80 // Leave space for choice label
      );

      // Render choice label (A, B, C, etc.)
      ctx.font = `bold ${labelFontSize}px ${labelFont}`;
      ctx.fillStyle = labelColor;
      ctx.textAlign = "left";

      const labelX = padding.left;
      const labelY = currentY;
      ctx.fillText(`${choiceLetter}.`, labelX, labelY);

      // Render choice glyph
      ctx.font = `${choiceFontSize}px ${choiceFontFamily}`;
      ctx.fillStyle = textColor;
      ctx.textAlign = textAlign;

      choiceLines.forEach((line, lineIndex) => {
        let choiceX;
        switch (textAlign) {
          case "center":
            choiceX = width / 2;
            break;
          case "right":
            choiceX = width - padding.right;
            break;
          default: // left
            choiceX = padding.left + 80; // Offset for choice label
        }

        const choiceY = currentY + lineIndex * choiceFontSize * lineHeight;

        // Render choice line
        ctx.fillText(line, choiceX, choiceY);

        // Add subtle stroke for better visibility
        ctx.strokeStyle = textColor;
        ctx.lineWidth = 0.5;
        ctx.strokeText(line, choiceX, choiceY);
      });

      // Update Y position for next choice
      currentY +=
        Math.max(
          choiceLines.length * choiceFontSize * lineHeight,
          labelFontSize
        ) + choiceSpacing;
    });

    // Return image buffer
    return canvas.toBuffer("image/png");
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
