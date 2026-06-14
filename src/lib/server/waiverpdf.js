// Build a signed waiver PDF: the original template followed by a signature
// & acknowledgment page (typed name + drawn signature + timestamp).
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const TEAL = rgb(0, 0.235, 0.306);   // #003C4E
const CYAN = rgb(0, 0.91, 0.776);    // #00E8C6

export async function buildSignedWaiverPdf({
  templateBytes, waiverTitle, signedName, studentEmail, signaturePngBytes, signedAt
}) {
  let doc;
  try {
    doc = templateBytes ? await PDFDocument.load(templateBytes, { ignoreEncryption: true })
                        : await PDFDocument.create();
  } catch (e) {
    doc = await PDFDocument.create();
  }

  const page = doc.addPage([612, 792]); // US Letter
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  // header bar
  page.drawRectangle({ x: 0, y: 742, width: 612, height: 50, color: TEAL });
  page.drawText('Summit Paragliding', { x: 50, y: 760, size: 16, font: bold, color: CYAN });

  let y = 700;
  page.drawText('Signature & acknowledgment', { x: 50, y, size: 18, font: bold, color: TEAL }); y -= 28;
  page.drawText(waiverTitle || 'Waiver', { x: 50, y, size: 12, font: bold, color: TEAL }); y -= 40;

  const row = (label, value) => {
    page.drawText(label, { x: 50, y, size: 11, font: bold, color: TEAL });
    page.drawText(String(value || '—'), { x: 210, y, size: 11, font, color: rgb(0.1,0.1,0.1) });
    y -= 24;
  };
  row('Full legal name:', signedName);
  row('Student email:', studentEmail);
  row('Date & time signed:', signedAt);
  y -= 6;
  const ack = 'By signing below, I confirm I have read, understood, and agree to the terms of this waiver.';
  page.drawText(ack, { x: 50, y, size: 10, font, color: rgb(0.25,0.25,0.25), maxWidth: 512, lineHeight: 14 }); y -= 40;

  page.drawText('Signature:', { x: 50, y, size: 11, font: bold, color: TEAL });
  if (signaturePngBytes) {
    try {
      const png = await doc.embedPng(signaturePngBytes);
      const scaled = png.scale(1);
      const w = Math.min(260, scaled.width);
      const h = (w / scaled.width) * scaled.height;
      page.drawImage(png, { x: 160, y: y - h + 8, width: w, height: Math.min(h, 90) });
    } catch (e) { /* signature embed failed; name still recorded */ }
  }
  page.drawLine({ start: { x: 160, y: y - 6 }, end: { x: 470, y: y - 6 }, thickness: 1, color: rgb(0.6,0.6,0.6) });

  return await doc.save();
}
