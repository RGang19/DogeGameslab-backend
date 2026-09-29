import { templates } from "../data/templates.js";

export function listTemplates() {
  return templates.map(template => ({
    id: template.id,
    name: template.name,
    category: template.category,
    estimatedSeconds: template.estimatedSeconds,
    reliability: template.reliability,
    mechanic: template.mechanic,
    controls: template.controls
  }));
}

export function getTemplate(templateId) {
  return templates.find(template => template.id === templateId);
}
