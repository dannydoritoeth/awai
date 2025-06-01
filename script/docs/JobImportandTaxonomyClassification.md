# Implementation Plan: Job Import and Taxonomy Classification

We need to change how the script determines capabilities specifically for the nswgov. They need to use the NSW Public Sector capabilities. So we we need to modify the script to instead use them for all those jobs/roles imported. 

We are going to do it in steps and I want you to only change what is required. No unrequested refactoring. 

This document outlines a revised, streamlined process for implementing capability mapping and role taxonomy classification during the job import workflow. This structure minimizes post-processing and enables immediate reporting, filtering, and AI reasoning.

The systems that need changing include:
 - hr-copilot: supabase database migration script for db changes 
 - script: prepareSeedData & insertSeedData to change how capabilities are created, how to determine which ones link to a role/job & then link them to jobs/roles
 - script: prepareSeedData & insertSeedData to add the ability to create and insert the taxonomy. after we have all the role names.

---

## NSW Capability Framework Reference

### Capability Levels (applied to each capability)

* **Foundational** – Developing basic awareness and beginning to apply capability
* **Intermediate** – Demonstrating capability with some autonomy in a routine context
* **Adept** – Confident and consistent application in a range of contexts
* **Advanced** – High level of influence or leadership using the capability
* **Highly Advanced** – Strategic authority or organisation-wide leadership in the capability

### Capabilities with Descriptions

#### Personal Attributes

1. **Display Resilience and Courage** – Be open and honest, prepared to express your views, and willing to accept and commit to change.
2. **Act with Integrity** – Be ethical and professional, and adhere to the public sector values.
3. **Manage Self** – Show drive and motivation, a measured approach and a commitment to learning.
4. **Value Diversity** – Show respect for diverse backgrounds, experiences and perspectives.

#### Relationships

5. **Communicate Effectively** – Communicate clearly, actively listen to others and respond with respect.
6. **Commit to Customer Service** – Provide customer centric services in line with public service and organisational objectives.
7. **Work Collaboratively** – Collaborate with others and value their contribution.
8. **Influence and Negotiate** – Gain consensus and commitment from others and resolve issues and conflicts.

#### Results

9. **Deliver Results** – Achieve results through efficient use of resources and a commitment to quality outcomes.
10. **Plan and Prioritise** – Plan to achieve priority outcomes and respond flexibly to changing circumstances.
11. **Think and Solve Problems** – Think, analyse and consider the broader context to develop practical solutions.
12. **Demonstrate Accountability** – Be responsible for own actions, adhere to legislation and policy and be proactive to address risk.

#### Business Enablers

13. **Finance** – Understand and apply financial processes to achieve value for money and minimise financial risk.
14. **Technology** – Understand and use available technologies to maximise efficiencies and effectiveness.
15. **Procurement and Contract Management** – Understand and apply procurement processes to ensure effective purchasing and contract performance.
16. **Project Management** – Understand and apply effective planning, coordination and control methods.

#### People Management

17. **Manage and Develop People** – Engage and motivate staff and develop capability and potential in others.
18. **Inspire Direction and Purpose** – Communicate goals, priorities and vision and recognise achievements.
19. **Optimise Business Outcomes** – Manage resources effectively and apply sound workforce planning principles.
20. **Manage Reform and Change** – Support, promote and champion change, and assist others to engage with change.

---

## Phase 1: Job Import & Capability Mapping

### Step 1.1: Load NSW Capability Framework

* Instead of determining them from the job/role, instead use the `capabilities` and `capability_levels` outlined above. Each capability has all the levels. 
* Framework should include 16 core capabilities (+ 4 people management capabilities) with structured levels and descriptions

### Step 1.2: AI Classification of Capabilities During Import

* Modify job parsing process to:
  * Extract relevant text from job descriptions
  * Use GPT-4 or embedding-based matching to classify each job to 3–6 capabilities
  * Optionally assign proficiency level (e.g., Intermediate, Adept, Advanced)
* Store mappings in `job_capabilities` or `role_capabilities` table

### Step 1.3: Create Job/Role Records with Capability Links

* On import, store new jobs and roles
* Ensure that capability mappings are linked at this stage (no separate post-processing required)

---

## Phase 2: Role Taxonomy Classification

### Step 2.1: Create Role Taxonomy Tables

* In the hr-copilot supabase schema Define a new `taxonomy` table to hold groupings (e.g., Policy, Field Operations, Legal)
* Also define a join table to allow roles to be linked to multiple taxonomy entries, including occupation-specific groupings

```sql
CREATE TABLE taxonomy (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  taxonomy_type text DEFAULT 'core', -- e.g., 'core' or 'occupation-specific'
  created_at timestamptz DEFAULT now()
);

CREATE TABLE role_taxonomies (
  role_id uuid REFERENCES roles(id),
  taxonomy_id uuid REFERENCES taxonomy(id),
  PRIMARY KEY (role_id, taxonomy_id)
);
```

### Step 2.2: Classify Roles into Taxonomies Using AI

* Create a new script to run prepareTaxonomy & insertTaxonomy
* Select all the distinc roles from the database
* Use GPT-4 with a structured prompt(script\jobs\JobImportandTaxonomyClassfication-Prompt.md) to classify each role into a high-level taxonomy group
* Example groups: Policy, Field Operations, ICT, Legal, Environmental Science, Admin Support, etc.

### Step 2.3: Insert Taxonomies and Link to Roles

* Create taxonomy entries based on AI output
* Insert all relevant taxonomy groupings into the `taxonomy` table
* Link each role to one or more taxonomies using the `role_taxonomies` table
* This allows flexibility to represent both core functional groupings and occupation-specific classifications

---

## Phase 3: Metadata Tagging and Filtering

### Step 3.1: Tag Roles with Additional Metadata

* Use AI or rule-based methods to tag roles with relevant filters (e.g., "field-based", "executive", "contract")

### Step 3.2: Enable Filtering and Analytics

* Use taxonomy and capability relationships to power:

  * Capability heatmaps
  * Role filters in the UI
  * Internal mobility pathways

---

## Phase 4: Operational Maintenance

### Step 4.1: Automate Classification on Future Imports

* Embed capability and taxonomy mapping steps into the import pipeline
* Store mappings and classifications directly in the database

### Step 4.2: Governance & QA

* Assign responsibility for validating edge cases
* Review classification quality quarterly

---

This updated plan focuses on using AI during import to handle classification, greatly simplifying the implementation and enabling immediate utility across dashboards, reasoning, and workforce analytics.
