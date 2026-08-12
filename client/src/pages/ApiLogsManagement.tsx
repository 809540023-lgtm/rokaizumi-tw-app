import { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';
import { RefreshCw, Download } from 'lucide-react';

export default function ApiLogsManagement() {
  const { language } = useLanguage();
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const getLabels = () => {
    const labels: Record<string, Record<string, string>> = {
      zh: {
        title: '🔌 API 日誌',
        refresh: '重新整理',
        download: '下載',
        noData: '暫無日誌',
        time: '時間',
        status: '狀態',
        message: '訊息',
      },
      en: {
        title: '🔌 API Logs',
        refresh: 'Refresh',
        download: 'Download',
        noData: 'No logs',
        time: 'Time',
        status: 'Status',
        message: 'Message',
      },
      ja: {
        title: '🔌 API ログ',
        refresh: '更新',
        download: 'ダウンロード',
        noData: 'ログなし',
        time: '時間',
        status: 'ステータス',
        message: 'メッセージ',
      },
    };
    return labels[language] || labels.zh;
  };

  const labels = getLabels();

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      // 暫時使用空陣列，稍後會添加實際的 API 呼叫
      setLogs([]);
    } catch (error) {
      console.error('Failed to fetch API logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">{labels.title}</h1>
        <Button onClick={fetchLogs} disabled={isLoading} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          {labels.refresh}
        </Button>
      </div>

      <Card className="p-6">
        {logs.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            {labels.noData}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-4">{labels.time}</th>
                  <th className="text-left py-2 px-4">{labels.status}</th>
                  <th className="text-left py-2 px-4">{labels.message}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, index) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-4 text-gray-600">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        log.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-gray-600">{log.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
