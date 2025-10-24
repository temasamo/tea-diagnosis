import { supabase } from './supabase';
import { ArticleData, KnowledgeEntry } from './knowledge-base';

export class SupabaseKnowledgeBaseManager {
  // 記事を保存
  async saveArticle(article: ArticleData): Promise<string> {
    const { data, error } = await supabase
      .from('articles')
      .insert({
        title: article.title,
        content: article.content,
        category: article.category,
        tags: article.tags,
        publish_date: article.publishDate,
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving article:', error);
      throw error;
    }

    return data.id;
  }

  // 知識エントリを保存
  async saveKnowledgeEntries(entries: KnowledgeEntry[]): Promise<void> {
    if (entries.length === 0) return;

    const { error } = await supabase
      .from('knowledge_entries')
      .insert(entries.map(entry => ({
        condition: entry.condition,
        tea: entry.tea,
        blend: entry.blend,
        sweetener: entry.sweetener,
        snack: entry.snack,
        reason: entry.reason,
        source: entry.source,
      })));

    if (error) {
      console.error('Error saving knowledge entries:', error);
      throw error;
    }
  }

  // 全ての知識エントリを取得
  async getAllKnowledge(): Promise<KnowledgeEntry[]> {
    const { data, error } = await supabase
      .from('knowledge_entries')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching knowledge entries:', error);
      throw error;
    }

    return data.map(item => ({
      id: item.id,
      condition: item.condition,
      tea: item.tea,
      blend: item.blend,
      sweetener: item.sweetener,
      snack: item.snack,
      reason: item.reason,
      source: item.source,
    }));
  }

  // 関連する知識を検索
  async getRelevantKnowledge(answers: Record<string, string>): Promise<string> {
    const keywords = Object.values(answers).join(' ');
    
    const { data, error } = await supabase
      .from('knowledge_entries')
      .select('*')
      .or(`condition.ilike.%${keywords}%,tea.ilike.%${keywords}%,blend.ilike.%${keywords}%,sweetener.ilike.%${keywords}%,snack.ilike.%${keywords}%`)
      .limit(5);

    if (error) {
      console.error('Error searching knowledge entries:', error);
      return '';
    }

    if (data.length === 0) {
      // 関連する知識がない場合は、最新の3件を取得
      const { data: fallbackData } = await supabase
        .from('knowledge_entries')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3);
      
      if (fallbackData) {
        return fallbackData.map(entry =>
          `条件: ${entry.condition}\nお茶: ${entry.tea}\nブレンド: ${entry.blend}\n甘味料: ${entry.sweetener}\nお茶菓子: ${entry.snack}\n理由: ${entry.reason}\n出典: ${entry.source}`
        ).join('\n\n');
      }
      return '';
    }

    return data.map(entry =>
      `条件: ${entry.condition}\nお茶: ${entry.tea}\nブレンド: ${entry.blend}\n甘味料: ${entry.sweetener}\nお茶菓子: ${entry.snack}\n理由: ${entry.reason}\n出典: ${entry.source}`
    ).join('\n\n');
  }

  // 記事から知識を抽出して保存
  async extractAndSaveKnowledge(article: ArticleData): Promise<KnowledgeEntry[]> {
    try {
      // 記事を保存
      const articleId = await this.saveArticle(article);
      console.log(`Article saved with ID: ${articleId}`);
      
      // AIで知識を抽出（直接関数呼び出し）
      const { knowledgeBase } = await import('@/lib/knowledge-base');
      const result = await knowledgeBase.extractKnowledgeFromArticle(article);
      console.log('AI extraction result:', result);
      
      if (result.entries && result.entries.length > 0) {
        // 知識エントリを保存
        await this.saveKnowledgeEntries(result.entries);
        console.log(`Saved ${result.entries.length} knowledge entries`);
        return result.entries;
      }

      console.log('No knowledge entries extracted');
      return [];
    } catch (error) {
      console.error('Error extracting and saving knowledge:', error);
      throw error;
    }
  }

  // 統計情報を取得
  async getStats(): Promise<{
    articlesCount: number;
    knowledgeEntriesCount: number;
    lastUpdate: string | null;
  }> {
    const [articlesResult, knowledgeResult] = await Promise.all([
      supabase.from('articles').select('id', { count: 'exact' }),
      supabase.from('knowledge_entries').select('id', { count: 'exact' })
    ]);

    const lastUpdateResult = await supabase
      .from('knowledge_entries')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return {
      articlesCount: articlesResult.count || 0,
      knowledgeEntriesCount: knowledgeResult.count || 0,
      lastUpdate: lastUpdateResult.data?.created_at || null,
    };
  }

  // 全ての記事を取得
  async getAllArticles(): Promise<ArticleData[]> {
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching articles:', error);
      throw error;
    }

    return data || [];
  }

  // IDで記事を取得
  async getArticleById(id: string): Promise<ArticleData | null> {
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching article by ID:', error);
      return null;
    }

    return data;
  }

  // ソース（記事タイトル）で知識を取得
  async getKnowledgeBySource(source: string): Promise<KnowledgeEntry[]> {
    const { data, error } = await supabase
      .from('knowledge_entries')
      .select('*')
      .eq('source', source)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching knowledge by source:', error);
      throw error;
    }

    return data || [];
  }
}

export const supabaseKnowledgeBase = new SupabaseKnowledgeBaseManager();
