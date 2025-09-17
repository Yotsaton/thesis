// src/database/database.types.ts

// interface support
export interface geoJSONPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export type DateYMD = string; // 'YYYY-MM-DD'

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
  status : string ; 
  created_at : Date ;
  header : string | null;
  updated_at : Date ;
}

export interface day_trip{
  id : string ; // PK
  trip_id : string ; // FK from trip table
  created_at : Date ;
  date : DateYMD ; // date for plan
  header : string | null; 
  geometry : string | null ;
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
  place_ID_by_ggm : string | null;
  category : string[] | null;
  url : string | null;
  updated_at : Date;
}

export interface route{
  id : string;                // PK
  day_trip_id : string;       // FK from dat_trip table
  place_id : string | null;   // FK from place table
  created_at : Date;
  duration : number | null;   // time to travel in next index
  distance : number | null;   // distance in next index
  time_used : number | null;  // time to used at place_id
  note : any | null;
  index : number ;
  updated_at : Date;
}
