export type UserRole = 'super_admin' | 'admin' | 'intern';
export type TaskStatus = 'pending' | 'submitted' | 'approved' | 'rejected';
export type TaskPriority = 'low' | 'medium' | 'high';
export type LeaveRequestStatus = 'pending' | 'approved' | 'rejected';
export type LeaveRequestType = 'casual' | 'sick' | 'personal' | 'emergency' | 'other';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  position: string | null;
  mentor_id: string | null;
  created_by: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  assigned_to: string | null;
  created_by: string | null;
  due_date: string | null;
  submission_note: string | null;
  submission_url: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskWithDetails extends Task {
  assigned_to_name: string | null;
  assigned_to_email: string | null;
  created_by_name: string | null;
  reviewed_by_name: string | null;
}

export interface LeaveRequest {
  id: string;
  user_id: string;
  mentor_id: string | null;
  start_date: string;
  end_date: string;
  leave_type: LeaveRequestType;
  reason: string;
  status: LeaveRequestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>;
      };
      tasks: {
        Row: Task;
        Insert: Omit<Task, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Task, 'id' | 'created_at'>>;
      };
      leave_requests: {
        Row: LeaveRequest;
        Insert: Omit<LeaveRequest, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<LeaveRequest, 'id' | 'created_at'>>;
      };
    };
    Enums: {
      user_role: UserRole;
      task_status: TaskStatus;
      task_priority: TaskPriority;
      leave_request_status: LeaveRequestStatus;
      leave_request_type: LeaveRequestType;
    };
  };
}
