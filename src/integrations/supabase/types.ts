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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      clients: {
        Row: {
          address: string
          city: string
          country: string
          created_at: string
          email: string
          id: string
          name: string
          nif: string
          nif_iva: string | null
          postal_code: string
          province: string
          tipo: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          address?: string
          city?: string
          country?: string
          created_at?: string
          email?: string
          id?: string
          name: string
          nif?: string
          nif_iva?: string | null
          postal_code?: string
          province?: string
          tipo?: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          address?: string
          city?: string
          country?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          nif?: string
          nif_iva?: string | null
          postal_code?: string
          province?: string
          tipo?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          acogido_oss: boolean
          address: string
          categoria_irpf: string
          city: string
          country: string
          created_at: string
          email: string
          fecha_alta: string | null
          inscrito_roi: boolean
          legal_name: string
          nif: string
          onboarding_completed: boolean
          opera_ue: boolean
          postal_code: string
          province: string
          renunciar_reducido: boolean
          territorio: string
          tipo_actividad: string
          tipo_emisor: string
          updated_at: string
          user_id: string
          vende_ue: boolean
          ventas_ue_acumuladas: number
          workspace_id: string
        }
        Insert: {
          acogido_oss?: boolean
          address?: string
          categoria_irpf?: string
          city?: string
          country?: string
          created_at?: string
          email?: string
          fecha_alta?: string | null
          inscrito_roi?: boolean
          legal_name?: string
          nif?: string
          onboarding_completed?: boolean
          opera_ue?: boolean
          postal_code?: string
          province?: string
          renunciar_reducido?: boolean
          territorio?: string
          tipo_actividad?: string
          tipo_emisor?: string
          updated_at?: string
          user_id: string
          vende_ue?: boolean
          ventas_ue_acumuladas?: number
          workspace_id: string
        }
        Update: {
          acogido_oss?: boolean
          address?: string
          categoria_irpf?: string
          city?: string
          country?: string
          created_at?: string
          email?: string
          fecha_alta?: string | null
          inscrito_roi?: boolean
          legal_name?: string
          nif?: string
          onboarding_completed?: boolean
          opera_ue?: boolean
          postal_code?: string
          province?: string
          renunciar_reducido?: boolean
          territorio?: string
          tipo_actividad?: string
          tipo_emisor?: string
          updated_at?: string
          user_id?: string
          vende_ue?: boolean
          ventas_ue_acumuladas?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_deadlines: {
        Row: {
          created_at: string
          deadline_date: string
          id: string
          title: string
        }
        Insert: {
          created_at?: string
          deadline_date: string
          id?: string
          title: string
        }
        Update: {
          created_at?: string
          deadline_date?: string
          id?: string
          title?: string
        }
        Relationships: []
      }
      fixed_costs: {
        Row: {
          amount: number
          concept: string
          created_at: string
          date: string
          id: string
          is_cuota_autonomos: boolean
          iva_percent: number
          pct_deducible: number
          period: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          amount: number
          concept: string
          created_at?: string
          date?: string
          id?: string
          is_cuota_autonomos?: boolean
          iva_percent?: number
          pct_deducible?: number
          period?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          amount?: number
          concept?: string
          created_at?: string
          date?: string
          id?: string
          is_cuota_autonomos?: boolean
          iva_percent?: number
          pct_deducible?: number
          period?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixed_costs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          base_imponible: number
          cobrada_at: string | null
          created_at: string
          fecha_emision: string
          fecha_hora_gen_registro: string | null
          fecha_operacion: string
          hash_verifactu: string | null
          id: string
          irpf_porcentaje: number
          is_rectifying_of: string | null
          iva_porcentaje: number
          metodo_cobro: string | null
          nif_receptor: string
          nombre_receptor: string
          numero_factura: string
          regimen_iva: string
          status: string
          tipo_factura: string
          total_factura: number
          usuario_id: string
          workspace_id: string
        }
        Insert: {
          base_imponible: number
          cobrada_at?: string | null
          created_at?: string
          fecha_emision?: string
          fecha_hora_gen_registro?: string | null
          fecha_operacion: string
          hash_verifactu?: string | null
          id?: string
          irpf_porcentaje?: number
          is_rectifying_of?: string | null
          iva_porcentaje: number
          metodo_cobro?: string | null
          nif_receptor: string
          nombre_receptor: string
          numero_factura: string
          regimen_iva?: string
          status?: string
          tipo_factura?: string
          total_factura: number
          usuario_id: string
          workspace_id: string
        }
        Update: {
          base_imponible?: number
          cobrada_at?: string | null
          created_at?: string
          fecha_emision?: string
          fecha_hora_gen_registro?: string | null
          fecha_operacion?: string
          hash_verifactu?: string | null
          id?: string
          irpf_porcentaje?: number
          is_rectifying_of?: string | null
          iva_porcentaje?: number
          metodo_cobro?: string | null
          nif_receptor?: string
          nombre_receptor?: string
          numero_factura?: string
          regimen_iva?: string
          status?: string
          tipo_factura?: string
          total_factura?: number
          usuario_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_is_rectifying_of_fkey"
            columns: ["is_rectifying_of"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "user_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      pro_overage_blocks: {
        Row: {
          billing_period_start: string
          block_index: number
          created_at: string | null
          environment: string
          id: string
          invoice_count_at_charge: number
          stripe_invoice_item_id: string | null
          user_id: string
        }
        Insert: {
          billing_period_start: string
          block_index: number
          created_at?: string | null
          environment?: string
          id?: string
          invoice_count_at_charge: number
          stripe_invoice_item_id?: string | null
          user_id: string
        }
        Update: {
          billing_period_start?: string
          block_index?: number
          created_at?: string | null
          environment?: string
          id?: string
          invoice_count_at_charge?: number
          stripe_invoice_item_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          price_id: string
          product_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id: string
          product_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string
          product_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          created_at: string
          id: string
          monthly_limit: number
          plan_type: string
        }
        Insert: {
          created_at?: string
          id: string
          monthly_limit?: number
          plan_type?: string
        }
        Update: {
          created_at?: string
          id?: string
          monthly_limit?: number
          plan_type?: string
        }
        Relationships: []
      }
      user_tasks: {
        Row: {
          created_at: string
          done: boolean
          id: string
          priority: Database["public"]["Enums"]["task_priority"]
          task_date: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          task_date: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          done?: boolean
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          task_date?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      variable_costs: {
        Row: {
          amount: number
          archivo_nombre: string | null
          archivo_url: string | null
          category: string | null
          concept: string
          created_at: string
          date: string
          deducible: boolean
          es_bien_inversion: boolean
          estado: string
          id: string
          iva_percent: number
          pct_deducible: number
          provider: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          amount: number
          archivo_nombre?: string | null
          archivo_url?: string | null
          category?: string | null
          concept: string
          created_at?: string
          date?: string
          deducible?: boolean
          es_bien_inversion?: boolean
          estado?: string
          id?: string
          iva_percent?: number
          pct_deducible?: number
          provider?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          amount?: number
          archivo_nombre?: string | null
          archivo_url?: string | null
          category?: string | null
          concept?: string
          created_at?: string
          date?: string
          deducible?: boolean
          es_bien_inversion?: boolean
          estado?: string
          id?: string
          iva_percent?: number
          pct_deducible?: number
          provider?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "variable_costs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_audit_log: {
        Row: {
          action: string
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          meta: Json | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          action: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          meta?: Json | null
          user_id: string
          workspace_id: string
        }
        Update: {
          action?: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          meta?: Json | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_audit_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["workspace_role"]
          token: string
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["workspace_role"]
          token?: string
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          token?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          nif: string | null
          owner_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          nif?: string | null
          owner_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          nif?: string | null
          owner_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_workspace_invite: { Args: { _token: string }; Returns: string }
      can_write_workspace: {
        Args: { _uid: string; _ws: string }
        Returns: boolean
      }
      emitir_factura: {
        Args: {
          _base_imponible: number
          _fecha_operacion: string
          _irpf_porcentaje: number
          _is_rectifying_of?: string
          _iva_porcentaje: number
          _nif_receptor: string
          _nombre_receptor: string
          _regimen_iva: string
          _tipo_factura: string
          _total_factura: number
          _workspace_id: string
        }
        Returns: {
          base_imponible: number
          cobrada_at: string | null
          created_at: string
          fecha_emision: string
          fecha_hora_gen_registro: string | null
          fecha_operacion: string
          hash_verifactu: string | null
          id: string
          irpf_porcentaje: number
          is_rectifying_of: string | null
          iva_porcentaje: number
          metodo_cobro: string | null
          nif_receptor: string
          nombre_receptor: string
          numero_factura: string
          regimen_iva: string
          status: string
          tipo_factura: string
          total_factura: number
          usuario_id: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      has_workspace_role: {
        Args: {
          _roles: Database["public"]["Enums"]["workspace_role"][]
          _uid: string
          _ws: string
        }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { _uid: string; _ws: string }
        Returns: boolean
      }
    }
    Enums: {
      invoice_status: "draft_quote" | "draft_invoice" | "issued"
      invoice_type: "F1" | "F2" | "R"
      task_priority: "urgente" | "importante" | "rutinaria"
      workspace_role: "owner" | "admin" | "gestor" | "viewer"
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
    Enums: {
      invoice_status: ["draft_quote", "draft_invoice", "issued"],
      invoice_type: ["F1", "F2", "R"],
      task_priority: ["urgente", "importante", "rutinaria"],
      workspace_role: ["owner", "admin", "gestor", "viewer"],
    },
  },
} as const
