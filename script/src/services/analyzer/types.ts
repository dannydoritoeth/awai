export interface TaxonomyGroup {
  id: string;
  name: string;
  description: string;
  taxonomy_type: string;
}

export interface RoleTaxonomy {
  roleId: string;
  roleTitle: string;
  taxonomyIds: string[];
}

export interface BatchTaxonomyAnalysisResult {
  roleTaxonomies: RoleTaxonomy[];
} 