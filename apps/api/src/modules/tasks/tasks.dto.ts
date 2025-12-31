/**
 * Task DTOs
 *
 * Class-based DTOs for Swagger documentation.
 * Validation is done via Zod schemas in service layer.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
} from 'class-validator';

export class CreateTaskDto {
  @ApiProperty({
    description: 'Project ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  projectId!: string;

  @ApiProperty({
    description: 'Task prompt/description',
    example: 'Add a login page with email and password authentication',
    minLength: 10,
    maxLength: 50000,
  })
  @IsString()
  @IsNotEmpty()
  prompt!: string;

  @ApiPropertyOptional({
    description: 'Task priority',
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal',
  })
  @IsString()
  @IsOptional()
  priority?: 'low' | 'normal' | 'high' | 'urgent';

  @ApiPropertyOptional({
    description: 'Additional metadata',
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  @IsOptional()
  metadata?: Record<string, string>;
}

export class ApproveTaskDto {
  @ApiProperty({
    description: 'Whether to approve the pending checkpoint',
    example: true,
  })
  @IsBoolean()
  approved!: boolean;

  @ApiPropertyOptional({
    description: 'Feedback for the agent',
    example: 'Looks good, proceed with implementation',
    maxLength: 5000,
  })
  @IsString()
  @IsOptional()
  feedback?: string;
}

export class TaskResponseDto {
  @ApiProperty({
    description: 'Task ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'Project ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  projectId!: string;

  @ApiProperty({
    description: 'Task prompt',
    example: 'Add a login page',
  })
  prompt!: string;

  @ApiProperty({
    description: 'Current task status',
    enum: [
      'pending',
      'analyzing',
      'executing',
      'awaiting_approval',
      'completed',
      'failed',
      'aborted',
    ],
    example: 'executing',
  })
  status!: string;

  @ApiPropertyOptional({
    description: 'Task analysis results',
    type: 'object',
  })
  analysis?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Currently executing agent',
    example: 'backend',
  })
  currentAgent?: string;

  @ApiPropertyOptional({
    description: 'List of completed agents',
    type: [String],
    example: ['architect', 'backend'],
  })
  completedAgents?: string[];

  @ApiPropertyOptional({
    description: 'Error message if failed',
  })
  error?: string;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt!: string;

  @ApiPropertyOptional({
    description: 'Last update timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt?: string;
}

export class TaskStatusResponseDto extends TaskResponseDto {
  @ApiPropertyOptional({
    description: 'Whether task is pending user approval',
    example: false,
  })
  pendingApproval?: boolean;

  @ApiPropertyOptional({
    description: 'Checkpoint data',
    type: 'object',
  })
  checkpoint?: Record<string, unknown>;
}
