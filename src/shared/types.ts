/**
 * Shared types for the DOM-to-Penpot intermediate JSON format.
 * Produced by the extractor, consumed by the Penpot plugin.
 */

/** Bounding rectangle in absolute page coordinates */
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Parsed box-shadow value */
export interface BoxShadow {
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
  color: string;
  inset: boolean;
}

/** Parsed linear/radial gradient */
export interface Gradient {
  type: "linear" | "radial";
  angle?: number; // degrees for linear
  stops: { color: string; offset: number }[];
}

/** Extracted CSS styles (computed values, parsed into usable form) */
export interface ExtractedStyles {
  // Background
  backgroundColor: string;
  backgroundGradient?: Gradient;
  backgroundImage?: string; // URL

  // Border
  borderTopWidth: number;
  borderRightWidth: number;
  borderBottomWidth: number;
  borderLeftWidth: number;
  borderTopColor: string;
  borderRightColor: string;
  borderBottomColor: string;
  borderLeftColor: string;
  borderTopStyle: string;
  borderRightStyle: string;
  borderBottomStyle: string;
  borderLeftStyle: string;

  // Border radius
  borderTopLeftRadius: number;
  borderTopRightRadius: number;
  borderBottomRightRadius: number;
  borderBottomLeftRadius: number;

  // Shadows
  boxShadows: BoxShadow[];

  // Opacity
  opacity: number;

  // Overflow
  overflow: string;

  // Typography (for text nodes)
  color: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  fontStyle: string;
  lineHeight: number;
  letterSpacing: number;
  textAlign: string;
  textDecoration: string;
  textTransform: string;

  // Layout
  display: string;
  flexDirection: string;
  flexWrap: string;
  justifyContent: string;
  alignItems: string;
  alignContent: string;
  gap: number;
  rowGap: number;
  columnGap: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
}

/** A single node in the extracted DOM tree */
export interface DomNode {
  /** HTML tag name (lowercase) */
  tag: string;
  /** Bounding rect in absolute page coords */
  bounds: Bounds;
  /** Computed styles (parsed) */
  styles: ExtractedStyles;
  /** Direct text content (only leaf text, not children's text) */
  text: string | null;
  /** Child nodes */
  children: DomNode[];
  /** Whether this node is visible (not display:none, not zero-size) */
  visible: boolean;
}

/** Root extraction result */
export interface ExtractionResult {
  /** URL that was extracted */
  url: string;
  /** Viewport dimensions used */
  viewport: { width: number; height: number };
  /** Extraction timestamp */
  timestamp: string;
  /** DOM tree */
  tree: DomNode;
}
