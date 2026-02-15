export interface ProfileData {
  personal: PersonalInfo;
  experience: Experience[];
  education: Education[];
  skills: Skill[];
  languages?: Language[];
  summary?: string;
}

export interface PersonalInfo {
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  maritalStatus?: string;
  health?: string;
}

export interface Experience {
  position: string;
  company: string;
  startDate: string;
  endDate: string;
  description: string[];
  isCurrent?: boolean;
}

export interface Education {
  school: string;
  degree?: string;
  major?: string;
  startYear?: string;
  endYear?: string;
  details?: string[];
}

export interface Skill {
  category?: string;
  skills: string[];
}

export interface Language {
  language: string;
  proficiency: string;
}
