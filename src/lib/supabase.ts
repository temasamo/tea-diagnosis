import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 管理画面用のサービスロールキーを使用するクライアント（RLSをバイパス）
export const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey
)

// データベースの型定義
export interface Database {
  public: {
    Tables: {
      tea_articles: {
        Row: {
          id: string
          title: string
          content: string
          category: string
          tags: string[]
          publish_date: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          content: string
          category: string
          tags: string[]
          publish_date: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          content?: string
          category?: string
          tags?: string[]
          publish_date?: string
          created_at?: string
          updated_at?: string
        }
      }
      tea_knowledge_entries: {
        Row: {
          id: string
          condition: string
          tea: string
          blend: string
          sweetener: string
          snack: string
          reason: string
          source: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          condition: string
          tea: string
          blend: string
          sweetener: string
          snack: string
          reason: string
          source: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          condition?: string
          tea?: string
          blend?: string
          sweetener?: string
          snack?: string
          reason?: string
          source?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}



