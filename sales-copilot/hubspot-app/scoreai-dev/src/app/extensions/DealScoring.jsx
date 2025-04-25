import React from "react";
import { hubspot } from "@hubspot/ui-extensions";
import BaseScoring from "./BaseScoring";

// Main Extension Component
const Extension = ({ context, actions }) => (
  <BaseScoring
    context={context}
    actions={actions}
    recordType="deal"
    title="Deal Score"
    description="AI-powered deal scoring"
    objectTypeId="0-3" // Deal object type ID
  />
);

// Initialize the extension
hubspot.extend(({ context, actions }) => (
  <Extension
    context={context}
    actions={actions} 
  />
)); 