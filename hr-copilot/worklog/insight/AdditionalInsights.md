# 📊 Work Request: Implement Remaining Insights in Insights Dashboard

## Objective

Expand the "Explore Insights" dashboard to include additional insight cards and chat-integrated analysis tools. This phase includes backend queries, frontend UI updates, and AI prompts for reasoning.

---

## ✅ Insights to Implement

### 1. **Roles Missing Capabilities**

* **Query:**

```sql
SELECT r.id, r.title
FROM roles r
LEFT JOIN role_capabilities rc ON rc.role_id = r.id
WHERE rc.capability_id IS NULL;
```

* **Purpose:** Identifies roles that have not yet been mapped to capabilities
* **Chat prompt:**

> “Why are these roles missing capability mapping? What should we do to address this gap?”

---

### 2. **Most Common Capabilities**

* **Query:**

```sql
SELECT c.name, COUNT(*) AS usage_count
FROM role_capabilities rc
JOIN capabilities c ON rc.capability_id = c.id
GROUP BY c.name
ORDER BY usage_count DESC
LIMIT 10;
```

* **Purpose:** Shows top 10 most commonly used capabilities
* **Chat prompt:**

> “What trends do you see in our most commonly used capabilities?”

---

### 3. **Capability Overlap Across Taxonomy Groups**

* **Query:**

```sql
SELECT c.name, COUNT(DISTINCT rt.taxonomy_id) AS taxonomy_count
FROM role_capabilities rc
JOIN capabilities c ON rc.capability_id = c.id
JOIN role_taxonomies rt ON rc.role_id = rt.role_id
GROUP BY c.name
HAVING COUNT(DISTINCT rt.taxonomy_id) > 1
ORDER BY taxonomy_count DESC;
```

* **Purpose:** Highlights capabilities used across multiple role families
* **Chat prompt:**

> “What are the risks or opportunities associated with capabilities that appear in multiple taxonomy groups?”

---

### 4. **Role Count per Taxonomy Group**

* **Query:**

```sql
SELECT t.name, COUNT(rt.role_id) AS role_count
FROM role_taxonomies rt
JOIN taxonomy t ON rt.taxonomy_id = t.id
GROUP BY t.name
ORDER BY role_count DESC;
```

* **Purpose:** Gives an overview of how roles are distributed across taxonomy groups
* **Chat prompt:**

> “What does this distribution tell us about our workforce structure?”

---

## ✅ Implementation Steps

### 📌 Backend

* Add each SQL query to the insights query handler
* Assign a unique `insightId` for each
* Attach appropriate system + user prompts

### 📌 Frontend

* On `/insights`, add each new insight card:

  * Title
  * Description
  * \[View] and \[Ask AI] buttons
* On click, open `/insights/:id` and trigger `mcp-loop` with `role=analyst`, `insightId=?`

### 📌 AI Discussion

* Inject the selected query’s result into the session
* Prompt the Analyst to analyze trends, gaps, or risks

---

## ✅ Outcome

* The insights dashboard now includes 5 core views
* Each insight is interactive and discussable
* Framework is ready for future additions (e.g., profile-based insights, time-based change tracking)
