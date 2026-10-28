declare module "fontkit" {
  export function create(buffer: Uint8Array): {
    hasGlyphForCodePoint(codePoint: number): boolean;
  };
}
