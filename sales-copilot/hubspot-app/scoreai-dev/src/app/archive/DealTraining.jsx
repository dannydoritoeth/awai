import React from "react";
import { hubspot } from "@hubspot/ui-extensions";
import BaseTraining from "./BaseTraining";

// Main Extension Component
const Extension = ({ context, actions }) => (
  <BaseTraining
    context={context}
    actions={actions}
    recordType="deal"
    title="Deal Training"
    description="AI-powered deal training"
    objectTypeId="0-3"
  />
);

// Initialize the extension
hubspot.extend(({ context, actions }) => (
  <Extension
    context={context}
    actions={actions}
  />
)); 