# 🧠 Work Request: Add Insights Capability to HR Copilot

## Objective

Introduce an "Insights" feature that enables users to explore analytical views of workforce data and initiate structured AI discussions. This includes backend data handling, prompt-based analysis, and frontend UI integration.

## Instructions

We are going to implement a new role for the mcp: analyst
This new role will have a set of insights available for it as an action that the ai can analyze and then can be discussed in a chat. 
we will be implementing this a multi step process with the first step setting up the role in the mcp-loop. 
Please review the patterns and practices for how we implement mcp roles, including the loop, inputs, outputs, agent logging etc.
Dont implement any other unrequested changes or refactoring. 

---

## ✅ Part 1: Supabase Edge Function — `mcp-loop`

### 📌 Step 1.1: Add New Role — `Analyst`

* Extend the role support system in `mcp-loop` to accept a new role type: `Analyst`

### 📌 Step 1.2: Accept Parameter — `insightId`

* Allow an optional query param `insightId` to be passed in requests to `mcp-loop`
* When present and role = `Analyst`, use it to determine which insight should be executed

{
  "mode": "analyst"
  "insightId": "generateCapabilityHeatmapByScope",
  "context": {
    "lastMessage": "What job opportunities are available for me"
    //see parameters below
  }
}


### 📋 Supported Insights

| ID                              | Label                                | Description                                         | Action                       |
|---------------------------------|--------------------------------------|-----------------------------------------------------|------------------------------|
| generateCapabilityHeatmapByScope | Capability Heatmap                   | Shows capability frequency across selected scope    | generateCapabilityHeatmapByScope |
| generateTopCapabilitiesByGroup | Top Capabilities by Group            | Lists most common capabilities by taxonomy or division | generateTopCapabilitiesByGroup |
| generateCapabilityOverlap       | Capability Overlap Across Groups     | Identifies capabilities shared across role families | generateCapabilityOverlap |
| generateProfileToRoleGapReport  | Role-to-Profile Capability Gaps      | Shows what a person needs to grow into a role       | generateProfileToRoleGapReport |


### 📌 Step 1.3: Add First Action — `generateCapabilityHeatmapByScope`

**Goal:**  
Support generation of capability heatmaps segmented by various organisational lenses, including taxonomy group, division, region, and company — as required by DCCEEW for internal mobility and workforce planning.

---

#### ✅ Define New Action: `generateCapabilityHeatmapByScope`

**Parameters:**
```ts
{
  companyIds: string[], // one or many companies, required
  scope: 'taxonomy' | 'division' | 'region' | 'all',
  scopeValue?: string, // optional filter within the selected scope
  outputFormat?: 'summary' | 'table' | 'chart' | 'action_plan' | 'compare' | 'raw' // optional AI response formatting
}

const outputFormat = input.outputFormat || 'action_plan';

```

This supports single-organisation and multi-organisation insights. Scope always applies **within the specified companies only**.
There must be atleast 1 companyId.

---

#### 🔧 SQL Variants

**1. By Taxonomy:**
```sql
SELECT
  t.name AS taxonomy,
  c.name AS capability,
  co.name AS company,
  COUNT(*) AS role_count
FROM role_capabilities rc
JOIN capabilities c ON rc.capability_id = c.id
JOIN role_taxonomies rt ON rc.role_id = rt.role_id
JOIN taxonomy t ON rt.taxonomy_id = t.id
JOIN roles r ON rc.role_id = r.id
JOIN companies co ON r.company_id = co.id
WHERE r.company_id IN (<companyIds>)
GROUP BY t.name, c.name, co.name
ORDER BY t.name, role_count DESC;
```

**2. By Division:**
```sql
SELECT
  d.name AS division,
  c.name AS capability,
  co.name AS company,
  COUNT(*) AS role_count
FROM roles r
JOIN divisions d ON r.division_id = d.id
JOIN role_capabilities rc ON rc.role_id = r.id
JOIN capabilities c ON rc.capability_id = c.id
JOIN companies co ON r.company_id = co.id
WHERE r.company_id IN (<companyIds>)
GROUP BY d.name, c.name, co.name
ORDER BY d.name, role_count DESC;
```

**3. By Region:**
```sql
SELECT
  r.location AS region,
  c.name AS capability,
  co.name AS company,
  COUNT(*) AS role_count
FROM roles r
JOIN role_capabilities rc ON rc.role_id = r.id
JOIN capabilities c ON rc.capability_id = c.id
JOIN companies co ON r.company_id = co.id
WHERE r.company_id IN (<companyIds>)
GROUP BY r.location, c.name, co.name
ORDER BY r.location, role_count DESC;
```

**4. Department-Wide (All):**
```sql
SELECT
  c.name AS capability,
  co.name AS company,
  COUNT(*) AS role_count
FROM role_capabilities rc
JOIN capabilities c ON rc.capability_id = c.id
JOIN roles r ON rc.role_id = r.id
JOIN companies co ON r.company_id = co.id
WHERE r.company_id IN (<companyIds>)
GROUP BY c.name, co.name
ORDER BY role_count DESC;
```

---

*Pass the result to the AI as part of the `context.data` payload, along with the parameters provided, including outputFormat.*

---

### 📌 Step 1.4: Prompt for Analyst Role / Heatmap Insight

**System Prompt:**
> You are an analyst helping a public sector HR team interpret a capability heatmap. The data shows how frequently capabilities appear in each role taxonomy group, division, region, or organisation. Highlight trends, gaps, or unexpected patterns. Offer interpretation useful for workforce planning.

**User Prompt (example):**
> "Analyze the capability heatmap for the selected scope (taxonomy group, division, region, or department). Identify capability hotspots, underrepresented areas, and potential workforce risks or reskilling opportunities."

*Modify the AI response formatting based on the `outputFormat` parameter if provided.*

### 📌 Step 1.4: Prompt for Analyst Role / Heatmap Insight

**System Prompt:**

> You are an analyst helping a public sector HR team interpret a capability heatmap. The data shows how frequently capabilities appear in each role taxonomy group, division, region, or organisation. Highlight trends, gaps, or unexpected patterns. Offer interpretation useful for workforce planning.

**User Prompt:**

> "Analyze the capability heatmap for the selected scope (taxonomy group, division, region, or department). Identify capability hotspots, underrepresented areas, and potential workforce risks or reskilling opportunities."

---

## ✅ Part 2: Supabase Edge Function — `chat`

### 📌 Step 2.1: Support `Analyst` Role in Chat Session

* Modify `chat` session creator to support initiating a chat with `role = Analyst`
* Ensure session ID and role type are passed into `mcp-loop`

---

## ✅ Part 3: Frontend

### 📌 Step 3.1: Homepage UI Update

* On homepage, add new button: **"Explore Insights"**
* Place next to “Start with a Role” card
* Navigates to `/insights`

### 📌 Step 3.2: Insights Page (`/insights`)

* Create new page that lists available insights:

  * Capability Heatmap by Taxonomy Group
  * (placeholder slots for future insights)
* Each insight row includes: title, description, \[View] button

### 📌 Step 3.3: Insight View + Discussion (`/insights/:id`)

* When a user clicks an insight, do the following:

  1. Create a new chat session with role = `Analyst`, insightId = `id`
  2. Navigate to `/insights/:id`
  3. Render the visualized result of the SQL query at the top
  4. Below the result, mount the chat window for discussion

---

## ✅ Output

* `mcp-loop` handles insight-based role analysis
* `chat` supports Analyst-based sessions
* Frontend supports navigation, insight selection, viewing, and discussion
* Insight: Capability Heatmap by Taxonomy Group live and analyzable

---

Ready to build each step independently and verify functionality before moving to the next.
