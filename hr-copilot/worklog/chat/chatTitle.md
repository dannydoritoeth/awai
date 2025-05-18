# 🧠 Work Request: Implement Chat Title (Implemented in full)



## Objective

We currently dont create/maintain a title for chat sessions. This will be done in two steps. 

---

## ✅ Step-by-Step Deliverables

### ✅ STEP 1: Chat edge function

When startSession is called we need to set the summary column in conversation_sessions based on:
 - Hiring: Role name
 - Candidate: Profile full name
 - General: Summary of question
 - Analyst: Insight name


### ✅ STEP 2: Front end

Change the left panel to use the converstaion_sesssions summary column for the chat name. Rather than "XYZ Discussiion - date"
