/**
 * .docx 匯出。
 *
 * 用 docx 套件產生標準 OOXML，動態載入以維持 chunk 分割。
 * 會依 Univer 段落的文字內容，自動判斷標題 / 副標題 / 內文，
 * 讓匯出的 Word 檔在 Word 裡開啟時有基本層次。
 */

export interface DocxParagraphInput {
  text: string;
  /** 0 = 內文, 1 = 大標題, 2 = 小標題（由呼叫端依 Univer 的樣式決定） */
  level?: number;
  centered?: boolean;
}

const HEADING_RE = /^(主旨|說明|擬辦|決議|結論|一、|二、|三、|四、|五、|六、)[：:]?/;

async function loadDocx() {
  return import('docx');
}

function classify(text: string, index: number, total: number, explicit?: number): number {
  if (explicit !== undefined) return explicit;
  const trimmed = text.trim();
  if (index === 0 && trimmed.length > 0 && trimmed.length <= 30) return 1; // 首行標題
  if (trimmed.length <= 20 && /^(主旨|說明|擬辦|決議|結論|出席人員|會議時間)/.test(trimmed)) return 2;
  if (trimmed.length <= 24 && HEADING_RE.test(trimmed) && index < total - 1) return 2;
  return 0;
}

export async function paragraphsToDocxBlob(
  paragraphs: DocxParagraphInput[],
  options: { title?: string } = {},
): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = (await loadDocx()) as any;

  const children = paragraphs.map((p, index) => {
    const level = classify(p.text, index, paragraphs.length, p.level);
    const text = p.text.replace(/\u00a0/g, ' ');
    const alignment = p.centered || level === 1 ? AlignmentType.CENTER : undefined;

    if (level === 1) {
      return new Paragraph({
        alignment,
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 200 },
        children: [new TextRun({ text, bold: true, size: 32 })],
      });
    }
    if (level === 2) {
      return new Paragraph({
        alignment,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 160, after: 80 },
        children: [new TextRun({ text, bold: true, size: 26 })],
      });
    }
    return new Paragraph({
      alignment,
      spacing: { after: 60, line: 320 },
      children: [new TextRun({ text, size: 22 })],
    });
  });

  const doc = new Document({
    creator: 'ろかいずみ',
    title: options.title ?? '文件',
    sections: [{ children }],
  });

  return Packer.toBlob(doc);
}
