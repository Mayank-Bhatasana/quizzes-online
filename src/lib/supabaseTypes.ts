import type { Database } from "../../types/supabase";

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type ProfileSummary = Pick<
  ProfileRow,
  "username" | "total_points" | "avatar_url"
>;
export type SubjectRow = Database["public"]["Tables"]["subjects"]["Row"];
export type SubjectSummary = Pick<SubjectRow, "name" | "image_url">;
export type DifficultyRow = Database["public"]["Tables"]["difficulties"]["Row"];
export type LeaderboardRow = Database["public"]["Views"]["leaderboard"]["Row"];

export type GetQuizDataRow =
  Database["public"]["Functions"]["get_quiz_data"]["Returns"][number];

type CheckQuizAnswersWithQuizContext = Extract<
  Database["public"]["Functions"]["check_quiz_answers"],
  {
    Args: {
      quiz_difficulty_id: number;
      quiz_subject_id: number;
      user_selected_ids: number[];
      time_taken_seconds?: number;
    };
  }
>;

export type CheckQuizAnswersResultRow =
  CheckQuizAnswersWithQuizContext["Returns"][number];

export type leaderBoard  = Database['public']['Views']['leaderboard']
