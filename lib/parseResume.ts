import mammoth from "mammoth";

async function extractPdfText(fileBuffer: Buffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const uint8 = new Uint8Array(fileBuffer);
  const pdf = await getDocumentProxy(uint8);
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

export async function parseResumeBuffer(
  fileBuffer: Buffer,
  fileName: string
): Promise<string> {
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".pdf")) {
    return extractPdfText(fileBuffer);
  }

  if (lower.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    return result.value;
  }

  throw new Error("Unsupported file format. Please upload PDF or DOCX files only.");
}
