import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MessageCircle, X, Send, Bot, User } from 'lucide-react';
import { trpc } from '../lib/trpc';
import { useLanguage } from '../contexts/LanguageContext';

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
    onError: () => {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: language === 'zh' ? '抱歉，我現在無法回答。請稍後再試。' : 
                 language === 'en' ? 'Sorry, I cannot answer right now. Please try again later.' :
                 '申し訳ございません。現在お答えできません。後でもう一度お試しください。'
      }]);
    },
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || chatMutation.isPending) return;

    const userMessage = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInput('');

    chatMutation.mutate({ message: userMessage, language });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getWelcomeMessage = () => {
    switch (language) {
      case 'zh':
        return '您好！我是 ろかいずみ合同会社 的 AI 客服助理。我可以幫助您了解我們的產品、訂單狀態和其他問題。請問有什麼可以幫助您的嗎？';
      case 'en':
        return 'Hello! I am the AI customer service assistant of ろかいずみ合同会社. I can help you with our products, order status, and other questions. How can I help you?';
      case 'ja':
        return 'こんにちは！ろかいずみ合同会社のAIカスタマーサービスアシスタントです。製品、注文状況、その他のご質問についてサポートいたします。何かお手伝いできることはありますか？';
      default:
        return '您好！我是 ろかいずみ合同会社 的 AI 客服助理。';
    }
  };

  const getPlaceholder = () => {
    switch (language) {
      case 'zh': return '輸入您的問題...';
      case 'en': return 'Type your question...';
      case 'ja': return '質問を入力してください...';
      default: return '輸入您的問題...';
    }
  };

  const getTitle = () => {
    switch (language) {
      case 'zh': return 'AI 客服助理';
      case 'en': return 'AI Customer Service';
      case 'ja': return 'AIカスタマーサービス';
      default: return 'AI 客服助理';
    }
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-16 h-16 rounded-full bg-[#0ABAB5] hover:bg-[#089B96] shadow-lg z-50"
      >
        <MessageCircle className="w-8 h-8 text-white" />
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-6 right-6 w-96 h-[600px] flex flex-col shadow-2xl z-50 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0ABAB5] to-[#089B96] p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
            <Bot className="w-6 h-6 text-[#0ABAB5]" />
          </div>
          <div>
            <h3 className="text-white font-bold">{getTitle()}</h3>
            <p className="text-white/80 text-sm">
              {language === 'zh' ? '在線' : language === 'en' ? 'Online' : 'オンライン'}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(false)}
          className="text-white hover:bg-white/20"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.length === 0 && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-[#0ABAB5] rounded-full flex items-center justify-center flex-shrink-0">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="bg-white rounded-lg p-3 shadow-sm max-w-[80%]">
              <p className="text-sm text-gray-800">{getWelcomeMessage()}</p>
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
            placeholder={getPlaceholder()}
            disabled={chatMutation.isPending}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || chatMutation.isPending}
            className="bg-[#0ABAB5] hover:bg-[#089B96]"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
