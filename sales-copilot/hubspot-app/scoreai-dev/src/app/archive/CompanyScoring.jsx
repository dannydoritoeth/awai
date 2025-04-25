import React from "react";
import { hubspot } from "@hubspot/ui-extensions";
import BaseScoring from "./BaseScoring";

// Main Extension Component
const Extension = ({ context, actions }) => (
  <BaseScoring
    context={context}
    actions={actions}
    recordType="company"
    title="Company Score"
    description="AI-powered company scoring"
    objectTypeId="0-2"
  />
);

// Initialize the extension
hubspot.extend(({ context, actions }) => (
  <Extension
    context={context}
    actions={actions}
  />
)); 