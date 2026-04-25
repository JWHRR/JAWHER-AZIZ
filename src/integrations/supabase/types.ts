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
      absences: {
        Row: {
          created_at: string
          date: string
          dortoir_id: string
          id: string
          nombre_absents: number
          noms_absents: string | null
          observations: string | null
          surveillant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          dortoir_id: string
          id?: string
          nombre_absents?: number
          noms_absents?: string | null
          observations?: string | null
          surveillant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          dortoir_id?: string
          id?: string
          nombre_absents?: number
          noms_absents?: string | null
          observations?: string | null
          surveillant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "absences_dortoir_id_fkey"
            columns: ["dortoir_id"]
            isOneToOne: false
            referencedRelation: "dortoirs"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_logs: {
        Row: {
          action: string
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      chambre_inspections: {
        Row: {
          chambre_id: string
          created_at: string
          date: string
          degats: boolean
          id: string
          observations: string | null
          ordre: number
          proprete: number
          surveillant_id: string
          updated_at: string
        }
        Insert: {
          chambre_id: string
          created_at?: string
          date: string
          degats?: boolean
          id?: string
          observations?: string | null
          ordre?: number
          proprete?: number
          surveillant_id: string
          updated_at?: string
        }
        Update: {
          chambre_id?: string
          created_at?: string
          date?: string
          degats?: boolean
          id?: string
          observations?: string | null
          ordre?: number
          proprete?: number
          surveillant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chambre_inspections_chambre_id_fkey"
            columns: ["chambre_id"]
            isOneToOne: false
            referencedRelation: "chambres"
            referencedColumns: ["id"]
          },
        ]
      }
      chambres: {
        Row: {
          capacite: number
          created_at: string
          dortoir_id: string
          id: string
          numero: string
        }
        Insert: {
          capacite?: number
          created_at?: string
          dortoir_id: string
          id?: string
          numero: string
        }
        Update: {
          capacite?: number
          created_at?: string
          dortoir_id?: string
          id?: string
          numero?: string
        }
        Relationships: [
          {
            foreignKeyName: "chambres_dortoir_id_fkey"
            columns: ["dortoir_id"]
            isOneToOne: false
            referencedRelation: "dortoirs"
            referencedColumns: ["id"]
          },
        ]
      }
      dortoir_assignments: {
        Row: {
          assigned_at: string
          dortoir_id: string
          id: string
          surveillant_id: string
        }
        Insert: {
          assigned_at?: string
          dortoir_id: string
          id?: string
          surveillant_id: string
        }
        Update: {
          assigned_at?: string
          dortoir_id?: string
          id?: string
          surveillant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dortoir_assignments_dortoir_id_fkey"
            columns: ["dortoir_id"]
            isOneToOne: false
            referencedRelation: "dortoirs"
            referencedColumns: ["id"]
          },
        ]
      }
      dortoirs: {
        Row: {
          capacite: number
          code: string
          created_at: string
          description: string | null
          id: string
        }
        Insert: {
          capacite?: number
          code: string
          created_at?: string
          description?: string | null
          id?: string
        }
        Update: {
          capacite?: number
          code?: string
          created_at?: string
          description?: string | null
          id?: string
        }
        Relationships: []
      }
      permanence_template: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          slot: Database["public"]["Enums"]["permanence_slot"]
          surveillant_id: string
          updated_at: string
          weekday: Database["public"]["Enums"]["weekday"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          slot: Database["public"]["Enums"]["permanence_slot"]
          surveillant_id: string
          updated_at?: string
          weekday: Database["public"]["Enums"]["weekday"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          slot?: Database["public"]["Enums"]["permanence_slot"]
          surveillant_id?: string
          updated_at?: string
          weekday?: Database["public"]["Enums"]["weekday"]
        }
        Relationships: []
      }
      permanences: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          id: string
          notes: string | null
          slot: Database["public"]["Enums"]["permanence_slot"]
          surveillant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          id?: string
          notes?: string | null
          slot: Database["public"]["Enums"]["permanence_slot"]
          surveillant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          notes?: string | null
          slot?: Database["public"]["Enums"]["permanence_slot"]
          surveillant_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reclamations: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string
          description: string | null
          dortoir_id: string | null
          id: string
          lieu: string | null
          notes_technicien: string | null
          priority: Database["public"]["Enums"]["reclamation_priority"]
          resolved_at: string | null
          status: Database["public"]["Enums"]["reclamation_status"]
          titre: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          dortoir_id?: string | null
          id?: string
          lieu?: string | null
          notes_technicien?: string | null
          priority?: Database["public"]["Enums"]["reclamation_priority"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["reclamation_status"]
          titre: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          dortoir_id?: string | null
          id?: string
          lieu?: string | null
          notes_technicien?: string | null
          priority?: Database["public"]["Enums"]["reclamation_priority"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["reclamation_status"]
          titre?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reclamations_dortoir_id_fkey"
            columns: ["dortoir_id"]
            isOneToOne: false
            referencedRelation: "dortoirs"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_assignments: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          id: string
          repas: Database["public"]["Enums"]["repas_type"]
          surveillant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          id?: string
          repas: Database["public"]["Enums"]["repas_type"]
          surveillant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          repas?: Database["public"]["Enums"]["repas_type"]
          surveillant_id?: string
        }
        Relationships: []
      }
      restaurant_logs: {
        Row: {
          assignment_id: string | null
          created_at: string
          date: string
          id: string
          nombre_eleves: number
          observations: string | null
          repas: Database["public"]["Enums"]["repas_type"]
          surveillant_id: string
          updated_at: string
        }
        Insert: {
          assignment_id?: string | null
          created_at?: string
          date: string
          id?: string
          nombre_eleves?: number
          observations?: string | null
          repas: Database["public"]["Enums"]["repas_type"]
          surveillant_id: string
          updated_at?: string
        }
        Update: {
          assignment_id?: string | null
          created_at?: string
          date?: string
          id?: string
          nombre_eleves?: number
          observations?: string | null
          repas?: Database["public"]["Enums"]["repas_type"]
          surveillant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_logs_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "restaurant_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_template: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          repas: Database["public"]["Enums"]["repas_type"]
          surveillant_id: string
          updated_at: string
          weekday: Database["public"]["Enums"]["weekday"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          repas: Database["public"]["Enums"]["repas_type"]
          surveillant_id: string
          updated_at?: string
          weekday: Database["public"]["Enums"]["weekday"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          repas?: Database["public"]["Enums"]["repas_type"]
          surveillant_id?: string
          updated_at?: string
          weekday?: Database["public"]["Enums"]["weekday"]
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      weekend_effectifs: {
        Row: {
          created_at: string
          dortoir_id: string
          id: string
          nombre_presents: number
          observations: string | null
          semaine_du: string
          surveillant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dortoir_id: string
          id?: string
          nombre_presents?: number
          observations?: string | null
          semaine_du: string
          surveillant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dortoir_id?: string
          id?: string
          nombre_presents?: number
          observations?: string | null
          semaine_du?: string
          surveillant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekend_effectifs_dortoir_id_fkey"
            columns: ["dortoir_id"]
            isOneToOne: false
            referencedRelation: "dortoirs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "ADMIN" | "SURVEILLANT" | "TECHNICIEN"
      permanence_slot: "MATIN" | "APRES_MIDI" | "NUIT"
      reclamation_priority: "BASSE" | "NORMALE" | "HAUTE"
      reclamation_status: "EN_ATTENTE" | "EN_COURS" | "TERMINEE"
      repas_type: "PETIT_DEJEUNER" | "DEJEUNER" | "DINER"
      weekday: "LUN" | "MAR" | "MER" | "JEU" | "VEN" | "SAM" | "DIM"
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
      app_role: ["ADMIN", "SURVEILLANT", "TECHNICIEN"],
      permanence_slot: ["MATIN", "APRES_MIDI", "NUIT"],
      reclamation_priority: ["BASSE", "NORMALE", "HAUTE"],
      reclamation_status: ["EN_ATTENTE", "EN_COURS", "TERMINEE"],
      repas_type: ["PETIT_DEJEUNER", "DEJEUNER", "DINER"],
      weekday: ["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"],
    },
  },
} as const
