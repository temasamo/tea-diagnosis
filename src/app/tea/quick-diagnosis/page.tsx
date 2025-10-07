'use client';

import { useState, useEffect } from 'react';

interface ChatMessage {
  id: string;
  type: 'bot' | 'user';
  content: string;
  timestamp: Date;
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
    text: '今日の目標は？',
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

  useEffect(() => {
    // 初期メッセージ
    const initialMessage: ChatMessage = {
      id: '1',
      type: 'bot',
      content: 'こんにちは！🍵 あなたにぴったりのお茶を見つけるために、いくつか質問させていただきますね。',
      timestamp: new Date()
    };
    
    setMessages([initialMessage]);
    
    // 少し遅延してから最初の質問を表示
    setTimeout(() => {
      setCurrentQuestionIndex(0);
      const firstQuestion = questions[0];
      const firstQuestionMessage: ChatMessage = {
        id: '2',
        type: 'bot',
        content: firstQuestion.text,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, firstQuestionMessage]);
    }, 1500);
  }, []);

  const addMessage = (content: string, type: 'bot' | 'user') => {
    const newMessage: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      content,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const handleAnswer = (answer: string) => {
    const currentQuestion = questions[currentQuestionIndex];
    const newAnswers = { ...answers, [currentQuestion.id]: answer };
    setAnswers(newAnswers);

    // ユーザーの回答を追加
    addMessage(answer, 'user');

    // 次の質問または診断完了
    if (currentQuestionIndex < questions.length - 1) {
      setTimeout(() => {
        setCurrentQuestionIndex(prev => prev + 1);
        const nextQuestion = questions[currentQuestionIndex + 1];
        addMessage(nextQuestion.text, 'bot');
      }, 1500);
    } else {
      // 診断完了
      setTimeout(() => {
        setIsComplete(true);
        generateRecommendation(newAnswers);
      }, 1500);
    }
  };

  const generateRecommendation = async (userAnswers: Record<string, string>) => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/quick-diagnosis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ answers: userAnswers }),
      });

      if (response.ok) {
        const data = await response.json();
        setRecommendation(data.recommendation);
        addMessage('診断が完了しました！あなたにおすすめのお茶をご提案します。', 'bot');
        addMessage(`🍵 お茶: ${data.recommendation.tea}`, 'bot');
        addMessage(`🍯 甘味料: ${data.recommendation.sweetener}`, 'bot');
        addMessage(`🍪 お茶菓子: ${data.recommendation.snack}`, 'bot');
        addMessage(`💡 ${data.recommendation.reason}`, 'bot');
      } else {
        throw new Error('診断に失敗しました');
      }
    } catch (error) {
      console.error('Error:', error);
      addMessage('申し訳ございません。診断中にエラーが発生しました。', 'bot');
    } finally {
      setIsLoading(false);
    }
  };

  const resetDiagnosis = () => {
    setMessages([]);
    setCurrentQuestionIndex(0);
    setAnswers({});
    setIsComplete(false);
    setRecommendation(null);
    setIsLoading(false);
    
    // 初期メッセージを再表示
    setTimeout(() => {
      const initialMessage: ChatMessage = {
        id: '1',
        type: 'bot',
        content: 'こんにちは！🍵 あなたにぴったりのお茶を見つけるために、いくつか質問させていただきますね。',
        timestamp: new Date()
      };
      setMessages([initialMessage]);
    }, 100);
  };

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-4">
          <h1 className="text-2xl font-bold text-center text-green-800 mb-2">
            🍵 クイック診断チャット
          </h1>
          <p className="text-center text-gray-600 mb-6">
            あなたにぴったりのお茶を見つけましょう
          </p>

          <div className="h-96 overflow-y-auto border rounded-lg p-4 bg-gray-50 mb-4">
            {messages.map((message) => (
              <div
                key={message.id}
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
                  {message.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="text-center text-gray-500">
                診断中...
              </div>
            )}
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

          {isComplete && (
            <div className="text-center">
              <button
                onClick={resetDiagnosis}
                className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                もう一度診断する
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
