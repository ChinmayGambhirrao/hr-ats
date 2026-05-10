import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';

export async function parseResumeBuffer(fileBuffer: Buffer, fileName: string): Promise<string> {
  if (fileName.toLowerCase().endsWith('.pdf')) {
    const parser = new PDFParse({ data: fileBuffer });
    try {
      const data = await parser.getText();
      return data.text;
    } finally {
      await parser.destroy();
    }
  } 
  else if (fileName.toLowerCase().endsWith('.docx')) {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    return result.value;
  }
  else {
    throw new Error('Unsupported file format. Please upload PDF or DOCX files only.');
  }
}