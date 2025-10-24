// 知識ベース管理システム
export interface ArticleData {
  title: string;
  content: string;
  category: string;
  tags: string[];
  publishDate: string;
}

export interface KnowledgeEntry {
  id: string;
  condition: string; // 症状・状況
  tea: string; // お茶の種類
  blend: string; // ブレンド素材
  sweetener: string; // 甘味料
  snack: string; // お茶菓子
  reason: string; // 理由
  source: string; // 出典記事
}

class KnowledgeBaseManager {
  private knowledgeEntries: KnowledgeEntry[] = [];
  private lastUpdate: Date | null = null;

  // 記事から知識を抽出（AI活用版）
  async extractKnowledgeFromArticle(article: ArticleData): Promise<{entries: KnowledgeEntry[], reason?: string}> {
    const entries: KnowledgeEntry[] = [];
    let reason = '';
    
    try {
      // AIを使用して記事から知識を抽出
      const aiExtractedKnowledge = await this.extractKnowledgeWithAI(article);
      entries.push(...aiExtractedKnowledge);
      
      if (entries.length === 0) {
        reason = 'AIが記事からお茶の提案に活用できる知識を見つけられませんでした。記事の内容が一般的すぎるか、お茶に関する具体的な情報が不足している可能性があります。';
      }
    } catch (error) {
      console.error('AI extraction failed, falling back to rule-based:', error);
      reason = 'AI処理に失敗したため、ルールベース抽出を試行しました。';
      
      // フォールバック: ルールベース抽出
      const conditions = this.extractConditions(article.content);
      const recommendations = this.extractRecommendations(article.content);
      
      if (conditions.length === 0) {
        reason += ' 記事から具体的な症状や状況を特定できませんでした。';
      }
      
      if (recommendations.length === 0) {
        reason += ' 記事からお茶の提案に活用できる情報を抽出できませんでした。';
      }
      
      for (const condition of conditions) {
        for (const recommendation of recommendations) {
          entries.push({
            id: `${article.title}-${condition}-${Date.now()}`,
            condition,
            tea: recommendation.tea || '緑茶',
            blend: recommendation.blend || '',
            sweetener: recommendation.sweetener || 'はちみつ',
            snack: recommendation.snack || '和菓子',
            reason: recommendation.reason || '',
            source: article.title
          });
        }
      }
      
      if (entries.length === 0) {
        reason += ' ルールベース抽出でも知識を抽出できませんでした。記事の内容をより具体的にお茶の効果や症状に言及するよう改善してください。';
      }
    }
    
    return { entries, reason: entries.length === 0 ? reason : undefined };
  }

  // AIを使用して記事から知識を抽出
  private async extractKnowledgeWithAI(article: ArticleData): Promise<KnowledgeEntry[]> {
    // サーバーサイドでは直接AI処理を実行
    const openai = new (await import('openai')).default({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `
あなたは茶ソムリエの専門家です。以下の記事から、お茶の提案に活用できる知識を抽出してください。

記事タイトル: ${article.title}
記事カテゴリ: ${article.category}
記事タグ: ${article.tags.join(', ')}

記事内容:
${article.content}

以下の形式で、この記事から抽出できる知識エントリを生成してください。複数の条件や提案がある場合は、それぞれを別々のエントリとして作成してください。

回答形式（JSON配列）:
[
  {
    "condition": "対象となる症状・状況（例：疲労、目の疲れ、免疫力低下など）",
    "tea": "おすすめのお茶の種類",
    "blend": "ブレンド素材（ハーブ、フルーツなど）",
    "sweetener": "おすすめの甘味料",
    "snack": "おすすめのお茶菓子",
    "reason": "なぜこの組み合わせが良いかの理由"
  }
]

注意事項:
- 記事に明記されていない推測は避け、記事の内容に基づいた提案のみを抽出してください
- 条件は具体的で分かりやすい表現にしてください
- お茶の種類は具体的に（例：「緑茶」「紅茶」「プーアル茶」など）
- ブレンド素材は記事で言及されているもののみ
- 甘味料とお茶菓子は記事で推奨されているもの、または一般的に相性の良いものを提案
- 理由は記事の内容に基づいて簡潔に説明

記事から知識を抽出できない場合は、空の配列 [] を返してください。
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "あなたは茶ソムリエの専門家です。記事からお茶の提案に活用できる知識を正確に抽出してください。"
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
    });

    const responseText = completion.choices[0]?.message?.content || '[]';
    
    try {
      const knowledgeEntries = JSON.parse(responseText);
      
      // バリデーション
      if (!Array.isArray(knowledgeEntries)) {
        throw new Error('Invalid response format');
      }
      
      // 各エントリの必須フィールドをチェック
      const validEntries = knowledgeEntries.filter(entry => 
        entry.condition && 
        entry.tea && 
        entry.sweetener && 
        entry.snack && 
        entry.reason
      );
      
      return validEntries.map(entry => ({
        ...entry,
        id: `${article.title}-${entry.condition}-${Date.now()}`,
        source: article.title
      }));
      
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      throw new Error('Failed to parse AI response');
    }
  }

  // 記事内容から条件を抽出
  private extractConditions(content: string): string[] {
    const conditions: string[] = [];
    
    // 疲労関連
    if (content.includes('疲れ') || content.includes('疲労')) {
      conditions.push('疲労');
    }
    
    // 免疫力関連
    if (content.includes('免疫力') || content.includes('風邪')) {
      conditions.push('免疫力低下');
    }
    
    // 目の疲れ
    if (content.includes('目の疲れ') || content.includes('デジタル')) {
      conditions.push('目の疲れ');
    }
    
    // 腸活
    if (content.includes('腸') || content.includes('消化')) {
      conditions.push('腸の不調');
    }
    
    // 二日酔い
    if (content.includes('二日酔い') || content.includes('飲みすぎ')) {
      conditions.push('二日酔い');
    }
    
    // 脂ケア
    if (content.includes('脂') || content.includes('和牛') || content.includes('ラーメン')) {
      conditions.push('脂っこい食事後');
    }
    
    // 集中力
    if (content.includes('集中') || content.includes('仕事効率')) {
      conditions.push('集中力不足');
    }
    
    // 血圧・血糖値
    if (content.includes('血圧') || content.includes('血糖値')) {
      conditions.push('血圧・血糖値の心配');
    }
    
    // 睡眠
    if (content.includes('睡眠') || content.includes('夜')) {
      conditions.push('睡眠の質');
    }
    
    // ストレス
    if (content.includes('ストレス') || content.includes('メンタル')) {
      conditions.push('ストレス');
    }
    
    return conditions;
  }

  // 記事内容から提案を抽出
  private extractRecommendations(content: string): Array<{
    tea?: string;
    blend?: string;
    sweetener?: string;
    snack?: string;
    reason?: string;
  }> {
    const recommendations: Array<{
      tea?: string;
      blend?: string;
      sweetener?: string;
      snack?: string;
      reason?: string;
    }> = [];

    // お茶の種類を抽出
    const teaTypes = this.extractTeaTypes(content);
    const blends = this.extractBlends(content);
    const sweeteners = this.extractSweeteners(content);
    const snacks = this.extractSnacks(content);

    if (teaTypes.length > 0 || blends.length > 0) {
      recommendations.push({
        tea: teaTypes.join(' + '),
        blend: blends.join(' + '),
        sweetener: sweeteners.join('、'),
        snack: snacks.join('、'),
        reason: this.extractReason(content)
      });
    }

    return recommendations;
  }

  private extractTeaTypes(content: string): string[] {
    const teaTypes: string[] = [];
    const teaKeywords = ['緑茶', '紅茶', 'プーアル茶', '黒豆茶', '日本茶', 'ハーブティー'];
    
    teaKeywords.forEach(tea => {
      if (content.includes(tea)) {
        teaTypes.push(tea);
      }
    });
    
    return teaTypes;
  }

  private extractBlends(content: string): string[] {
    const blends: string[] = [];
    const blendKeywords = ['エキナセア', '柚子', 'レモン', 'ブルーベリー', 'カシス', 'ハーブ'];
    
    blendKeywords.forEach(blend => {
      if (content.includes(blend)) {
        blends.push(blend);
      }
    });
    
    return blends;
  }

  private extractSweeteners(content: string): string[] {
    const sweeteners: string[] = [];
    const sweetenerKeywords = ['はちみつ', '黒糖', 'ステビア', '甘味料'];
    
    sweetenerKeywords.forEach(sweetener => {
      if (content.includes(sweetener)) {
        sweeteners.push(sweetener);
      }
    });
    
    return sweeteners;
  }

  private extractSnacks(content: string): string[] {
    const snacks: string[] = [];
    const snackKeywords = ['和菓子', 'ようかん', '大福', 'ナッツ', 'チョコレート', 'お茶菓子'];
    
    snackKeywords.forEach(snack => {
      if (content.includes(snack)) {
        snacks.push(snack);
      }
    });
    
    return snacks;
  }

  private extractReason(content: string): string {
    // 記事から理由を抽出（簡易版）
    if (content.includes('疲労回復')) return '疲労回復効果';
    if (content.includes('免疫力')) return '免疫力向上効果';
    if (content.includes('目の疲れ')) return '目の疲労軽減効果';
    if (content.includes('腸')) return '腸内環境改善効果';
    if (content.includes('集中')) return '集中力向上効果';
    if (content.includes('リラックス')) return 'リラックス効果';
    return '健康効果が期待できる組み合わせ';
  }

  // 知識ベースに追加
  addKnowledge(entries: KnowledgeEntry[]): void {
    this.knowledgeEntries.push(...entries);
    this.lastUpdate = new Date();
  }

  // 条件に基づいて提案を検索
  findRecommendations(condition: string): KnowledgeEntry[] {
    return this.knowledgeEntries.filter(entry => 
      entry.condition.includes(condition) || 
      condition.includes(entry.condition)
    );
  }

  // 全知識を取得
  getAllKnowledge(): KnowledgeEntry[] {
    return this.knowledgeEntries;
  }

  // 知識ベースをリセット
  reset(): void {
    this.knowledgeEntries = [];
    this.lastUpdate = null;
  }

  // 最終更新日時を取得
  getLastUpdate(): Date | null {
    return this.lastUpdate;
  }
}

export const knowledgeBase = new KnowledgeBaseManager();
