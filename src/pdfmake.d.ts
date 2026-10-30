declare module "pdfmake/build/pdfmake.js" {
  interface PdfDocument {
    getBuffer(): Promise<Uint8Array>;
    getStream(): Promise<unknown>;
  }

  const pdfMake: {
    addVirtualFileSystem(files: Record<string, string>): void;
    addFonts(fonts: Record<string, { normal: string; bold: string; italics: string; bolditalics: string }>): void;
    createPdf(definition: Record<string, unknown>, options?: { bufferPages?: boolean }): PdfDocument;
  };

  export default pdfMake;
}

declare module "pdfmake/build/vfs_fonts.js" {
  const fonts: Record<string, string>;
  export default fonts;
}
