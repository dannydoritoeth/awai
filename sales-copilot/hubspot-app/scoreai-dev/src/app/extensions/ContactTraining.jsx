import React from "react";
import { hubspot } from "@hubspot/ui-extensions";
import BaseTraining from "./BaseTraining";

// Main Extension Component
const Extension = ({ context, actions }) => (
  <BaseTraining
    context={context}
    actions={actions}
    recordType="contact"
    title="Contact Training"
    description="AI-powered contact training"
    objectTypeId="0-1"
  />
);

// Initialize the extension
hubspot.extend(({ context, actions }) => (
  <Extension
    context={context}
    actions={actions}
  />
)); 