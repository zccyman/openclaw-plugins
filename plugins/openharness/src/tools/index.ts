import { createBashTool } from "./bash.js";
import { createFileReadTool } from "./file-read.js";
import { createFileWriteTool } from "./file-write.js";
import { createFileEditTool } from "./file-edit.js";
import { createGlobTool } from "./glob.js";
import { createGrepTool } from "./grep.js";
import { createWebFetchTool } from "./web-fetch.js";
import { createWebSearchTool } from "./web-search.js";
import { createSkillTool } from "./skill.js";
import { createConfigTool } from "./config.js";
import { createBriefTool } from "./brief.js";
import { createTodoWriteTool } from "./todo-write.js";
import { createPlanModeTools } from "./plan-mode.js";
import { createTaskTools } from "./tasks.js";
import { createAgentTools } from "./agent.js";
import { createTeamTools } from "./team.js";
import { createCronTools } from "./cron.js";
import { createNotebookEditTool } from "./notebook-edit.js";

export function registerTools(api: any) {
  api.registerTool(createBashTool());
  api.registerTool(createFileReadTool());
  api.registerTool(createFileWriteTool());
  api.registerTool(createFileEditTool());
  api.registerTool(createGlobTool());
  api.registerTool(createGrepTool());
  api.registerTool(createNotebookEditTool());

  api.registerTool(createWebFetchTool());
  api.registerTool(createWebSearchTool());

  api.registerTool(createSkillTool());
  api.registerTool(createConfigTool());
  api.registerTool(createBriefTool());

  api.registerTool(createTodoWriteTool());
  const { enterPlanMode, exitPlanMode } = createPlanModeTools();
  api.registerTool(enterPlanMode);
  api.registerTool(exitPlanMode);

  const taskTools = createTaskTools();
  taskTools.forEach((t: any) => api.registerTool(t));

  const agentTools = createAgentTools();
  agentTools.forEach((t: any) => api.registerTool(t));

  const teamTools = createTeamTools();
  teamTools.forEach((t: any) => api.registerTool(t));

  const cronTools = createCronTools();
  cronTools.forEach((t: any) => api.registerTool(t));
}
