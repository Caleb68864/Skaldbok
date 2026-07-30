export type ReferenceSectionType = 'table' | 'key_value_list' | 'rules_text';

export interface ReferenceSection {
  id: string;
  title: string;
  /**
   * Display name of the owning group, kept as a fallback for a section whose
   * group row has gone. `groupId` is the authoritative join — see v14.
   */
  category: string;
  /** Id of the owning {@link ReferenceGroup}. */
  groupId?: string;
  /** ISO timestamp set when soft-deleted. */
  deletedAt?: string;
  /** Transaction id shared by every row deleted in one cascade. */
  softDeletedBy?: string;
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
  /** ISO timestamp set when soft-deleted. */
  deletedAt?: string;
  /** Transaction id shared by every row deleted in one cascade. */
  softDeletedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReferenceImportBundle {
  referenceSections?: Partial<ReferenceSection>[];
  referencePages?: Array<{ title: string; sections: string[] }>;
  referenceGroups?: Partial<ReferenceGroup>[];
}
