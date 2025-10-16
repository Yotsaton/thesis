// src/database/database.types.ts

// interface support
export interface geoJSONPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export type DateYMD = string; // 'YYYY-MM-DD'
export type Time = string; // 'HH:mm:ss+ZZ'

// interface database
export interface users {
  username: string;        // PK
  email: string;
  password: string;
  is_super_user: boolean;
  is_staff_user: boolean;
  created_at: Date;
  is_verify: boolean;
  is_online: boolean;
  last_login: Date | null;  
  token_version: number;
  last_seen : Date | null ;
  is_deleted : boolean ;
  deleted_at : Date | null ;
}

export interface otps {
  id: string; // PK
  username: string;
  otp_hash: string;
  expires_at: Date;
  last_resent_at: Date;
}

export interface trip{
  id : string ; // PK
  username : string ; // FK from users table
  start_plan : DateYMD ;
  end_plan : DateYMD ;
  status : "active" | "deleted"; 
  created_at : Date ;
  header : string | null;
  updated_at : Date ;
  deleted_at : Date | null ;
}

export interface day_trip{
  id : string ; // PK
  trip_id : string ; // FK from trip table
  created_at : Date ;
  date : DateYMD ; // date for plan
  header : string | null; 
  updated_at : Date ;
}

export interface place{
  id : string;                        //PK
  name_place : string | null;
  address : string | null;
  location : geoJSONPoint; 
  rating : number | null;
  user_rating_total : number | null;
  sumary_place : string | null;
  place_id_by_ggm : string | null;
  category : string[] | null;
  url : string | null;
  updated_at : Date;
}

export interface route{
  id : string;                // PK
  d_trip_id : string;       // FK from day_trip table
  place_id : string | null;   // FK from place table
  created_at : Date;
  note : string | null;
  index : number ;
  updated_at : Date;
  start_time : Time | null; // "HH:MM:SS+ZZ"format
  end_time : Time | null;   // "HH:MM:SS+ZZ"format
  type : 'place' | 'note';
}

export interface activity_log{
  id : string;            // PK
  username : string;      // FK from users table
  ip_addr : string;
  activity : string | null;
  created_at : Date;
}