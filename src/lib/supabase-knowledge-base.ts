import { supabase, supabaseAdmin } from './supabase';
import { ArticleData, KnowledgeEntry } from './knowledge-base';

export class SupabaseKnowledgeBaseManager {
  // 記事を保存
  async saveArticle(article: ArticleData): Promise<string> {
    const { data, error } = await supabase
      .from('tea_articles')
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
      .from('tea_knowledge_entries')
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
    // 管理画面用なので、サービスロールキーを使用（RLSをバイパス）
    const { data, error } = await supabaseAdmin
      .from('tea_knowledge_entries')
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
      .from('tea_knowledge_entries')
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
        .from('tea_knowledge_entries')
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
    // 管理画面用なので、サービスロールキーを使用（RLSをバイパス）
    const [articlesResult, knowledgeResult] = await Promise.all([
      supabaseAdmin.from('tea_articles').select('id', { count: 'exact' }),
      supabaseAdmin.from('tea_knowledge_entries').select('id', { count: 'exact' })
    ]);

    const lastUpdateResult = await supabaseAdmin
      .from('tea_knowledge_entries')
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
  async getAllArticles(): Promise<any[]> {
    console.log('📚 getAllArticles: 開始');
    console.log('📚 Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + '...');
    
    // 管理画面用なので、サービスロールキーを使用（RLSをバイパス）
    const { data, error } = await supabaseAdmin
      .from('tea_articles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching articles:', error);
      console.error('❌ Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw error;
    }

    // データベースのカラム名（スネークケース）をそのまま返す
    // フロントエンドのArticleインターフェースがpublish_dateを期待しているため
    if (!data) {
      console.log('📚 getAllArticles: データがありません (data is null)');
      return [];
    }
    
    console.log(`📚 getAllArticles: ${data.length}件の記事を取得しました`);
    if (data.length > 0) {
      console.log('📚 最初の記事:', {
        id: data[0].id,
        title: data[0].title?.substring(0, 50)
      });
    }
    
    return data.map((row: any) => {
      // tagsが配列でない場合は、配列に変換
      let tags = row.tags || [];
      if (!Array.isArray(tags)) {
        // 文字列の場合はカンマで分割
        if (typeof tags === 'string') {
          tags = tags.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag);
        } else {
          tags = [];
        }
      }
      
      return {
        id: row.id,
        title: row.title,
        content: row.content,
        category: row.category || 'health',
        tags: tags,
        publish_date: row.publish_date || '',
        created_at: row.created_at,
        updated_at: row.updated_at
      };
    });
  }

  // IDで記事を取得
  async getArticleById(id: string): Promise<any | null> {
    // 管理画面用なので、サービスロールキーを使用（RLSをバイパス）
    const { data, error } = await supabaseAdmin
      .from('tea_articles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching article by ID:', error);
      return null;
    }

    if (!data) return null;

    // フロントエンドのArticleインターフェースがpublish_dateを期待しているため
    // tagsが配列でない場合は、配列に変換
    let tags = data.tags || [];
    if (!Array.isArray(tags)) {
      // 文字列の場合はカンマで分割
      if (typeof tags === 'string') {
        tags = tags.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag);
      } else {
        tags = [];
      }
    }
    
    return {
      id: data.id,
      title: data.title,
      content: data.content,
      category: data.category || 'health',
      tags: tags,
      publish_date: data.publish_date || '',
      created_at: data.created_at,
      updated_at: data.updated_at
    };
  }

  // ソース（記事タイトル）で知識を取得
  async getKnowledgeBySource(source: string): Promise<KnowledgeEntry[]> {
    // 管理画面用なので、サービスロールキーを使用（RLSをバイパス）
    const { data, error } = await supabaseAdmin
      .from('tea_knowledge_entries')
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
