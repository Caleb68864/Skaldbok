export type ReferenceSectionType = 'table' | 'key_value_list' | 'rules_text';

export interface ReferenceSection {
  id: string;
  title: string;
  category: string;
  order: number;
  pg?: string;
  type: ReferenceSectionType;
  columns?: string[];
  rows?: Record<string, string>[];
  items?: { label: string; description: string }[];
  paragraphs?: string[];
  footnote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReferenceGroup {
  id: string;
  title: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReferenceImportBundle {
  referenceSections?: Partial<ReferenceSection>[];
  referencePages?: Array<{ title: string; sections: string[] }>;
  referenceGroups?: Partial<ReferenceGroup>[];
}
