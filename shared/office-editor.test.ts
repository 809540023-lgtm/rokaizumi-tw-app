import { describe, expect, it } from 'vitest';
import {
  buildOfficeEditorSrc,
  OFFICE_EDITOR_DEFAULT_URL,
} from './office-editor';

describe('buildOfficeEditorSrc', () => {
  it('帶入 embed、mode 與 parentOrigin，讓外層網站能安全接收訊息', () => {
    const src = buildOfficeEditorSrc(
      OFFICE_EDITOR_DEFAULT_URL,
      'sheets',
      'https://rokaizumi-tw.jp'
    );
    const url = new URL(src);

    expect(url.origin).toBe('https://univer-office.onrender.com');
    expect(url.searchParams.get('embed')).toBe('1');
    expect(url.searchParams.get('mode')).toBe('sheets');
    expect(url.searchParams.get('parentOrigin')).toBe('https://rokaizumi-tw.jp');
  });

  it('可切換文檔模式', () => {
    const src = buildOfficeEditorSrc(OFFICE_EDITOR_DEFAULT_URL, 'docs', 'http://localhost:3000');
    expect(new URL(src).searchParams.get('mode')).toBe('docs');
  });

  it('base 結尾有斜線或帶路徑時仍正確', () => {
    expect(new URL(buildOfficeEditorSrc('https://example.com/office/', 'sheets', 'https://a.com')).pathname).toBe(
      '/office/'
    );
    expect(new URL(buildOfficeEditorSrc('https://example.com/office', 'sheets', 'https://a.com')).pathname).toBe(
      '/office'
    );
  });

  it('base 不是合法網址時丟錯（避免產出壞掉的 iframe）', () => {
    expect(() => buildOfficeEditorSrc('not-a-url', 'sheets', 'https://a.com')).toThrow();
  });
});
