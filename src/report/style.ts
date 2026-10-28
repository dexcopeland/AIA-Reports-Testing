/**
 * Shared layout tokens for the Word file and the PDF.
 * The Word file asks for Times New Roman by name. The PDF embeds Liberation Serif,
 * which is metric-compatible and licensed under the SIL Open Font License.
 * Characters Liberation Serif lacks are drawn from DejaVu Serif when it has them.
 */
export const REPORT_STYLE = {
  font: "Times New Roman",
  pdfFamily: "LiberationSerif",
  fallbackFamily: "DejaVuSerif",
  navy: "0A3161",
  body: "1A1A1A",
  muted: "4A5562",
  shade: "F4F7FB",
  rule: "1B4F8A",
  titlePt: 22,
  headingPt: 16,
  subheadPt: 13.5,
  bodyPt: 12,
  notePt: 11,
  footerPt: 9,
  marginPt: 72,
} as const;
