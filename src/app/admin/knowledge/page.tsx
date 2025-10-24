'use client';

import { useState, useEffect } from 'react';

interface KnowledgeStatus {
  knowledgeEntriesCount: number;
  lastUpdate: string | null;
  sampleEntries: Array<{
    id: string;
    condition: string;
    tea: string;
    blend: string;
    sweetener: string;
    snack: string;
    reason: string;
    source: string;
  }>;
}

export default function KnowledgeAdminPage() {
  const [status, setStatus] = useState<KnowledgeStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/learn-articles');
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Error fetching status:', error);
    }
  };

  const learnArticles = async (forceUpdate = false) => {
    setIsLoading(true);
    setMessage('');
    
    try {
      const response = await fetch('/api/learn-articles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ forceUpdate }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setMessage(`学習完了: ${data.articlesCount}記事から${data.knowledgeEntriesCount}件の知識を抽出`);
        fetchStatus(); // ステータスを更新
      } else {
        const error = await response.json();
        setMessage(`エラー: ${error.error}`);
      }
    } catch (_error) {
      setMessage('エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          知識ベース管理
        </h1>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">学習状況</h2>
          
          {status && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-800">知識エントリ数</h3>
                <p className="text-2xl font-bold text-blue-600">{status.knowledgeEntriesCount}</p>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-semibold text-green-800">最終更新</h3>
                <p className="text-sm text-green-600">
                  {status.lastUpdate 
                    ? new Date(status.lastUpdate).toLocaleString('ja-JP')
                    : '未学習'
                  }
                </p>
              </div>
              
              <div className="bg-purple-50 p-4 rounded-lg">
                <h3 className="font-semibold text-purple-800">サンプル数</h3>
                <p className="text-2xl font-bold text-purple-600">{status.sampleEntries.length}</p>
              </div>
            </div>
          )}

          <div className="flex gap-4 mb-6">
            <button
              onClick={() => learnArticles(false)}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              {isLoading ? '学習中...' : '記事を学習'}
            </button>
            
            <button
              onClick={() => learnArticles(true)}
              disabled={isLoading}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
            >
              強制更新
            </button>
          </div>

          {message && (
            <div className={`p-4 rounded-lg ${
              message.includes('エラー') 
                ? 'bg-red-50 text-red-700' 
                : 'bg-green-50 text-green-700'
            }`}>
              {message}
            </div>
          )}
        </div>

        {status && status.sampleEntries.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">サンプル知識エントリ</h2>
            
            <div className="space-y-4">
              {status.sampleEntries.map((entry, _index) => (
                <div key={entry.id} className="border rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-semibold text-gray-800">条件</h3>
                      <p className="text-gray-600">{entry.condition}</p>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold text-gray-800">出典</h3>
                      <p className="text-gray-600">{entry.source}</p>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold text-gray-800">お茶</h3>
                      <p className="text-gray-600">{entry.tea}</p>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold text-gray-800">ブレンド</h3>
                      <p className="text-gray-600">{entry.blend}</p>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold text-gray-800">甘味料</h3>
                      <p className="text-gray-600">{entry.sweetener}</p>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold text-gray-800">お茶菓子</h3>
                      <p className="text-gray-600">{entry.snack}</p>
                    </div>
                  </div>
                  
                  <div className="mt-3">
                    <h3 className="font-semibold text-gray-800">理由</h3>
                    <p className="text-gray-600">{entry.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

