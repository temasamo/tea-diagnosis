'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';

interface ChatMessage {
  id: string;
  type: 'bot' | 'user';
  content: string;
  timestamp: Date;
  url?: string;
}

interface Question {
  id: string;
  text: string;
  options: string[];
  category: 'mood' | 'health' | 'time' | 'preference' | 'situation' | 'goal';
}

interface Recommendation {
  tea: string;
  sweetener: string;
  snack: string;
  reason: string;
}

const questions: Question[] = [
  {
    id: 'mood',
    text: '今の気分はいかがですか？',
    options: ['疲れている', 'リラックスしたい', '集中したい', '元気になりたい', '落ち着きたい'],
    category: 'mood'
  },
  {
    id: 'health',
    text: '最近気になる体調はありますか？',
    options: ['特にない', '目の疲れ', '胃の調子', '冷え性', 'ストレス', '風邪気味'],
    category: 'health'
  },
  {
    id: 'time',
    text: 'いつお茶を飲みますか？',
    options: ['朝', '昼', '夕方', '夜', 'いつでも'],
    category: 'time'
  },
  {
    id: 'preference',
    text: 'お茶の好みは？',
    options: ['緑茶', '紅茶', 'ハーブティー', 'ブレンドティー', '特にこだわりなし'],
    category: 'preference'
  },
  {
    id: 'situation',
    text: 'どんな場面で飲みますか？',
    options: ['一人の時間', '友人とのお茶会', '仕事中', '読書中', '家族団らん'],
    category: 'situation'
  },
  {
    id: 'goal',
    text: '今日は私からの提案にどんなことを期待されてますか？',
    options: ['リフレッシュ', '集中力アップ', 'リラックス', '健康維持', '美味しいお茶を楽しむ'],
    category: 'goal'
  }
];

export default function QuickDiagnosisPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isComplete, setIsComplete] = useState(false);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showShopOptions, setShowShopOptions] = useState(false);
  const [selectedShop, setSelectedShop] = useState<string | null>(null);
  const [showRecommendationConfirmation, setShowRecommendationConfirmation] = useState(false);
  const [showProductConfirmation, setShowProductConfirmation] = useState(false);
  const [pendingRecommendation, setPendingRecommendation] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 初期メッセージ
    const initialMessage: ChatMessage = {
      id: `${Date.now()}-initial`,
      type: 'bot',
      content: 'こんにちは！🍵 あなたにぴったりのお茶を見つけるために、いくつか質問させていただきますね。',
      timestamp: new Date()
    };
    
    setMessages([initialMessage]);
    
    // 少し遅延してから最初の質問を表示
    setTimeout(() => {
      setCurrentQuestionIndex(0);
      // 質問の表示は useEffect で自動的に行われる
    }, 1500);
  }, []);

  const addMessage = (content: string, type: 'bot' | 'user', url?: string): string => {
    const messageId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newMessage: ChatMessage = {
      id: messageId,
      type,
      content,
      timestamp: new Date(),
      url
    };
    setMessages(prev => [...prev, newMessage]);
    return messageId;
  };

  // チャットの自動スクロール
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // メッセージが追加された時に自動スクロール
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // currentQuestionIndexが変更された時に質問を表示（タイピングアニメーション付き）
  useEffect(() => {
    if (currentQuestionIndex >= 0 && currentQuestionIndex < questions.length) {
      const question = questions[currentQuestionIndex];
      // タイピング中を表示
      setIsTyping(true);
      
      // 「・・・」を表示してから質問を表示（1.5秒後に質問を表示）
      setTimeout(() => {
        setIsTyping(false);
        const questionMessage: ChatMessage = {
          id: `${Date.now()}-question-${currentQuestionIndex}`,
          type: 'bot',
          content: question.text,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, questionMessage]);
      }, 1500); // 1.5秒後に質問を表示（より見やすく）
    }
  }, [currentQuestionIndex]);

  const handleAnswer = (answer: string) => {
    const currentQuestion = questions[currentQuestionIndex];
    const newAnswers = { ...answers, [currentQuestion.id]: answer };
    setAnswers(newAnswers);

    // ユーザーの回答を追加
    addMessage(answer, 'user');

    // 相槌と次の質問または診断完了
    if (currentQuestionIndex < questions.length - 1) {
      setTimeout(() => {
        // 相槌を追加
        const aizuchi = getAizuchi(answer, currentQuestionIndex);
        addMessage(aizuchi, 'bot');
        
        // 少し遅延してから次の質問
        setTimeout(() => {
          const nextIndex = currentQuestionIndex + 1;
          setCurrentQuestionIndex(nextIndex);
          // 質問の表示は setCurrentQuestionIndex の更新後に自動的に行われるため、
          // ここでは質問を手動で追加しない
        }, 1000);
      }, 1500);
    } else {
      // 診断完了
      setTimeout(() => {
        const finalAizuchi = getFinalAizuchi(answer);
        addMessage(finalAizuchi, 'bot');
        
        setTimeout(() => {
          setIsComplete(true);
          generateRecommendation(newAnswers);
        }, 1000);
      }, 1500);
    }
  };

  // 相槌を生成する関数
  const getAizuchi = (answer: string, _questionIndex: number): string => {
    // ユーザーの回答内容に応じた適切な相槌
    let aizuchi = '';
    
    // 疲労・体調に関する回答
    if (answer.includes('疲れ') || answer.includes('だる') || answer.includes('しんど')) {
      aizuchi = 'お疲れ様です。疲れている時こそ、体に優しいお茶がおすすめです。';
    } else if (answer.includes('リラックス') || answer.includes('癒し') || answer.includes('落ち着き')) {
      aizuchi = 'そうなんですね。リラックスしたい気持ち、よく分かります。';
    } else if (answer.includes('集中') || answer.includes('仕事') || answer.includes('勉強')) {
      aizuchi = 'なるほど！集中したい時ですね。';
    } else if (answer.includes('元気') || answer.includes('活力') || answer.includes('エネルギ')) {
      aizuchi = '元気になりたい気持ち、分かります。';
    } else if (answer.includes('健康') || answer.includes('体調') || answer.includes('免疫力')) {
      aizuchi = '健康を意識されているんですね。';
    } else if (answer.includes('美味しい') || answer.includes('楽しみ') || answer.includes('味')) {
      aizuchi = 'お茶を楽しみたい気持ち、素敵ですね。';
    } else if (answer.includes('特に') || answer.includes('こだわり') || answer.includes('ない')) {
      aizuchi = '分かりました。';
    } else if (answer.includes('朝') || answer.includes('昼') || answer.includes('夜')) {
      aizuchi = `${answer}の時間帯ですね。`;
    } else if (answer.includes('目の疲れ') || answer.includes('眼精疲労')) {
      aizuchi = '目の疲れ、お辛いですね。目に優しいお茶をご提案します。';
    } else if (answer.includes('胃') || answer.includes('消化')) {
      aizuchi = '胃の調子が気になる時は、胃に優しいお茶がおすすめです。';
    } else if (answer.includes('冷え') || answer.includes('寒')) {
      aizuchi = '冷え性でお辛いですね。体を温めるお茶をご提案します。';
    } else if (answer.includes('ストレス') || answer.includes('イライラ')) {
      aizuchi = 'ストレスを感じている時は、心を落ち着かせるお茶がおすすめです。';
    } else if (answer.includes('風邪') || answer.includes('体調不良')) {
      aizuchi = '体調が優れない時は、免疫力をサポートするお茶がおすすめです。';
    } else {
      // デフォルトの相槌（より自然な表現に変更）
      const defaultAizuchi = [
        'なるほど！',
        '分かりました！',
        'そうなんですね。',
        '承知いたしました。'
      ];
      aizuchi = defaultAizuchi[Math.floor(Math.random() * defaultAizuchi.length)];
    }
    
    const transitions = [
      'それでは、',
      'では、',
      '次に、',
      '続いて、',
      'もう一つ、'
    ];
    
    const randomTransition = transitions[Math.floor(Math.random() * transitions.length)];
    
    return `${aizuchi} ${randomTransition}`;
  };

  // 最後の相槌を生成する関数
  const getFinalAizuchi = (_answer: string): string => {
    const finalAizuchiOptions = [
      'ありがとうございます！',
      '分かりました！',
      '承知いたしました！',
      'なるほど！',
      'そうですね！'
    ];
    
    const randomFinalAizuchi = finalAizuchiOptions[Math.floor(Math.random() * finalAizuchiOptions.length)];
    return `${randomFinalAizuchi} それでは、あなたにぴったりのお茶をご提案させていただきますね！`;
  };

  const generateRecommendation = async (userAnswers: Record<string, string>) => {
    console.log('🚀 generateRecommendation開始:', { answersCount: Object.keys(userAnswers).length });
    setIsLoading(true);
    
    try {
      console.log('📡 API呼び出し開始: /api/quick-diagnosis');
      const response = await fetch('/api/quick-diagnosis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ answers: userAnswers }),
      });

      console.log('📥 APIレスポンス受信:', { 
        ok: response.ok, 
        status: response.status, 
        statusText: response.statusText 
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ APIレスポンス成功:', data);
        
        // デバッグ情報をコンソールに出力（常に表示）
        console.log('🔍 クイック診断APIレスポンス:', {
          matches: data.matches,
          articlesCount: data.articles?.length || 0,
          hasRecommendation: !!data.aiRecommendation,
          condition: data.condition, // 診断文を表示
          debug: data.debug || 'デバッグ情報なし'
        });
        
        // 診断文をコンソールに表示
        if (data.condition) {
          console.log('📝 生成された診断文:', data.condition);
        }
        
        if (data.debug) {
          console.log('📊 RAG検索詳細:', {
            hasArticles: data.debug.hasArticles,
            searchError: data.debug.searchError,
            rpcUsed: data.debug.rpcUsed
          });
          
          if (data.debug.searchError) {
            console.warn('⚠️ RAG検索でエラーが発生しました:', data.debug.searchError);
          } else if (data.matches === 0) {
            console.warn('⚠️ 関連記事が見つかりませんでした（matches: 0）');
          } else {
            console.log('✅ RAG検索成功:', `記事数: ${data.matches}`);
          }
        }
        
        // AI推奨から商品名を抽出してrecommendationを設定
        const aiText = data.aiRecommendation.toLowerCase();
        let teaName = "おすすめのお茶";
        let sweetenerName = "はちみつ";
        let snackName = "和菓子";
        
        // お茶の種類を抽出（より具体的な商品名を優先）
        if (aiText.includes('カモミール')) teaName = "カモミールティー";
        else if (aiText.includes('ペパーミント')) teaName = "ペパーミントティー";
        else if (aiText.includes('ローズヒップ')) teaName = "ローズヒップティー";
        else if (aiText.includes('ジャスミン')) teaName = "ジャスミンティー";
        else if (aiText.includes('ゴーヤ茶')) teaName = "ゴーヤ茶";
        else if (aiText.includes('ほうじ茶')) teaName = "ほうじ茶";
        else if (aiText.includes('抹茶')) teaName = "抹茶";
        else if (aiText.includes('緑茶')) teaName = "緑茶";
        else if (aiText.includes('紅茶')) teaName = "紅茶";
        else if (aiText.includes('ハーブ')) teaName = "ハーブティー";
        
        // 甘味料を抽出（より具体的な商品名を優先）
        if (aiText.includes('はちみつ')) sweetenerName = "はちみつ";
        else if (aiText.includes('ハチミツ')) sweetenerName = "はちみつ";
        else if (aiText.includes('和三盆')) sweetenerName = "和三盆糖";
        else if (aiText.includes('黒糖')) sweetenerName = "黒糖";
        else if (aiText.includes('砂糖')) sweetenerName = "砂糖";
        
        // お茶菓子を抽出（より具体的な商品名を優先）
        if (aiText.includes('どら焼き')) snackName = "どら焼き";
        else if (aiText.includes('和三盆のどら焼き')) snackName = "和三盆のどら焼き";
        else if (aiText.includes('和菓子')) snackName = "和菓子";
        else if (aiText.includes('洋菓子')) snackName = "洋菓子";
        else if (aiText.includes('クッキー')) snackName = "クッキー";
        
        const recommendation = {
          tea: teaName,
          sweetener: sweetenerName,
          snack: snackName,
          reason: data.aiRecommendation
        };
        setRecommendation(recommendation);
        setPendingRecommendation(data.aiRecommendation);
        
        // 診断完了メッセージと確認
        setTimeout(() => {
          addMessage('診断が完了しました。AIがあなたにぴったりのお茶をご提案してよろしいですか？', 'bot');
          setShowRecommendationConfirmation(true);
        }, 1000);
        
        // 診断完了フラグを設定
        setIsComplete(true);
      } else {
        // APIエラーの詳細をログに出力
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ APIエラー:', {
          status: response.status,
          statusText: response.statusText,
          errorData: errorData
        });
        throw new Error(`診断に失敗しました: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('❌ 診断エラー:', error);
      addMessage('申し訳ございません。診断中にエラーが発生しました。', 'bot');
    } finally {
      setIsLoading(false);
    }
  };

  // AI推奨の確認ハンドラー
  const handleRecommendationConfirmation = (confirmed: boolean) => {
    if (confirmed) {
      addMessage('はい', 'user');
      setShowRecommendationConfirmation(false);
      
      if (pendingRecommendation) {
        setTimeout(() => {
          const aiRecommendationMessageId = addMessage(`🤖 AIからのおすすめ: ${pendingRecommendation}`, 'bot');
          // AIからのおすすめメッセージの位置にスクロール
          setTimeout(() => {
            const messageElement = document.querySelector(`[data-message-id="${aiRecommendationMessageId}"]`);
            if (messageElement) {
              const chatContainer = messageElement.closest('.overflow-y-auto');
              if (chatContainer) {
                const elementTop = (messageElement as HTMLElement).offsetTop;
                const elementHeight = (messageElement as HTMLElement).offsetHeight;
                const containerHeight = chatContainer.clientHeight;
                const scrollPosition = elementTop - containerHeight / 2 + elementHeight / 2;
                chatContainer.scrollTo({
                  top: scrollPosition,
                  behavior: 'smooth'
                });
              } else {
                messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }
          }, 300);
        }, 500);
        
        // AI推奨コメント後に商品紹介の確認を表示
        setTimeout(() => {
          addMessage('おすすめ商品をまとめてご紹介させていただいてよろしいですか？', 'bot');
          setShowProductConfirmation(true);
        }, 2000);
      }
    } else {
      addMessage('いいえ', 'user');
      addMessage('ありがとうございます。またお気軽にご相談ください。', 'bot');
      setShowRecommendationConfirmation(false);
    }
  };

  // おすすめ商品の確認ハンドラー
  const handleProductConfirmation = (confirmed: boolean) => {
    if (confirmed) {
      addMessage('はい', 'user');
      setShowProductConfirmation(false);
      
      if (recommendation) {
        setTimeout(() => {
          addMessage('🛒 おすすめ商品：', 'bot');
          addMessage(`・お茶: ${recommendation.tea}`, 'bot');
          addMessage(`・甘味料: ${recommendation.sweetener}`, 'bot');
          addMessage(`・お茶菓子: ${recommendation.snack}`, 'bot');
        }, 500);
        
        // ショップ確認メッセージを追加
        setTimeout(() => {
          addMessage('これらの商品を購入したい場合は、ご希望のネットショップへお繋げすることができます。いかがしますか？', 'bot');
          setShowShopOptions(true);
        }, 2000);
      }
    } else {
      addMessage('いいえ', 'user');
      addMessage('ありがとうございます。またお気軽にご相談ください。', 'bot');
      setShowProductConfirmation(false);
    }
  };

  const resetDiagnosis = () => {
    setMessages([]);
    setCurrentQuestionIndex(0);
    setAnswers({});
    setIsComplete(false);
    setRecommendation(null);
    setIsLoading(false);
    setShowShopOptions(false);
    setSelectedShop(null);
    setShowRecommendationConfirmation(false);
    setShowProductConfirmation(false);
    setPendingRecommendation(null);
    
    // 初期メッセージを再表示
    setTimeout(() => {
      const initialMessage: ChatMessage = {
        id: `${Date.now()}-reset-initial`,
        type: 'bot',
        content: 'こんにちは！🍵 あなたにぴったりのお茶を見つけるために、いくつか質問させていただきますね。',
        timestamp: new Date()
      };
      setMessages([initialMessage]);
    }, 100);
  };

  // ショップ選択ハンドラー
  const handleShopSelection = (shop: string) => {
    if (shop === 'no') {
      addMessage('いらない', 'user');
      addMessage('ありがとうございます！またお気軽にご相談ください。', 'bot');
      setShowShopOptions(false);
      return;
    }

    if (shop === 'yes') {
      addMessage('見たい', 'user');
      addMessage('どちらのモールがよろしいですか？', 'bot');
      setSelectedShop('selecting');
      return;
    }

    // モール選択
    if (selectedShop === 'selecting') {
      addMessage(shop, 'user');
      generateAffiliateLinks(shop);
    }
  };

  // アフィリエイトリンク生成
  const generateAffiliateLinks = (shop: string) => {
    console.log('generateAffiliateLinks called with shop:', shop);
    console.log('recommendation:', recommendation);
    
    if (!recommendation) {
      console.log('No recommendation available, using fallback');
      // フォールバック用の推奨データ
      const fallbackRecommendation = {
        tea: "おすすめのお茶",
        sweetener: "はちみつ",
        snack: "和菓子"
      };
      generateLinksWithRecommendation(shop, fallbackRecommendation);
      return;
    }
    
    generateLinksWithRecommendation(shop, recommendation);
  };

  const generateLinksWithRecommendation = (shop: string, rec: { tea: string; sweetener: string; snack: string }) => {
    const searchKeywords = {
      tea: rec.tea,
      sweetener: rec.sweetener,
      snack: rec.snack
    };

    let links: { name: string; url: string }[] = [];

    switch (shop) {
      case 'Amazon':
        links = [
          {
            name: `${searchKeywords.tea}をAmazonで探す`,
            url: `https://www.amazon.co.jp/s?k=${encodeURIComponent(searchKeywords.tea)}&tag=temasamo1220d-22`
          },
          {
            name: `${searchKeywords.sweetener}をAmazonで探す`,
            url: `https://www.amazon.co.jp/s?k=${encodeURIComponent(searchKeywords.sweetener)}&tag=temasamo1220d-22`
          },
          {
            name: `${searchKeywords.snack}をAmazonで探す`,
            url: `https://www.amazon.co.jp/s?k=${encodeURIComponent(searchKeywords.snack)}&tag=temasamo1220d-22`
          }
        ];
        break;

      case '楽天':
        const rakutenBaseUrl = 'https://hb.afl.rakuten.co.jp/hgc/4c5e3919.1c76af65.4c5e391a.0caa9dc5/?pc=';
        links = [
          {
            name: `${searchKeywords.tea}を楽天で探す`,
            url: `${rakutenBaseUrl}https%3A%2F%2Fsearch.rakuten.co.jp%2Fsearch%2Fmall%2F${encodeURIComponent(searchKeywords.tea)}%2F`
          },
          {
            name: `${searchKeywords.sweetener}を楽天で探す`,
            url: `${rakutenBaseUrl}https%3A%2F%2Fsearch.rakuten.co.jp%2Fsearch%2Fmall%2F${encodeURIComponent(searchKeywords.sweetener)}%2F`
          },
          {
            name: `${searchKeywords.snack}を楽天で探す`,
            url: `${rakutenBaseUrl}https%3A%2F%2Fsearch.rakuten.co.jp%2Fsearch%2Fmall%2F${encodeURIComponent(searchKeywords.snack)}%2F`
          }
        ];
        break;

      case 'Yahooショップ':
        const yahooBaseUrl = 'https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=3751180&pid=892078463&vc_url=';
        links = [
          {
            name: `${searchKeywords.tea}をYahooショップで探す`,
            url: `${yahooBaseUrl}https%3A%2F%2Fshopping.yahoo.co.jp%2Fsearch%2F%3Fp%3D${encodeURIComponent(searchKeywords.tea)}`
          },
          {
            name: `${searchKeywords.sweetener}をYahooショップで探す`,
            url: `${yahooBaseUrl}https%3A%2F%2Fshopping.yahoo.co.jp%2Fsearch%2F%3Fp%3D${encodeURIComponent(searchKeywords.sweetener)}`
          },
          {
            name: `${searchKeywords.snack}をYahooショップで探す`,
            url: `${yahooBaseUrl}https%3A%2F%2Fshopping.yahoo.co.jp%2Fsearch%2F%3Fp%3D${encodeURIComponent(searchKeywords.snack)}`
          }
        ];
        break;
    }

    // リンクをメッセージとして追加
    addMessage(`${shop}での検索リンクをご用意しました！`, 'bot');
    links.forEach(link => {
      addMessage(`🔗 ${link.name}`, 'bot', link.url);
    });

    setShowShopOptions(false);
    setSelectedShop(null);
  };

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-4">
          <div className="relative flex items-center justify-center mb-1 py-8">
            {/* 背景画像 */}
            <div className="absolute inset-0 flex items-center justify-center">
              <Image
                src="/teaAI.png"
                alt="茶ソムリエ"
                width={200}
                height={200}
                className="object-contain"
                priority
              />
            </div>
            {/* 見出しテキスト（前面に表示） */}
            <h1 className="relative text-2xl font-bold text-green-800 z-10">
              🍵 クイック診断チャット
            </h1>
          </div>
          <p className="text-center text-gray-600 mb-6">
            あなたにぴったりのお茶を見つけましょう
          </p>

          <div className="h-96 overflow-y-auto border rounded-lg p-4 bg-gray-50 mb-4">
            {messages.map((message) => (
              <div
                key={message.id}
                data-message-id={message.id}
                className={`mb-4 ${
                  message.type === 'user' ? 'text-right' : 'text-left'
                }`}
              >
                <div
                  className={`inline-block max-w-xs p-3 rounded-lg ${
                    message.type === 'user'
                      ? 'bg-green-500 text-white'
                      : 'bg-green-100 text-gray-800'
                  }`}
                >
                  {message.url ? (
                    <a
                      href={message.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      {message.content}
                    </a>
                  ) : (
                    message.content
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="text-center text-gray-500">
                <span className="animate-pulse">診断中・・・数秒お待ちください</span>
              </div>
            )}
            {isTyping && (
              <div className="text-left mb-4">
                <div className="inline-block max-w-xs p-3 rounded-lg bg-green-100 text-gray-800">
                  <span className="text-lg font-medium flex items-center gap-1">
                    <span className="typing-dot">・</span>
                    <span className="typing-dot">・</span>
                    <span className="typing-dot">・</span>
                  </span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {!isComplete && currentQuestionIndex >= 0 && currentQuestion && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600 mb-3">
                質問 {currentQuestionIndex + 1} / {questions.length}
              </p>
              <div className="grid gap-2">
                {currentQuestion.options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => handleAnswer(option)}
                    className="w-full p-3 text-left bg-white border border-green-200 rounded-lg hover:bg-green-50 hover:border-green-300 transition-colors text-gray-800 font-medium"
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!isComplete && currentQuestionIndex < 0 && (
            <div className="text-center text-gray-500">
              質問を準備中...
            </div>
          )}

          {/* AI推奨の確認UI */}
          {showRecommendationConfirmation && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <div className="space-y-2">
                <button
                  onClick={() => handleRecommendationConfirmation(true)}
                  className="w-full p-3 text-left bg-white border border-blue-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors text-gray-800 font-medium"
                >
                  はい
                </button>
                <button
                  onClick={() => handleRecommendationConfirmation(false)}
                  className="w-full p-3 text-left bg-white border border-blue-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors text-gray-800 font-medium"
                >
                  いいえ
                </button>
              </div>
              {/* 「もう一度診断する」ボタンを「はい、いいえ」の下に配置 */}
              {isComplete && (
                <div className="text-center mt-4">
                  <button
                    onClick={resetDiagnosis}
                    className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                  >
                    もう一度診断する
                  </button>
                </div>
              )}
            </div>
          )}

          {/* おすすめ商品の確認UI */}
          {showProductConfirmation && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <div className="space-y-2">
                <button
                  onClick={() => handleProductConfirmation(true)}
                  className="w-full p-3 text-left bg-white border border-blue-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors text-gray-800 font-medium"
                >
                  はい
                </button>
                <button
                  onClick={() => handleProductConfirmation(false)}
                  className="w-full p-3 text-left bg-white border border-blue-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors text-gray-800 font-medium"
                >
                  いいえ
                </button>
              </div>
              {/* 「もう一度診断する」ボタンを「はい、いいえ」の下に配置 */}
              {isComplete && (
                <div className="text-center mt-4">
                  <button
                    onClick={resetDiagnosis}
                    className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                  >
                    もう一度診断する
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 「もう一度診断する」ボタン（確認UIが表示されていない場合のみ） */}
          {isComplete && !showRecommendationConfirmation && !showProductConfirmation && (
            <div className="text-center mt-4">
              <button
                onClick={resetDiagnosis}
                className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                もう一度診断する
              </button>
            </div>
          )}

          {/* ショップ選択UI */}
          {showShopOptions && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <div className="space-y-2">
                <button
                  onClick={() => handleShopSelection('yes')}
                  className="w-full p-3 text-left bg-white border border-blue-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors text-gray-800 font-medium"
                >
                  見たい
                </button>
                <button
                  onClick={() => handleShopSelection('no')}
                  className="w-full p-3 text-left bg-white border border-blue-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors text-gray-800 font-medium"
                >
                  いらない
                </button>
              </div>
            </div>
          )}

          {/* モール選択UI */}
          {selectedShop === 'selecting' && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <div className="space-y-2">
                <button
                  onClick={() => handleShopSelection('Amazon')}
                  className="w-full p-3 text-left bg-white border border-blue-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors text-gray-800 font-medium"
                >
                  Amazon
                </button>
                <button
                  onClick={() => handleShopSelection('楽天')}
                  className="w-full p-3 text-left bg-white border border-blue-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors text-gray-800 font-medium"
                >
                  楽天
                </button>
                <button
                  onClick={() => handleShopSelection('Yahooショップ')}
                  className="w-full p-3 text-left bg-white border border-blue-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors text-gray-800 font-medium"
                >
                  Yahooショップ
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
