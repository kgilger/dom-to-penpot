/**
 * Penpot Plugin — main.js
 *
 * This script runs in the Penpot plugin sandbox.
 * It receives extracted DOM data from the UI (index.html)
 * and creates Penpot shapes via the Plugin API.
 *
 * Global `penpot` object is provided by the Penpot runtime.
 */

// Open the plugin UI panel
penpot.ui.open("DOM to Penpot", `http://localhost:4400/plugin/`, {
  width: 320,
  height: 480,
});

// ── Color parsing ───────────────────────────────────────────

function parseRgba(color) {
  if (!color || color === "transparent" || color === "rgba(0, 0, 0, 0)") {
    return null;
  }

  // rgb(r, g, b) or rgba(r, g, b, a)
  const rgbaMatch = color.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/
  );
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1]);
    const g = parseInt(rgbaMatch[2]);
    const b = parseInt(rgbaMatch[3]);
    const a = rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1;
    const hex =
      "#" +
      r.toString(16).padStart(2, "0") +
      g.toString(16).padStart(2, "0") +
      b.toString(16).padStart(2, "0");
    return { hex, opacity: a };
  }

  // Already hex
  if (color.startsWith("#")) {
    return { hex: color, opacity: 1 };
  }

  return null;
}

// ── Style mapping helpers ───────────────────────────────────

function mapFills(styles) {
  const fills = [];

  // Background color
  const bg = parseRgba(styles.backgroundColor);
  if (bg && bg.opacity > 0) {
    fills.push({ fillColor: bg.hex, fillOpacity: bg.opacity });
  }

  // Background gradient
  if (styles.backgroundGradient) {
    const g = styles.backgroundGradient;
    if (g.type === "linear" && g.stops.length >= 2) {
      const angleDeg = g.angle || 180;
      const angleRad = ((angleDeg - 90) * Math.PI) / 180;
      const cos = Math.cos(angleRad);
      const sin = Math.sin(angleRad);

      fills.push({
        fillColorGradient: {
          type: "linear",
          startX: 0.5 - cos * 0.5,
          startY: 0.5 - sin * 0.5,
          endX: 0.5 + cos * 0.5,
          endY: 0.5 + sin * 0.5,
          width: 1,
          stops: g.stops.map((s) => {
            const c = parseRgba(s.color);
            return {
              color: c ? c.hex : "#000000",
              opacity: c ? c.opacity : 1,
              offset: s.offset,
            };
          }),
        },
      });
    }
  }

  return fills.length > 0 ? fills : [{ fillColor: "#FFFFFF", fillOpacity: 0 }];
}

function mapStrokes(styles) {
  const strokes = [];

  // Use the top border as representative (most common case: uniform border)
  const width = styles.borderTopWidth;
  if (width > 0 && styles.borderTopStyle !== "none") {
    const color = parseRgba(styles.borderTopColor);
    if (color) {
      let strokeStyle = "solid";
      if (styles.borderTopStyle === "dashed") strokeStyle = "dashed";
      else if (styles.borderTopStyle === "dotted") strokeStyle = "dotted";

      strokes.push({
        strokeColor: color.hex,
        strokeOpacity: color.opacity,
        strokeWidth: width,
        strokeStyle,
        strokeAlignment: "inner",
      });
    }
  }

  return strokes;
}

function mapShadows(styles) {
  return (styles.boxShadows || []).map((s) => {
    const color = parseRgba(s.color);
    return {
      style: s.inset ? "inner-shadow" : "drop-shadow",
      offsetX: s.offsetX,
      offsetY: s.offsetY,
      blur: s.blur,
      spread: s.spread,
      color: {
        color: color ? color.hex : "#000000",
        opacity: color ? color.opacity : 0.25,
      },
    };
  });
}

function isFlexContainer(styles) {
  return styles.display === "flex" || styles.display === "inline-flex";
}

function mapFlexDirection(dir) {
  const mapping = {
    row: "row",
    "row-reverse": "row-reverse",
    column: "column",
    "column-reverse": "column-reverse",
  };
  return mapping[dir] || "row";
}

function mapFlexAlign(value) {
  const mapping = {
    "flex-start": "start",
    start: "start",
    "flex-end": "end",
    end: "end",
    center: "center",
    stretch: "stretch",
    baseline: "start",
  };
  return mapping[value] || "start";
}

function mapFlexJustify(value) {
  const mapping = {
    "flex-start": "start",
    start: "start",
    "flex-end": "end",
    end: "end",
    center: "center",
    "space-between": "space-between",
    "space-around": "space-around",
    "space-evenly": "space-evenly",
    stretch: "stretch",
  };
  return mapping[value] || "start";
}

function isTextNode(node) {
  return (
    node.text &&
    node.children.length === 0
  );
}

function isContainerNode(node) {
  return node.children.length > 0;
}

// ── Map text-align to Penpot ────────────────────────────────

function mapTextAlign(value) {
  const mapping = {
    left: "left",
    start: "left",
    center: "center",
    right: "right",
    end: "right",
    justify: "justify",
  };
  return mapping[value] || "left";
}

function mapTextDecoration(value) {
  if (!value || value === "none") return null;
  if (value.includes("underline")) return "underline";
  if (value.includes("line-through")) return "line-through";
  return null;
}

function mapTextTransform(value) {
  if (!value || value === "none") return null;
  const mapping = {
    uppercase: "uppercase",
    lowercase: "lowercase",
    capitalize: "capitalize",
  };
  return mapping[value] || null;
}

// ── Main conversion ─────────────────────────────────────────

let shapeCount = 0;
let fontCache = {}; // CSS fontFamily -> Penpot Font object

function resolvePenpotFont(cssFontFamily) {
  if (fontCache[cssFontFamily]) return fontCache[cssFontFamily];

  // Try to find the font by name in Penpot
  const font = penpot.fonts.findByName(cssFontFamily);
  if (font) {
    fontCache[cssFontFamily] = font;
    return font;
  }

  // Try common ID patterns: "google-roboto", "google-open-sans", etc.
  const idName = cssFontFamily.toLowerCase().replace(/\s+/g, '-');
  const googleFont = penpot.fonts.findById('google-' + idName);
  if (googleFont) {
    fontCache[cssFontFamily] = googleFont;
    return googleFont;
  }

  return null;
}

function findFontVariant(font, weight, style) {
  if (!font || !font.variants) return null;
  // Match weight + style
  const variant = font.variants.find(v =>
    v.fontWeight === String(weight) && v.fontStyle === (style || 'normal')
  );
  if (variant) return variant;
  // Match just weight
  const byWeight = font.variants.find(v => v.fontWeight === String(weight));
  if (byWeight) return byWeight;
  return null;
}

function sendProgress(text) {
  penpot.ui.sendMessage({ type: "import-progress", text });
}

function createTextShape(node, scale) {
  const text = penpot.createText(node.text);
  if (!text) return null;

  const s = node.styles;
  text.x = node.bounds.x * scale;
  text.y = node.bounds.y * scale;
  text.resize(node.bounds.width * scale, node.bounds.height * scale);
  text.growType = 'auto-height';

  // Resolve font via Penpot's font system
  const fontName = s.fontFamily || 'Work Sans';
  const font = resolvePenpotFont(fontName);
  if (font) {
    const variant = findFontVariant(font, s.fontWeight, s.fontStyle === 'italic' ? 'italic' : 'normal');
    font.applyToText(text, variant || undefined);
  } else {
    // Fallback: set properties directly
    text.fontFamily = fontName;
    text.fontWeight = s.fontWeight || '400';
    text.fontStyle = s.fontStyle === 'italic' ? 'italic' : 'normal';
  }

  text.fontSize = String(Math.round(s.fontSize * scale));
  text.align = mapTextAlign(s.textAlign);

  const lineHeight = s.lineHeight;
  if (lineHeight && lineHeight > 0 && lineHeight < 10) {
    text.lineHeight = String(lineHeight);
  }
  if (s.letterSpacing) {
    text.letterSpacing = String(Math.round(s.letterSpacing * scale));
  }

  const decoration = mapTextDecoration(s.textDecoration);
  if (decoration) text.textDecoration = decoration;

  const transform = mapTextTransform(s.textTransform);
  if (transform) text.textTransform = transform;

  // Text color
  const textColor = parseRgba(s.color);
  if (textColor) {
    text.fills = [{ fillColor: textColor.hex, fillOpacity: textColor.opacity }];
  }

  text.name = `${node.tag}: "${node.text.substring(0, 20)}${node.text.length > 20 ? "..." : ""}"`;
  shapeCount++;
  return text;
}

function createRectShape(node, scale) {
  const rect = penpot.createRectangle();
  const s = node.styles;

  rect.x = node.bounds.x * scale;
  rect.y = node.bounds.y * scale;
  rect.resize(
    Math.max(1, node.bounds.width * scale),
    Math.max(1, node.bounds.height * scale)
  );

  rect.fills = mapFills(s);
  rect.strokes = mapStrokes(s);
  rect.shadows = mapShadows(s);
  rect.opacity = s.opacity;

  // Border radius
  if (s.borderTopLeftRadius || s.borderTopRightRadius || s.borderBottomRightRadius || s.borderBottomLeftRadius) {
    rect.borderRadiusTopLeft = s.borderTopLeftRadius * scale;
    rect.borderRadiusTopRight = s.borderTopRightRadius * scale;
    rect.borderRadiusBottomRight = s.borderBottomRightRadius * scale;
    rect.borderRadiusBottomLeft = s.borderBottomLeftRadius * scale;
  }

  rect.name = node.tag;
  shapeCount++;
  return rect;
}

function processNode(node, scale, parentBoard) {
  if (!node) return null;

  // Skip nodes with zero dimensions (truly invisible)
  if (node.bounds.width <= 0 || node.bounds.height <= 0) return null;

  // Pure text leaf node (any tag, no children, has text)
  if (isTextNode(node)) {
    // If it has a meaningful background/border, create a board with bg + text
    const hasBg = parseRgba(node.styles.backgroundColor)?.opacity > 0;
    const hasBorder = node.styles.borderTopWidth > 0 && node.styles.borderTopStyle !== "none";

    if (hasBg || hasBorder) {
      const board = penpot.createBoard();
      board.x = node.bounds.x * scale;
      board.y = node.bounds.y * scale;
      board.resize(
        Math.max(1, node.bounds.width * scale),
        Math.max(1, node.bounds.height * scale)
      );
      board.fills = mapFills(node.styles);
      board.strokes = mapStrokes(node.styles);
      board.shadows = mapShadows(node.styles);
      board.opacity = node.styles.opacity;
      board.borderRadiusTopLeft = node.styles.borderTopLeftRadius * scale;
      board.borderRadiusTopRight = node.styles.borderTopRightRadius * scale;
      board.borderRadiusBottomRight = node.styles.borderBottomRightRadius * scale;
      board.borderRadiusBottomLeft = node.styles.borderBottomLeftRadius * scale;
      board.clipContent = false;
      board.name = node.tag;

      const text = createTextShape(node, scale);
      if (text) {
        board.appendChild(text);
      }

      if (parentBoard) {
        parentBoard.appendChild(board);
      }
      shapeCount++;
      return board;
    }

    const text = createTextShape(node, scale);
    if (text && parentBoard) {
      parentBoard.appendChild(text);
    }
    return text;
  }

  // Container node — create a Board (frame)
  if (isContainerNode(node)) {
    const board = penpot.createBoard();
    const s = node.styles;

    board.x = node.bounds.x * scale;
    board.y = node.bounds.y * scale;
    board.resize(
      Math.max(1, node.bounds.width * scale),
      Math.max(1, node.bounds.height * scale)
    );

    board.fills = mapFills(s);
    board.strokes = mapStrokes(s);
    board.shadows = mapShadows(s);
    board.opacity = s.opacity;
    board.clipContent = false;

    // Border radius
    board.borderRadiusTopLeft = s.borderTopLeftRadius * scale;
    board.borderRadiusTopRight = s.borderTopRightRadius * scale;
    board.borderRadiusBottomRight = s.borderBottomRightRadius * scale;
    board.borderRadiusBottomLeft = s.borderBottomLeftRadius * scale;

    board.name = node.tag + (node.text ? `: "${node.text.substring(0, 15)}"` : "");

    // If this node also has direct text content AND children,
    // create a text shape for the direct text
    if (node.text && node.children.length > 0) {
      const text = createTextShape(node, scale);
      if (text) {
        board.appendChild(text);
      }
    }

    // Process children recursively
    for (const child of node.children) {
      processNode(child, scale, board);
    }

    if (parentBoard) {
      parentBoard.appendChild(board);
    }

    shapeCount++;
    return board;
  }

  // Fallback: simple rectangle for non-text, non-container visible nodes
  const rect = createRectShape(node, scale);
  if (rect && parentBoard) {
    parentBoard.appendChild(rect);
  }
  return rect;
}

// ── Message handler ─────────────────────────────────────────

penpot.ui.onMessage((msg) => {
  if (msg.type === "import-dom") {
    const { data, scale } = msg.payload;
    shapeCount = 0;

    try {
      sendProgress("Starting import...");

      const tree = data.tree;
      const rootBoard = processNode(
        tree,
        scale,
        null
      );

      if (rootBoard) {
        rootBoard.name = `Imported: ${data.url}`;
        // Position at viewport origin
        rootBoard.x = 0;
        rootBoard.y = 0;
      }

      penpot.ui.sendMessage({
        type: "import-done",
        text: `Import complete! Created ${shapeCount} shapes.`,
      });
    } catch (err) {
      penpot.ui.sendMessage({
        type: "import-error",
        text: `Import failed: ${err.message || err}`,
      });
    }
  }
});
