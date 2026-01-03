/**
 * Orchestrator Controller
 *
 * API endpoints for interacting with the orchestrator during workflow execution.
 */

import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { OrchestratorService, OrchestratorMessage, ConversationHistory } from './orchestrator.service';

/** Request body for sending a message */
interface SendMessageDto {
  content: string;
}

/** Response for sending a message */
interface SendMessageResponse {
  message: OrchestratorMessage;
}

/** Response for getting history */
interface HistoryResponse {
  history: ConversationHistory | null;
}

/** Response for getting messages */
interface MessagesResponse {
  messages: OrchestratorMessage[];
}

@Controller('api/v1/tasks/:taskId/orchestrator')
@UseGuards(AuthGuard)
export class OrchestratorController {
  constructor(private readonly orchestratorService: OrchestratorService) {}

  /**
   * Send a message to the orchestrator
   *
   * POST /api/v1/tasks/:taskId/orchestrator/message
   */
  @Post('message')
  @HttpCode(HttpStatus.OK)
  async sendMessage(
    @Param('taskId') taskId: string,
    @Body() body: SendMessageDto
  ): Promise<SendMessageResponse> {
    if (!body.content || typeof body.content !== 'string') {
      throw new NotFoundException('Message content is required');
    }

    const content = body.content.trim();
    if (content.length === 0) {
      throw new NotFoundException('Message content cannot be empty');
    }

    if (content.length > 10000) {
      throw new NotFoundException('Message content too long (max 10000 characters)');
    }

    const message = await this.orchestratorService.sendMessage(taskId, content);
    return { message };
  }

  /**
   * Get conversation history for a task
   *
   * GET /api/v1/tasks/:taskId/orchestrator/history
   */
  @Get('history')
  async getHistory(@Param('taskId') taskId: string): Promise<HistoryResponse> {
    const history = this.orchestratorService.getHistory(taskId);
    return { history };
  }

  /**
   * Get all messages for a task
   *
   * GET /api/v1/tasks/:taskId/orchestrator/messages
   */
  @Get('messages')
  async getMessages(@Param('taskId') taskId: string): Promise<MessagesResponse> {
    const messages = this.orchestratorService.getMessages(taskId);
    return { messages };
  }

  /**
   * Clear conversation history for a task
   *
   * DELETE /api/v1/tasks/:taskId/orchestrator/history
   */
  @Delete('history')
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearHistory(@Param('taskId') taskId: string): Promise<void> {
    this.orchestratorService.clearHistory(taskId);
  }
}
