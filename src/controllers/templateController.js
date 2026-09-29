import { getTemplate, listTemplates } from "../services/templateService.js";
import { buildTemplateExport } from "../services/exportService.js";

export function indexTemplates(_request, response) {
  response.json({ templates: listTemplates() });
}

export function showTemplate(request, response) {
  const template = getTemplate(request.params.templateId);
  if (!template) {
    response.status(404).json({ error: "Template not found" });
    return;
  }

  response.json({ template });
}

export function exportTemplates(_request, response) {
  const bundle = buildTemplateExport();
  response.setHeader("Content-Disposition", "attachment; filename=dogegame-template-pack.json");
  response.json(bundle);
}