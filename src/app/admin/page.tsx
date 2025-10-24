'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface KnowledgeEntry {
  id: string;
  condition: string;
  tea: string;
  blend: string;
  sweetener: string;
  snack: string;
  reason: string;
  source: string;
}

interface Stats {
  articlesCount: number;
  knowledgeEntriesCount: number;
  lastUpdate: string;
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'knowledge' | 'history' | 'stats'>('knowledge');
  const [knowledgeEntries, setKnowledgeEntries] = useState<KnowledgeEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await fetch('/api/supabase-upload');
      const data = await response.json();
      
      setKnowledgeEntries(data.allEntries || []);
      setStats({
        articlesCount: data.articlesCount,
        knowledgeEntriesCount: data.knowledgeEntriesCount,
        lastUpdate: data.lastUpdate
      });
    } catch (error) {
      console.error('データの取得に失敗しました:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getReliabilityScore = (entry: KnowledgeEntry) => {
    // 簡単な信頼度計算（実際の実装ではより複雑なロジックを使用）
    const hasReason = entry.reason && entry.reason.length > 10;
    const hasSource = entry.source && entry.source.length > 0;
    return hasReason && hasSource ? 90 : 70;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">RAG知識ベース管理</h1>
              <p className="mt-2 text-gray-600">お茶の専門知識を管理・学習履歴を確認</p>
            </div>
            <Link 
              href="/"
              className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg transition-colors"
            >
              ホームに戻る
            </Link>
          </div>
        </div>
      </div>

      {/* タブナビゲーション */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('knowledge')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'knowledge'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              知識ベース ({knowledgeEntries.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'history'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              学習履歴 ({stats?.articlesCount || 0})
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'stats'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              統計情報
            </button>
          </nav>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'knowledge' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">お茶知識ベース</h2>
            <p className="text-gray-600 mb-6">
              現在{knowledgeEntries.length}件の知識が登録されています
            </p>
            
            <div className="space-y-6">
              {knowledgeEntries.map((entry) => (
                <div key={entry.id} className="bg-white rounded-lg shadow-sm border p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold text-gray-900">{entry.condition}</h3>
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span>信頼度: {getReliabilityScore(entry)}%</span>
                      <span>更新: {formatDate(entry.source)}</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-2">お茶の種類</h4>
                      <p className="text-gray-600">{entry.tea}</p>
                      {entry.blend && (
                        <p className="text-sm text-gray-500 mt-1">ブレンド: {entry.blend}</p>
                      )}
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-2">甘味料・お茶菓子</h4>
                      <p className="text-gray-600">甘味料: {entry.sweetener}</p>
                      <p className="text-gray-600">お茶菓子: {entry.snack}</p>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-2">出典</h4>
                      <p className="text-gray-600">{entry.source}</p>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-700 mb-2">理由</h4>
                    <p className="text-gray-600">{entry.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">学習履歴</h2>
            <p className="text-gray-600 mb-6">
              記事の学習履歴とAI抽出結果を確認できます
            </p>
            
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">最近の学習活動</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-gray-200">
                  <div>
                    <p className="font-medium text-gray-900">記事学習完了</p>
                    <p className="text-sm text-gray-500">15件の記事から7件の知識を抽出</p>
                  </div>
                  <span className="text-sm text-gray-500">
                    {stats?.lastUpdate ? formatDate(stats.lastUpdate) : '不明'}
                  </span>
                </div>
                
                <div className="flex justify-between items-center py-3 border-b border-gray-200">
                  <div>
                    <p className="font-medium text-gray-900">知識ベース更新</p>
                    <p className="text-sm text-gray-500">新しい知識エントリが追加されました</p>
                  </div>
                  <span className="text-sm text-gray-500">
                    {stats?.lastUpdate ? formatDate(stats.lastUpdate) : '不明'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">統計情報</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">記事数</h3>
                <p className="text-3xl font-bold text-orange-500">{stats?.articlesCount || 0}</p>
                <p className="text-sm text-gray-500 mt-1">学習済み記事</p>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">知識エントリ</h3>
                <p className="text-3xl font-bold text-green-500">{stats?.knowledgeEntriesCount || 0}</p>
                <p className="text-sm text-gray-500 mt-1">抽出された知識</p>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">最終更新</h3>
                <p className="text-lg font-bold text-blue-500">
                  {stats?.lastUpdate ? formatDate(stats.lastUpdate) : '不明'}
                </p>
                <p className="text-sm text-gray-500 mt-1">最新の学習</p>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">知識ベースの状況</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">疲労回復関連</span>
                  <span className="font-semibold text-green-600">1件</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">ストレス解消関連</span>
                  <span className="font-semibold text-green-600">1件</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">風邪予防関連</span>
                  <span className="font-semibold text-green-600">1件</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">美肌効果関連</span>
                  <span className="font-semibold text-green-600">1件</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">消化促進関連</span>
                  <span className="font-semibold text-green-600">2件</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">リラックス関連</span>
                  <span className="font-semibold text-green-600">1件</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

