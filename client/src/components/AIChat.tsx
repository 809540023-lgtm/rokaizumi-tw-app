import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MessageCircle, X, Send, Bot, User } from 'lucide-react';
import { trpc } from '../lib/trpc';
import { useLanguage } from '../contexts/LanguageContext';
import { LINE_ADD_FRIEND_URL } from '../lib/line';
import { aiChatCopy, getAIChatState } from '../lib/ai-chat';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function AIChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { language } = useLanguage();

  const chatMutation = trpc.ai.chat.useMutation({
    onSuccess: (data: { response: string }) => {
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    },
  });

  const copy = aiChatCopy[language];
  const statusQuery = trpc.ai.status.useQuery(undefined, {
    enabled: isOpen,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: isOpen ? 60_000 : false,
  });
  const state = getAIChatState({
    available: statusQuery.data?.available,
    isPending: statusQuery.isPending,
    isFetching: statusQuery.isFetching,
    isError: statusQuery.isError,
    chatError: chatMutation.isError,
  });
  const canSend = state === 'ready' && !chatMutation.isPending;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || !canSend) return;

    const userMessage = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInput('');

    chatMutation.mutate({ message: userMessage, language: language === 'cn' ? 'zh' : language });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => { if (chatMutation.isError) chatMutation.reset(); setIsOpen(true); }}
        aria-label={copy.open}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-[#0ABAB5] hover:bg-[#089B96] shadow-lg z-50 mb-[env(safe-area-inset-bottom)]"
      >
        <MessageCircle className="w-8 h-8 text-white" />
      </Button>
    );
  }

  return (
    <Card className="fixed inset-x-3 bottom-3 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-96 h-[70vh] sm:h-[600px] flex flex-col shadow-2xl z-50 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0ABAB5] to-[#089B96] p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
            <Bot className="w-6 h-6 text-[#0ABAB5]" />
          </div>
          <div>
            <h3 className="text-white font-bold">{copy.title}</h3>
            <p className="text-white/80 text-sm">
              {state === 'ready' ? copy.ready : state === 'checking' ? copy.checking : copy.unavailableStatus}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(false)}
          aria-label={copy.close}
          className="text-white hover:bg-white/20"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {state === 'unavailable' && (
          <div role="status" className="bg-white rounded-lg p-3 shadow-sm text-sm text-gray-800">
            <p>{copy.unavailable}</p>
            <a href={LINE_ADD_FRIEND_URL} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[#087D79] underline font-medium">{copy.contact}</a>
          </div>
        )}
        {messages.length === 0 && state === 'ready' && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-[#0ABAB5] rounded-full flex items-center justify-center flex-shrink-0">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="bg-white rounded-lg p-3 shadow-sm max-w-[80%]">
              <p className="text-sm text-gray-800">{copy.welcome}</p>
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex items-start gap-3 ${
              message.role === 'user' ? 'flex-row-reverse' : ''
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                message.role === 'user'
                  ? 'bg-[#DC2626]'
                  : 'bg-[#0ABAB5]'
              }`}
            >
              {message.role === 'user' ? (
                <User className="w-5 h-5 text-white" />
              ) : (
                <Bot className="w-5 h-5 text-white" />
              )}
            </div>
            <div
              className={`rounded-lg p-3 shadow-sm max-w-[80%] ${
                message.role === 'user'
                  ? 'bg-[#DC2626] text-white'
                  : 'bg-white text-gray-800'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}

        {chatMutation.isPending && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-[#0ABAB5] rounded-full flex items-center justify-center flex-shrink-0">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={copy.placeholder}
            aria-label={copy.placeholder}
            disabled={!canSend}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || !canSend}
            aria-label={copy.send}
            className="bg-[#0ABAB5] hover:bg-[#089B96]"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
