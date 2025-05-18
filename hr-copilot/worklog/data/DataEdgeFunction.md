# 🧠 Work Request: Implement data edge function 

## Objective

Create a new edge function that can be used to do queries from the from end to get data it needs for insights and other needs. 
We need to be able to do the exact same query and get the same data result as what the ai will get with the same inputs. 
---

## ✅ Step-by-Step Deliverables

### ✅ STEP 1: Create a new edge function: data

### ✅ STEP 2: Use the same data structure the  for the front end to request the data available to the analyst ai.
https://vcwtxzmoembolyuiceuc.supabase.co/functions/v1/data
{
  "insightId": "generateCapabilityHeatmapByTaxonomy",
  "companyIds": ["98071d5d-02a0-4f0e-b13c-01cc61e5e6b4"],
  "browserSessionId": "1fe082ab-4fa0-483e-943d-9e96509dfc43"
}

This would call shared/mcp/analyst.ts/generateCapabilityHeatmapByTaxonomy and return the raw data the front end can also use. 

Do for all the insights we have
generateCapabilityHeatmapByTaxonomy
generateCapabilityHeatmapByDivision
generateCapabilityHeatmapByRegion
generateCapabilityHeatmapByCompany