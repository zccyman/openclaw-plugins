import type { AnyAgentTool } from "openclaw/plugin-sdk/core";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";

/**
 * Feedback Tool - 记录开发工作流反馈
 * 
 * 功能：
 * - 记录用户对开发结果的满意度
 * - 记录开发过程中的问题
 * - 支持评分和文字反馈
 * - 自动保存到反馈日志文件
 * 
 * v2 修复：
 * - 使用绝对路径或环境变量配置
 * - 添加输入验证
 * - 更好的错误处理
 */
export class FeedbackTool implements AnyAgentTool {
  name = "dev_workflow_feedback";
  label = "Dev Workflow Feedback";
  description = "Record feedback for a dev workflow execution. Includes satisfaction rating, issue description, and improvement suggestions.";

  parameters = z.object({
    workflowId: z.string().min(1).describe("Unique workflow execution ID"),
    rating: z.number().min(1).max(5).describe("Satisfaction rating 1-5"),
    issues: z.array(z.string()).optional().describe("List of issues encountered"),
    suggestions: z.array(z.string()).optional().describe("Improvement suggestions"),
    wouldUseAgain: z.boolean().describe("Would use this workflow again"),
    notes: z.string().optional().describe("Additional notes"),
  });

  // 使用环境变量或默认值
  private get feedbackDir(): string {
    return process.env.DEV_WORKFLOW_FEEDBACK_DIR || "docs/dev-workflow";
  }

  private get feedbackFile(): string {
    return process.env.DEV_WORKFLOW_FEEDBACK_FILE || "docs/dev-feedback.jsonl";
  }

  async execute(_toolCallId: string, input: z.infer<typeof this.parameters>) {
    // 输入验证
    if (!input.workflowId || input.workflowId.trim().length === 0) {
      return {
        success: false,
        error: "Invalid workflow ID: cannot be empty",
      };
    }

    if (input.rating < 1 || input.rating > 5) {
      return {
        success: false,
        error: "Invalid rating: must be between 1 and 5",
      };
    }

    try {
      // 使用项目目录（如果可用）或当前工作目录
      const baseDir = process.cwd();
      const feedbackPath = path.resolve(baseDir, this.feedbackDir);
      const filePath = path.resolve(baseDir, this.feedbackFile);

      // 确保目录存在
      if (!fs.existsSync(feedbackPath)) {
        fs.mkdirSync(feedbackPath, { recursive: true });
      }

      // 验证 workflowId 格式（防止路径遍历）
      const safeWorkflowId = input.workflowId.replace(/[^a-zA-Z0-9-_]/g, "");

      // 创建反馈记录
      const feedbackRecord = {
        timestamp: new Date().toISOString(),
        workflowId: safeWorkflowId,
        rating: input.rating,
        issues: input.issues || [],
        suggestions: input.suggestions || [],
        wouldUseAgain: input.wouldUseAgain,
        notes: input.notes || "",
      };

      // 追加到 JSONL 文件
      const line = JSON.stringify(feedbackRecord) + "\n";
      
      // 使用 flag 'a' 确保原子写入
      fs.appendFileSync(filePath, line, { encoding: "utf-8" });

      return {
        success: true,
        message: `Feedback recorded for workflow ${safeWorkflowId}`,
        rating: input.rating,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: `Failed to record feedback: ${errorMessage}`,
      };
    }
  }
}