import { describe, expect, it } from 'vitest';
import { b2bInquiryInput } from './b2b-inquiry';
const valid = { company: ' Test ', name: ' Contact ', phone: ' 123 ', type: '其他', monthlyBudget: '5-10 萬' };
describe('B2B inquiry validation', () => {
  it.each([undefined, '', '   '])('accepts optional email %s', email => {
    expect(b2bInquiryInput.parse({ ...valid, email })).toMatchObject({ company: 'Test', name: 'Contact', phone: '123', email: undefined });
  });
  it('trims valid email', () => expect(b2bInquiryInput.parse({ ...valid, email: ' contact@example.com ' }).email).toBe('contact@example.com'));
  it('rejects invalid nonblank email', () => expect(b2bInquiryInput.safeParse({ ...valid, email: 'invalid' }).success).toBe(false));
  it.each(['company', 'name', 'phone'])('rejects whitespace-only %s', key => expect(b2bInquiryInput.safeParse({ ...valid, [key]: '  ' }).success).toBe(false));
});
