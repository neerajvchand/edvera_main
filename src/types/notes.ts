export interface Note {
  id: string;
  parent_id: string;
  child_id: string | null;
  school_id: string;
  content: string;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}
