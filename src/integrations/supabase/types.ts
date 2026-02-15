export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      animal_pens: {
        Row: {
          animal_count: number
          animal_type: string | null
          created_at: string
          id: string
          last_collected_at: string | null
          position: number
          user_id: string
        }
        Insert: {
          animal_count?: number
          animal_type?: string | null
          created_at?: string
          id?: string
          last_collected_at?: string | null
          position: number
          user_id: string
        }
        Update: {
          animal_count?: number
          animal_type?: string | null
          created_at?: string
          id?: string
          last_collected_at?: string | null
          position?: number
          user_id?: string
        }
        Relationships: []
      }
      farm_plots: {
        Row: {
          created_at: string
          id: string
          last_harvested_at: string | null
          plant_type: string | null
          planted_at: string | null
          position: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_harvested_at?: string | null
          plant_type?: string | null
          planted_at?: string | null
          position: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_harvested_at?: string | null
          plant_type?: string | null
          planted_at?: string | null
          position?: number
          user_id?: string
        }
        Relationships: []
      }
      market_listings: {
        Row: {
          buyer_id: string | null
          created_at: string
          id: string
          item_type: string
          price_per_unit: number
          quantity: number
          seller_id: string
          status: string
        }
        Insert: {
          buyer_id?: string | null
          created_at?: string
          id?: string
          item_type: string
          price_per_unit: number
          quantity?: number
          seller_id: string
          status?: string
        }
        Update: {
          buyer_id?: string | null
          created_at?: string
          id?: string
          item_type?: string
          price_per_unit?: number
          quantity?: number
          seller_id?: string
          status?: string
        }
        Relationships: []
      }
      orchard_trees: {
        Row: {
          created_at: string
          id: string
          last_harvested_at: string | null
          planted_at: string | null
          position: number
          tree_type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_harvested_at?: string | null
          planted_at?: string | null
          position: number
          tree_type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_harvested_at?: string | null
          planted_at?: string | null
          position?: number
          tree_type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pantry_items: {
        Row: {
          created_at: string
          id: string
          item_type: string
          quantity: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_type: string
          quantity?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_type?: string
          quantity?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          balance: number
          created_at: string
          display_name: string | null
          id: string
          reputation: number
          reviews_count: number
          stitchcoins: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          display_name?: string | null
          id?: string
          reputation?: number
          reviews_count?: number
          stitchcoins?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          display_name?: string | null
          id?: string
          reputation?: number
          reviews_count?: number
          stitchcoins?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          created_at: string
          decision: boolean
          id: string
          reviewer_id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          decision: boolean
          id?: string
          reviewer_id: string
          task_id: string
        }
        Update: {
          created_at?: string
          decision?: boolean
          id?: string
          reviewer_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "stitch_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      stitch_tasks: {
        Row: {
          approvals_count: number
          code_word: string
          created_at: string
          id: string
          photo_after_url: string | null
          photo_before_url: string | null
          rejections_count: number
          reward_amount: number
          status: string
          stitch_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          approvals_count?: number
          code_word: string
          created_at?: string
          id?: string
          photo_after_url?: string | null
          photo_before_url?: string | null
          rejections_count?: number
          reward_amount?: number
          status?: string
          stitch_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          approvals_count?: number
          code_word?: string
          created_at?: string
          id?: string
          photo_after_url?: string | null
          photo_before_url?: string | null
          rejections_count?: number
          reward_amount?: number
          status?: string
          stitch_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auto_harvest_all: { Args: never; Returns: undefined }
      buy_market_listing: { Args: { p_listing_id: string }; Returns: undefined }
      clear_plot: { Args: { p_plot_id: string }; Returns: undefined }
      clear_tree: { Args: { p_tree_id: string }; Returns: undefined }
      collect_animal_product: { Args: { p_pen_id: string }; Returns: undefined }
      feed_animal: {
        Args: { p_pen_id: string; p_quantity: number }
        Returns: undefined
      }
      harvest_plot: { Args: { p_plot_id: string }; Returns: undefined }
      harvest_tree: { Args: { p_tree_id: string }; Returns: undefined }
      process_review: {
        Args: { p_decision: boolean; p_task_id: string }
        Returns: undefined
      }
      sell_to_system: {
        Args: {
          p_item_type: string
          p_price_per_unit: number
          p_quantity: number
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
