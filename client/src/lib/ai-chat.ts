export const aiChatCopy = {
  zh: {
    title: 'AI 客服助理', ready: '可使用', checking: '正在確認服務狀態…', unavailableStatus: '暫時無法使用',
    unavailable: 'AI 客服暫時無法使用，請透過 LINE 聯絡我們。',
    contact: '透過 LINE 聯絡', open: '開啟 AI 客服', close: '關閉 AI 客服', send: '傳送訊息',
    placeholder: '輸入您的問題...', welcome: '您好！我是 ろかいずみ合同会社 的 AI 客服助理，可以協助您了解產品。',
  },
  cn: {
    title: 'AI 客服助理', ready: '可使用', checking: '正在确认服务状态…', unavailableStatus: '暂时无法使用',
    unavailable: 'AI 客服暂时无法使用，请通过 LINE 联系我们。',
    contact: '通过 LINE 联系', open: '打开 AI 客服', close: '关闭 AI 客服', send: '发送消息',
    placeholder: '输入您的问题...', welcome: '您好！我是 ろかいずみ合同会社 的 AI 客服助理，可以帮助您了解产品。',
  },
  en: {
    title: 'AI Customer Service', ready: 'Available', checking: 'Checking availability…', unavailableStatus: 'Temporarily unavailable',
    unavailable: 'AI customer service is temporarily unavailable. Please contact us on LINE.',
    contact: 'Contact us on LINE', open: 'Open AI customer service', close: 'Close AI customer service', send: 'Send message',
    placeholder: 'Type your question...', welcome: 'Hello! I am the AI customer service assistant of ろかいずみ合同会社. I can help you learn about our products.',
  },
  ja: {
    title: 'AIカスタマーサービス', ready: '利用可能', checking: '利用状況を確認中…', unavailableStatus: '一時的に利用できません',
    unavailable: 'AIチャットは一時的にご利用いただけません。LINEでお問い合わせください。',
    contact: 'LINEでお問い合わせ', open: 'AIチャットを開く', close: 'AIチャットを閉じる', send: 'メッセージを送信',
    placeholder: '質問を入力してください...', welcome: 'こんにちは！ろかいずみ合同会社のAIアシスタントです。製品についてご案内いたします。',
  },
} as const;

// Fail closed on missing status, query failures, and failed chat requests.
export function getAIChatState(status: {
  available?: boolean;
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
  chatError: boolean;
}): 'ready' | 'checking' | 'unavailable' {
  if (status.isError || status.chatError) return 'unavailable';
  if (status.isPending || status.isFetching) return 'checking';
  return status.available === true ? 'ready' : 'unavailable';
}
