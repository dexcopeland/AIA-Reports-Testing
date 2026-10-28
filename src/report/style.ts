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
  red: "C8122C",
  body: "231F20",
  muted: "4E4A4B",
  shade: "F6F4F4",
  rule: "C8122C",
  titlePt: 22,
  headingPt: 16,
  subheadPt: 13.5,
  bodyPt: 12,
  notePt: 11,
  footerPt: 9,
  marginPt: 72,
} as const;
