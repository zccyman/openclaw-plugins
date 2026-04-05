import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import { DevWorkflowTool } from "./dev-workflow-tool.js";
import { WorkflowStatusTool } from "./workflow-status-tool.js";
import { TaskExecuteTool } from "./task-execute-tool.js";
import { SpecViewTool } from "./spec-view-tool.js";
import { QAGateTool } from "./qa-gate-tool.js";
import { PlanGateTool } from "./plan-gate-tool.js";
import { PermissionTool } from "./permission-tool.js";
import { BackgroundTaskTool } from "./background-task-tool.js";

export function registerDevWorkflowTools(api: OpenClawPluginApi) {
  api.registerTool(new DevWorkflowTool());
  api.registerTool(new WorkflowStatusTool());
  api.registerTool(new TaskExecuteTool());
  api.registerTool(new SpecViewTool());
  api.registerTool(new QAGateTool());
  api.registerTool(new PlanGateTool());
  api.registerTool(new PermissionTool());
  api.registerTool(new BackgroundTaskTool());
}
