# 📊 Company & Division Detail Page UX

This canvas outlines the UX structure for **company** and **division** detail pages within the TalentPath system. These pages serve dual purposes:

* Help **job seekers** and **explorers** discover roles.
* Provide **decision makers** with workforce insights — without disrupting role-focused navigation.

---

## 🏢 Page Route

* `/company/:id`
* `/division/:id`

---

## 🧱 Page Structure

### 1. Header Section

* Entity name: e.g., "DCCEEW" or "Water Planning Division"
* Breadcrumb: e.g., "NSW Government > DCCEEW > Water Planning Division"
* Optional: logo, description, region

---

### 2. 📊 Insights Panel (Collapsible)

**Expanded View**:

```
📊 Workforce Insights
──────────────────────────────
• Top roles used in this division
• Most common upward transitions
• Capability gaps or risks
• Hiring activity by classification band
• % roles with stretch capabilities
• Internal mobility stats (if available)
[Hide insights ▲]
```

**Collapsed View**:

```
📊 Workforce Insights ▼
```

* 💡 Default to collapsed for non-logged-in users
* 🔓 Expand automatically if user is a planner/manager persona

---

### 3. 🧭 Filter Panel (Left Sidebar)

* Always visible (sticky)
* Filters apply only **within this company or division** context:

  * Taxonomy
  * Capability
  * Skill
  * Classification band

---

### 4. 🔍 General Role Cards

* Same component as global search results
* Shows roles used in this company/division
* Includes role title, summary, transition links, classification band, associated units

---

## 🔁 Interaction Behavior

| Element        | Behavior                                           |
| -------------- | -------------------------------------------------- |
| Filters        | Filter role list in real time within scoped entity |
| Clicking role  | Navigates to general role detail                   |
| Insights panel | Collapsible to reduce visual noise                 |

---

## ✅ Why This UX Works

| User Type      | Benefits                                                   |
| -------------- | ---------------------------------------------------------- |
| Job Seeker     | Stays focused on roles while optionally seeing org context |
| People Seeker  | Can scope talent within an entity easily                   |
| Decision Maker | Access to data-rich insights without leaving the page      |

---

Let me know if you’d like a wireframe or add this into the master UX doc!
