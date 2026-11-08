import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appRouter } from './routers';
import { ENV } from './_core/env';
import { invokeLLM } from './_core/llm';
import type { TrpcContext } from './_core/context';
import { aiChatCopy, getAIChatState } from '../client/src/lib/ai-chat';

vi.mock('./_core/env', () => ({ ENV: { forgeApiKey: '', forgeApiUrl: '' } }));
vi.mock('./_core/llm', () => ({ invokeLLM: vi.fn() }));
const caller = appRouter.createCaller({ user: null, req: {}, res: {} } as TrpcContext);

beforeEach(() => {
  ENV.forgeApiKey = '';
  vi.mocked(invokeLLM).mockReset();
});

describe('AI public availability', () => {
  it.each(['', '   '])('fails closed with absent credentials (%j)', async key => {
    ENV.forgeApiKey = key;
    expect(await caller.ai.status()).toEqual({ available: false });
    await expect(caller.ai.chat({ message: 'Hello', language: 'en' }))
      .rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE', message: 'AI chat is temporarily unavailable.' });
    expect(invokeLLM).not.toHaveBeenCalled();
  });
  it('returns only a boolean and never probes the model', async () => {
    ENV.forgeApiKey = 'test-only-placeholder';
    expect(await caller.ai.status()).toEqual({ available: true });
    expect(invokeLLM).not.toHaveBeenCalled();
  });
  it('preserves configured chat behavior using a mocked model', async () => {
    ENV.forgeApiKey = 'test-only-placeholder';
    vi.mocked(invokeLLM).mockResolvedValue({ choices: [{ message: { content: 'Test reply' } }] } as any);
    expect(await caller.ai.chat({ message: 'Hello', language: 'en' })).toEqual({ response: 'Test reply' });
    expect(invokeLLM).toHaveBeenCalledOnce();
  });
  it('rechecks configuration on each chat, including after a successful status', async () => {
    ENV.forgeApiKey = 'test-only-placeholder';
    expect(await caller.ai.status()).toEqual({ available: true });
    ENV.forgeApiKey = '';
    await expect(caller.ai.chat({ message: 'Hello' })).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
    expect(invokeLLM).not.toHaveBeenCalled();
  });
});

describe('chat UI availability state', () => {
  const base = { isPending: false, isFetching: false, isError: false, chatError: false };
  it('requires an explicitly available status to allow sending', () => {
    expect(getAIChatState(base)).toBe('unavailable');
    expect(getAIChatState({ ...base, available: false })).toBe('unavailable');
    expect(getAIChatState({ ...base, available: true })).toBe('ready');
  });
  it('does not claim availability while initially loading or rechecking on reopen', () => {
    expect(getAIChatState({ ...base, isPending: true })).toBe('checking');
    expect(getAIChatState({ ...base, available: true, isFetching: true })).toBe('checking');
  });
  it('query and chat failures override previously available cached data', () => {
    expect(getAIChatState({ ...base, available: true, isError: true })).toBe('unavailable');
    expect(getAIChatState({ ...base, available: true, chatError: true })).toBe('unavailable');
  });
  it.each(['zh', 'cn', 'en', 'ja'] as const)('provides localized fallback and accessible labels in %s', language => {
    const copy = aiChatCopy[language];
    expect(copy.unavailable).toContain('LINE');
    expect(copy.contact).toContain('LINE');
    for (const label of [copy.open, copy.close, copy.send, copy.checking, copy.placeholder]) {
      expect(label.length).toBeGreaterThan(0);
    }
  });
});
