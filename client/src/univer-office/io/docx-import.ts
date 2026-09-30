/**
 * .docx 讀取（零依賴）。
 *
 * .docx 本質上是一個 ZIP，內含 word/document.xml。
 * 因此只要：解 ZIP → 取 document.xml → 把 <w:p> 段落與 <w:t> 文字抽出來，就能還原內文。
 *
 * 為什麼不用 mammoth 之類的函式庫？
 *   - 只需要「純文字匯入」，不需要保留完整樣式
 *   - mammoth 會拉進 Node 專用的模組（fs / argparse），在瀏覽器打包時是不必要的風險
 *   - 瀏覽器原生就有 DecompressionStream('deflate-raw')，ZIP 解析可以自己來
 *
 * 限制（已在 UI 上告知使用者）：只還原文字，圖片、表格框線、字型與顏色不會帶入。
 */

const SIG_EOCD = 0x06054b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;

interface ZipEntry {
  name: string;
  compression: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

function findEndOfCentralDirectory(view: DataView): number {
  // EOCD 位於檔尾，註解最長 65535，往前找 22 + 65535 個位元組
  const maxBack = Math.min(view.byteLength, 22 + 0xffff);
  for (let i = view.byteLength - 22; i >= view.byteLength - maxBack; i -= 1) {
    if (i < 0) break;
    if (view.getUint32(i, true) === SIG_EOCD) return i;
  }
  return -1;
}

function readCentralDirectory(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEndOfCentralDirectory(view);
  if (eocd < 0) throw new Error('不是有效的 .docx 檔（找不到 ZIP 結尾標記）');

  const entryCount = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder('utf-8');
  const entries: ZipEntry[] = [];

  for (let i = 0; i < entryCount; i += 1) {
    if (offset + 46 > view.byteLength) break;
    if (view.getUint32(offset, true) !== SIG_CENTRAL) break;

    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);

    entries.push({
      compression: view.getUint16(offset + 10, true),
      compressedSize: view.getUint32(offset + 20, true),
      uncompressedSize: view.getUint32(offset + 24, true),
      localHeaderOffset: view.getUint32(offset + 42, true),
      name: decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength)),
    });

    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as unknown as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readEntry(bytes: Uint8Array, entry: ZipEntry): Promise<Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const at = entry.localHeaderOffset;
  if (view.getUint32(at, true) !== SIG_LOCAL) throw new Error(`ZIP 項目 ${entry.name} 的標頭毀損`);

  const nameLength = view.getUint16(at + 26, true);
  const extraLength = view.getUint16(at + 28, true);
  const start = at + 30 + nameLength + extraLength;
  const raw = bytes.subarray(start, start + entry.compressedSize);

  if (entry.compression === 0) return raw;
  if (entry.compression === 8) return inflateRaw(raw);
  throw new Error(`不支援的 ZIP 壓縮方式：${entry.compression}`);
}

const XML_ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
};

function decodeXml(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g, (entity) => {
    if (XML_ENTITIES[entity]) return XML_ENTITIES[entity];
    if (entity.startsWith('&#x')) return String.fromCodePoint(parseInt(entity.slice(3, -1), 16));
    if (entity.startsWith('&#')) return String.fromCodePoint(parseInt(entity.slice(2, -1), 10));
    return entity;
  });
}

/**
 * 把 OOXML 內文轉成段落陣列。
 * 段落邊界來自 </w:p>，行內換行來自 <w:br/>。
 */
export function documentXmlToParagraphs(xml: string): string[] {
  const body = /<w:body[^>]*>([\s\S]*)<\/w:body>/.exec(xml)?.[1] ?? xml;
  const paragraphs: string[] = [];

  for (const chunk of body.split(/<\/w:p>/)) {
    if (!chunk.includes('<w:p') && !chunk.includes('<w:t')) continue;
    const withBreaks = chunk.replace(/<w:br\s*\/?>/g, '\n').replace(/<w:tab\s*\/?>/g, '\t');
    const texts = Array.from(withBreaks.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)).map((m) => decodeXml(m[1]));
    paragraphs.push(texts.join('').replace(/\r/g, ''));
  }

  // 去掉尾端連續的空段落
  while (paragraphs.length > 0 && paragraphs[paragraphs.length - 1].trim() === '') paragraphs.pop();
  return paragraphs;
}

/** 解析 .docx 檔案，回傳段落文字 */
export async function parseDocxParagraphs(file: File | Blob): Promise<string[]> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const entries = readCentralDirectory(bytes);
  const entry = entries.find((e) => e.name === 'word/document.xml');
  if (!entry) throw new Error('這個檔案不是標準的 .docx（找不到 word/document.xml）');

  const xml = new TextDecoder('utf-8').decode(await readEntry(bytes, entry));
  return documentXmlToParagraphs(xml);
}
