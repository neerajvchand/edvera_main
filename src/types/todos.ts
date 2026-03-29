export interface Todo {
  id: string;
  parent_id: string;
  child_id: string | null;
  school_id: string;
  title: string;
  details: string | null;
  due_date: string | null;
  status: 'open' | 'done' | 'dismissed';
  source: string;
  created_at: string;
  updated_at: string;
}
