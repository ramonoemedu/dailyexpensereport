export interface User {
    id: string;
    email: string;
    displayName?: string;
}

export interface DataEntry {
    id: string;
    title: string;
    description: string;
    createdAt: Date;
}

export interface Outcome {
    id: string;
    dataEntryId: string;
    result: string;
    createdAt: Date;
}

export interface Template {
    id: string;
    name: string;
    content: string;
}

export interface PersonalInfo {
  name: string;
  title?: string;
  sex?: string;
  height?: string;
  email?: string;
  phone?: string;
  address?: string;
  placeOfBirth?: string;
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

export interface ProfileData {
  personal: PersonalInfo;
  experience: Experience[];
  education: Education[];
  skills: Skill[];
  languages?: Language[];
  summary?: string;
}