'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Article {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  publish_date: string;
  created_at: string;
}

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

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [knowledgeEntries, setKnowledgeEntries] = useState<KnowledgeEntry[]>([]);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    try {
      const response = await fetch('/api/articles');
      const data = await response.json();
      setArticles(data.articles || []);
    } catch (error) {
      console.error('記事の取得に失敗しました:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleArticleClick = async (article: Article) => {
    setSelectedArticle(article);
    setShowModal(true);
    
    try {
      const response = await fetch(`/api/articles/${article.id}`);
      const data = await response.json();
      setKnowledgeEntries(data.knowledgeEntries || []);
    } catch (error) {
      console.error('記事詳細の取得に失敗しました:', error);
      setKnowledgeEntries([]);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getCategoryLabel = (category: string) => {
    const labels: { [key: string]: string } = {
      'health': '健康',
      'lifestyle': 'ライフスタイル',
      'recipe': 'レシピ',
      'culture': '文化'
    };
    return labels[category] || category;
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
              <h1 className="text-3xl font-bold text-gray-900">学習記事一覧</h1>
              <p className="mt-2 text-gray-600">学習済み記事と抽出された知識を確認</p>
            </div>
            <div className="flex gap-4">
              <Link 
                href="/admin/upload"
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors"
              >
                記事を追加
              </Link>
              <Link 
                href="/admin"
                className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg transition-colors"
              >
                管理画面に戻る
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {articles.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">📄</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">記事がありません</h3>
            <p className="text-gray-600 mb-6">まだ学習された記事がありません。</p>
            <Link 
              href="/admin/upload"
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-colors"
            >
              最初の記事を追加
            </Link>
          </div>
        ) : (
          <div className="grid gap-6">
            {articles.map((article) => (
              <div key={article.id} className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{article.title}</h3>
                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {getCategoryLabel(article.category)}
                      </span>
                      <span>学習日: {formatDate(article.created_at)}</span>
                      {article.publish_date && (
                        <span>公開日: {formatDate(article.publish_date)}</span>
                      )}
                    </div>
                    {article.tags && Array.isArray(article.tags) && article.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {article.tags.map((tag, index) => (
                          <span key={index} className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-sm">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleArticleClick(article)}
                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    詳細を見る
                  </button>
                </div>
                
                <div className="text-gray-600 line-clamp-3">
                  {article.content.substring(0, 200)}...
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* モーダル */}
      {showModal && selectedArticle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-2xl font-bold text-gray-900">{selectedArticle.title}</h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              {/* 記事情報 */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-semibold text-gray-700">カテゴリ:</span>
                    <span className="ml-2 text-gray-600">{getCategoryLabel(selectedArticle.category)}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">学習日:</span>
                    <span className="ml-2 text-gray-600">{formatDate(selectedArticle.created_at)}</span>
                  </div>
                  {selectedArticle.publish_date && (
                    <div>
                      <span className="font-semibold text-gray-700">公開日:</span>
                      <span className="ml-2 text-gray-600">{formatDate(selectedArticle.publish_date)}</span>
                    </div>
                  )}
                  <div>
                    <span className="font-semibold text-gray-700">抽出された知識:</span>
                    <span className="ml-2 text-gray-600">{knowledgeEntries.length}件</span>
                  </div>
                </div>
                {selectedArticle.tags && Array.isArray(selectedArticle.tags) && selectedArticle.tags.length > 0 && (
                  <div className="mt-4">
                    <span className="font-semibold text-gray-700">タグ:</span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedArticle.tags.map((tag, index) => (
                        <span key={index} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 記事内容 */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">記事内容</h3>
                <div className="bg-white border rounded-lg p-4 max-h-60 overflow-y-auto">
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedArticle.content}</p>
                </div>
              </div>

              {/* 抽出された知識 */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  抽出された知識 ({knowledgeEntries.length}件)
                </h3>
                {knowledgeEntries.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-4xl mb-2">🤖</div>
                    <p>この記事から知識を抽出できませんでした</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {knowledgeEntries.map((entry) => (
                      <div key={entry.id} className="border rounded-lg p-4 bg-green-50">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h4 className="font-semibold text-gray-900 mb-2">条件・状況</h4>
                            <p className="text-gray-700">{entry.condition}</p>
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900 mb-2">おすすめのお茶</h4>
                            <p className="text-gray-700">{entry.tea}</p>
                            {entry.blend && (
                              <p className="text-sm text-gray-600 mt-1">ブレンド: {entry.blend}</p>
                            )}
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900 mb-2">甘味料・お茶菓子</h4>
                            <p className="text-gray-700">甘味料: {entry.sweetener}</p>
                            <p className="text-gray-700">お茶菓子: {entry.snack}</p>
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900 mb-2">理由</h4>
                            <p className="text-gray-700">{entry.reason}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


