// Browser-side extraction code.
// This file is injected directly into the page via addScriptTag.
// It is NOT processed by tsx/esbuild, so no __name issues.

window.__extractDOM = function(rootSelector) {
  var parsePixelValue = function(v) { return parseFloat(v) || 0; };
  var parseColor = function(v) { return v || "transparent"; };

  var parseBoxShadows = function(raw) {
    if (!raw || raw === "none") return [];
    var shadows = [];
    var parts = [];
    var depth = 0;
    var current = "";
    for (var i = 0; i < raw.length; i++) {
      var ch = raw[i];
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      else if (ch === "," && depth === 0) {
        parts.push(current.trim());
        current = "";
        continue;
      }
      current += ch;
    }
    if (current.trim()) parts.push(current.trim());

    for (var p = 0; p < parts.length; p++) {
      var part = parts[p];
      var inset = part.includes("inset");
      var cleaned = part.replace("inset", "").trim();
      var colorMatch = cleaned.match(/(rgba?\([^)]+\)|#[0-9a-fA-F]{3,8})/);
      var color = colorMatch ? colorMatch[1] : "rgba(0,0,0,1)";
      var withoutColor = cleaned.replace(/(rgba?\([^)]+\)|#[0-9a-fA-F]{3,8})/, "").trim();
      var nums = withoutColor.split(/\s+/).map(parseFloat).filter(function(n) { return !isNaN(n); });
      shadows.push({
        offsetX: nums[0] || 0, offsetY: nums[1] || 0,
        blur: nums[2] || 0, spread: nums[3] || 0,
        color: color, inset: inset
      });
    }
    return shadows;
  };

  var parseGradient = function(bg) {
    var linearMatch = bg.match(/linear-gradient\(([^)]+(?:\([^)]*\))*[^)]*)\)/);
    if (linearMatch) {
      var content = linearMatch[1];
      var angleMatch = content.match(/^(\d+)deg/);
      var angle = angleMatch ? parseInt(angleMatch[1]) : 180;
      var stops = [];
      var colorStopRegex = /(rgba?\([^)]+\)|#[0-9a-fA-F]{3,8})\s*(\d+%)?/g;
      var match;
      var idx = 0;
      while ((match = colorStopRegex.exec(content)) !== null) {
        var offset = match[2] ? parseFloat(match[2]) / 100 : idx;
        stops.push({ color: match[1], offset: offset });
        idx++;
      }
      if (stops.length > 1 && stops.some(function(s) { return s.offset >= 1 && s.offset !== 0; })) {
        // Already percentage-based
      } else if (stops.length > 1) {
        stops.forEach(function(s, i) { if (s.offset === i) s.offset = i / (stops.length - 1); });
      }
      return { type: "linear", angle: angle, stops: stops };
    }
    return undefined;
  };

  var getDirectText = function(el) {
    var text = "";
    for (var i = 0; i < el.childNodes.length; i++) {
      var child = el.childNodes[i];
      if (child.nodeType === Node.TEXT_NODE) {
        text += child.textContent || "";
      }
    }
    text = text.trim();
    return text || null;
  };

  var isVisible = function(el, cs, rect) {
    if (cs.display === "none") return false;
    if (cs.visibility === "hidden") return false;
    if (parseFloat(cs.opacity) === 0) return false;
    // Don't filter out zero-size containers — they may have visible overflow children
    return true;
  };

  var SKIP_TAGS = { SCRIPT:1, STYLE:1, LINK:1, META:1, NOSCRIPT:1, BR:1, HR:1 };

  var extractNode = function(el, depth) {
    if (SKIP_TAGS[el.tagName]) return null;
    if (depth > 50) return null;

    var cs = window.getComputedStyle(el);
    var rect = el.getBoundingClientRect();
    if (!isVisible(el, cs, rect)) return null;

    var styles = {
      backgroundColor: parseColor(cs.backgroundColor),
      backgroundGradient: parseGradient(cs.backgroundImage),
      backgroundImage: undefined,

      borderTopWidth: parsePixelValue(cs.borderTopWidth),
      borderRightWidth: parsePixelValue(cs.borderRightWidth),
      borderBottomWidth: parsePixelValue(cs.borderBottomWidth),
      borderLeftWidth: parsePixelValue(cs.borderLeftWidth),
      borderTopColor: parseColor(cs.borderTopColor),
      borderRightColor: parseColor(cs.borderRightColor),
      borderBottomColor: parseColor(cs.borderBottomColor),
      borderLeftColor: parseColor(cs.borderLeftColor),
      borderTopStyle: cs.borderTopStyle,
      borderRightStyle: cs.borderRightStyle,
      borderBottomStyle: cs.borderBottomStyle,
      borderLeftStyle: cs.borderLeftStyle,

      borderTopLeftRadius: parsePixelValue(cs.borderTopLeftRadius),
      borderTopRightRadius: parsePixelValue(cs.borderTopRightRadius),
      borderBottomRightRadius: parsePixelValue(cs.borderBottomRightRadius),
      borderBottomLeftRadius: parsePixelValue(cs.borderBottomLeftRadius),

      boxShadows: parseBoxShadows(cs.boxShadow),

      opacity: parseFloat(cs.opacity) || 1,
      overflow: cs.overflow,

      color: parseColor(cs.color),
      fontFamily: cs.fontFamily.split(",")[0].trim().replace(/['"]/g, ""),
      fontSize: parsePixelValue(cs.fontSize),
      fontWeight: cs.fontWeight,
      fontStyle: cs.fontStyle,
      lineHeight: parsePixelValue(cs.lineHeight) / (parsePixelValue(cs.fontSize) || 1),
      letterSpacing: parsePixelValue(cs.letterSpacing),
      textAlign: cs.textAlign,
      textDecoration: cs.textDecorationLine || cs.textDecoration,
      textTransform: cs.textTransform,

      display: cs.display,
      flexDirection: cs.flexDirection,
      flexWrap: cs.flexWrap,
      justifyContent: cs.justifyContent,
      alignItems: cs.alignItems,
      alignContent: cs.alignContent,
      gap: parsePixelValue(cs.gap),
      rowGap: parsePixelValue(cs.rowGap),
      columnGap: parsePixelValue(cs.columnGap),
      paddingTop: parsePixelValue(cs.paddingTop),
      paddingRight: parsePixelValue(cs.paddingRight),
      paddingBottom: parsePixelValue(cs.paddingBottom),
      paddingLeft: parsePixelValue(cs.paddingLeft)
    };

    var bgImgMatch = cs.backgroundImage ? cs.backgroundImage.match(/url\(["']?([^"')]+)["']?\)/) : null;
    if (bgImgMatch && cs.backgroundImage.indexOf("gradient") === -1) {
      styles.backgroundImage = bgImgMatch[1];
    }

    var children = [];
    for (var i = 0; i < el.children.length; i++) {
      var extracted = extractNode(el.children[i], depth + 1);
      if (extracted) children.push(extracted);
    }

    // For elements with zero rect but visible overflow children,
    // compute actual size from children bounding boxes
    var finalWidth = rect.width;
    var finalHeight = rect.height;
    var finalX = rect.x + window.scrollX;
    var finalY = rect.y + window.scrollY;

    if ((rect.width === 0 || rect.height === 0) && children.length > 0) {
      var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (var c = 0; c < children.length; c++) {
        var cb = children[c].bounds;
        if (cb.width > 0 && cb.height > 0) {
          if (cb.x < minX) minX = cb.x;
          if (cb.y < minY) minY = cb.y;
          if (cb.x + cb.width > maxX) maxX = cb.x + cb.width;
          if (cb.y + cb.height > maxY) maxY = cb.y + cb.height;
        }
      }
      if (minX !== Infinity) {
        finalX = rect.width === 0 ? minX : finalX;
        finalY = rect.height === 0 ? minY : finalY;
        finalWidth = rect.width === 0 ? (maxX - minX) : finalWidth;
        finalHeight = rect.height === 0 ? (maxY - minY) : finalHeight;
      }
    }

    // Extract src for img elements
    var imgSrc = null;
    if (el.tagName === 'IMG' && el.src) {
      imgSrc = el.src;
    }

    return {
      tag: el.tagName.toLowerCase(),
      bounds: {
        x: finalX,
        y: finalY,
        width: finalWidth,
        height: finalHeight
      },
      styles: styles,
      text: getDirectText(el),
      children: children,
      visible: (finalWidth > 0 && finalHeight > 0),
      imgSrc: imgSrc
    };
  };

  var root = rootSelector
    ? (document.querySelector(rootSelector) || document.body)
    : document.body;

  return extractNode(root, 0);
};
