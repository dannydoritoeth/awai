import React from "react";
import { hubspot } from "@hubspot/ui-extensions";
import BaseTraining from "./BaseTraining";

// Main Extension Component
const Extension = ({ context, actions }) => (
  <BaseTraining
    context={context}
    actions={actions}
    recordType="company"
    title="Company Training"
    description="AI-powered company training"
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