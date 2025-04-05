import React from "react";
import { hubspot } from "@hubspot/ui-extensions";
import BaseScoring from "./BaseScoring";

// Main Extension Component
const Extension = ({ context, actions }) => (
  <BaseScoring
    context={context}
    actions={actions}
    recordType="contact"
    title="Contact Score"
    description="AI-powered contact scoring"
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