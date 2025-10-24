'use client';

import { useState, useEffect } from 'react';

interface ArticleData {
  title: string;
  content: string;
  category: string;
  tags: string[];
  publishDate: string;
}

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

export default function UploadPage() {
  const [articles, setArticles] = useState<ArticleData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<KnowledgeStatus | null>(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/upload-articles');
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Error fetching status:', error);
    }
  };

  const addArticle = () => {
    const newArticle: ArticleData = {
      title: '',
      content: '',
      category: 'health',
      tags: [],
      publishDate: new Date().toISOString().split('T')[0]
    };
    setArticles([...articles, newArticle]);
  };

  const updateArticle = (index: number, field: keyof ArticleData, value: string | string[]) => {
    const updatedArticles = [...articles];
    if (field === 'tags' && typeof value === 'string') {
      // タグの場合は文字列を配列に変換
      updatedArticles[index] = { 
        ...updatedArticles[index], 
        [field]: value.split(',').map(tag => tag.trim()).filter(tag => tag) 
      };
    } else {
      updatedArticles[index] = { ...updatedArticles[index], [field]: value };
    }
    setArticles(updatedArticles);
  };

  const removeArticle = (index: number) => {
    const updatedArticles = articles.filter((_, i) => i !== index);
    setArticles(updatedArticles);
  };

  const uploadArticles = async () => {
    if (articles.length === 0) {
      setMessage('記事を追加してください');
      return;
    }

    // バリデーション
    for (const article of articles) {
      if (!article.title.trim() || !article.content.trim()) {
        setMessage('すべての記事にタイトルと内容を入力してください');
        return;
      }
    }

    setIsLoading(true);
    setMessage('');
    
    try {
      const response = await fetch('/api/upload-articles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ articles }),
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // 詳細な抽出結果を表示
        let message = `学習完了: ${data.articlesCount}記事から${data.knowledgeEntriesCount}件の知識を抽出`;
        
        if (data.extractionResults) {
          const failedArticles = data.extractionResults.filter((result: any) => result.extractedCount === 0);
          if (failedArticles.length > 0) {
            message += '\n\n【抽出できなかった記事】';
            failedArticles.forEach((result: any) => {
              message += `\n・${result.title}: ${result.reason || '理由不明'}`;
            });
          }
        }
        
        setMessage(message);
        setArticles([]); // アップロード後はクリア
        fetchStatus(); // ステータスを更新
      } else {
        const error = await response.json();
        setMessage(`エラー: ${error.error}`);
      }
    } catch (error) {
      setMessage('エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          記事原稿アップロード
        </h1>

        {/* 現在の学習状況 */}
        {status && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">現在の学習状況</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
          </div>
        )}

        {/* 記事入力フォーム */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">記事原稿</h2>
            <button
              onClick={addArticle}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              記事を追加
            </button>
          </div>

          {articles.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              記事を追加してください
            </div>
          )}

          {articles.map((article, index) => (
            <div key={index} className="border rounded-lg p-4 mb-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-900">記事 {index + 1}</h3>
                <button
                  onClick={() => removeArticle(index)}
                  className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  削除
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    タイトル *
                  </label>
                  <input
                    type="text"
                    value={article.title}
                    onChange={(e) => updateArticle(index, 'title', e.target.value)}
                    className="w-full p-2 border rounded-lg placeholder-gray-600 text-gray-900"
                    placeholder="記事のタイトル"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    カテゴリ
                  </label>
                  <select
                    value={article.category}
                    onChange={(e) => updateArticle(index, 'category', e.target.value)}
                    className="w-full p-2 border rounded-lg text-gray-900"
                  >
                    <option value="health">健康</option>
                    <option value="lifestyle">ライフスタイル</option>
                    <option value="recipe">レシピ</option>
                    <option value="culture">文化</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    タグ（カンマ区切り）
                  </label>
                  <input
                    type="text"
                    value={article.tags.join(', ')}
                    onChange={(e) => updateArticle(index, 'tags', e.target.value)}
                    className="w-full p-2 border rounded-lg placeholder-gray-600 text-gray-900"
                    placeholder="疲労回復, 免疫力, 緑茶"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    公開日
                  </label>
                  <input
                    type="date"
                    value={article.publishDate}
                    onChange={(e) => updateArticle(index, 'publishDate', e.target.value)}
                    className="w-full p-2 border rounded-lg text-gray-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  記事内容 *
                </label>
                <textarea
                  value={article.content}
                  onChange={(e) => updateArticle(index, 'content', e.target.value)}
                  className="w-full p-2 border rounded-lg h-32 placeholder-gray-600 text-gray-900"
                  placeholder="記事の本文を入力してください..."
                />
              </div>
            </div>
          ))}

          {articles.length > 0 && (
            <div className="flex gap-4">
              <button
                onClick={uploadArticles}
                disabled={isLoading}
                className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
              >
                {isLoading ? '学習中...' : '記事を学習'}
              </button>
              
              <button
                onClick={() => setArticles([])}
                className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                クリア
              </button>
            </div>
          )}

          {message && (
            <div className={`mt-4 p-4 rounded-lg ${
              message.includes('エラー') 
                ? 'bg-red-50 text-red-700' 
                : 'bg-green-50 text-green-700'
            }`}>
              {message}
            </div>
          )}
        </div>

        {/* サンプル記事 */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">サンプル記事（コピーして使用）</h2>
          
          <div className="space-y-4">
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-2 text-gray-900">疲労回復のお茶</h3>
              <div className="text-sm text-gray-600 space-y-2">
                <p><strong>タイトル:</strong> 疲れた時に飲むお茶と、相性の良い素材・食べ物</p>
                <p><strong>内容:</strong> 疲労を感じたときにおすすめの日本茶やハーブとのブレンド素材、はちみつなどの甘味、さらには一緒に食べると良い食品まで紹介。日常に取り入れやすい癒しのティータイムをご提案します。緑茶にレモンとハチミツを加えることで、疲労回復効果が期待できます。</p>
                <p><strong>タグ:</strong> 疲労回復, はちみつ, ブレンドティー, 日本茶</p>
              </div>
            </div>

            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-2 text-gray-900">免疫力向上のお茶</h3>
              <div className="text-sm text-gray-600 space-y-2">
                <p><strong>タイトル:</strong> 季節の変わり目にぴったり！免疫力を高める日本茶ブレンド</p>
                <p><strong>内容:</strong> 風邪をひきやすい季節の変わり目におすすめの、免疫力をサポートする日本茶ブレンドをご紹介します。エキナセアや柚子、緑茶などの素材の特徴と効果的な飲み方も解説。エキナセアと柚子を緑茶にブレンドすることで、免疫力向上が期待できます。</p>
                <p><strong>タグ:</strong> 免疫力, 風邪予防, エキナセア, 柚子, 緑茶</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


