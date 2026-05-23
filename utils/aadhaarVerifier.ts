import axios from "axios";
import { createWorker } from "tesseract.js";
import { createRequire } from "module";

// pdf-parse is a CommonJS module – must use createRequire in ESM
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require("pdf-parse");

export interface OCRResult {
  success: boolean;
  text: string;
  extractedNumber?: string;
  status: "matched" | "mismatched" | "unreadable";
}

/**
 * Determines whether the uploaded file is a PDF.
 * Cloudinary PDFs are stored as `resource_type=raw` and the URL typically ends in `.pdf`
 * or contains `raw/upload`. Images use `image/upload`.
 */
function detectIsPdf(fileUrl: string, mimetype: string): boolean {
  if (mimetype === "application/pdf") return true;
  const lower = fileUrl.toLowerCase();
  if (lower.includes(".pdf")) return true;
  if (lower.includes("raw/upload")) return true;
  return false;
}


 
function extractAadhaarNumbers(text: string): string[] {
  // Remove all whitespace first for compact matching
  const compact = text.replace(/\s+/g, "");
  // Match exactly 12-digit sequences NOT preceded or followed by another digit
  const regex = /(?<!\d)\d{12}(?!\d)/g;
  const results: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(compact)) !== null) {
    results.push(m[0]);
  }
  return results;
}

export const verifyAadhaarOCR = async (
  fileUrl: string,
  mimetype: string,
  enteredAadhaar: string
): Promise<OCRResult> => {
  try {
    console.log(`[OCR] START → url=${fileUrl} | mime=${mimetype}`);

    if (!fileUrl) {
      console.error("[OCR] No file URL provided");
      return { success: false, text: "", status: "unreadable" };
    }

    // Download the file as a binary buffer
    const response = await axios.get(fileUrl, {
      responseType: "arraybuffer",
      timeout: 30_000,
    });
    const buffer = Buffer.from(response.data);
    console.log(`[OCR] Downloaded ${buffer.byteLength} bytes`);

    let extractedText = "";

    const isPdf = detectIsPdf(fileUrl, mimetype);
    console.log(`[OCR] File type detected as: ${isPdf ? "PDF" : "IMAGE"}`);

    if (isPdf) {
      try {
        const parsed = await pdfParse(buffer);
        extractedText = parsed.text || "";
        console.log(`[OCR] PDF parsed. Char count: ${extractedText.length}`);
      } catch (pdfErr) {
        console.error("[OCR] pdf-parse failed:", pdfErr);
      }
    } else {
      // Treat as image
      let worker: Awaited<ReturnType<typeof createWorker>> | undefined;
      try {
        worker = await createWorker("eng");
        const ret = await worker.recognize(buffer);
        extractedText = ret.data.text || "";
        console.log(`[OCR] Tesseract done. Char count: ${extractedText.length}`);
        if (extractedText.trim().length > 0) {
          console.log(`[OCR] Tesseract raw snippet: ${extractedText.substring(0, 200)}`);
        }
      } catch (ocrErr) {
        console.error("[OCR] Tesseract failed:", ocrErr);
        // Fall through – extractedText stays empty → unreadable
      } finally {
        if (worker) {
          await worker.terminate();
        }
      }
    }

    const enteredClean = enteredAadhaar.replace(/\s+/g, "").trim();
    console.log(`[OCR] Entered Aadhaar (cleaned): ${enteredClean}`);

    if (!extractedText || extractedText.trim().length === 0) {
      console.warn("[OCR] No text extracted from document → unreadable");
      return { success: false, text: "", status: "unreadable" };
    }

    // Find all 12-digit sequences in the document
    const found = extractAadhaarNumbers(extractedText);
    console.log(`[OCR] 12-digit sequences found in doc: ${JSON.stringify(found)}`);

    const isMatch = found.includes(enteredClean);

    if (isMatch) {
      console.log("[OCR] ✅ Aadhaar MATCHED");
      return {
        success: true,
        text: extractedText,
        extractedNumber: enteredClean,
        status: "matched",
      };
    }

    if (found.length > 0) {
      const firstFound: string = found[0]!;
      console.warn(`[OCR] ❌ Aadhaar MISMATCHED. Doc has: ${firstFound}, entered: ${enteredClean}`);
      return {
        success: false,
        text: extractedText,
        extractedNumber: firstFound,
        status: "mismatched",
      };
    }

    console.warn("[OCR] No 12-digit number found in document → unreadable");
    return { success: false, text: extractedText, status: "unreadable" };
  } catch (error: any) {
    console.error("[OCR] Fatal error:", error?.message || error);
    return { success: false, text: "", status: "unreadable" };
  }
};
