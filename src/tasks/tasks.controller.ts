import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common'
import { TasksService } from './tasks.service'
import {
  CreateTaskDto,
  UpdateTaskStatusDto,
  ApproveTaskDto,
  RejectTaskDto,
  ReassignTaskDto,
  SubmitTaskWorkDto,
  AddTaskCommentDto,
} from './dto/task.dto'
import { AuthenticatedUser } from '../common/auth-user.interface'
import { PermissionsGuard } from '../common/permissions.guard'
import { RequirePermissions } from '../common/require-permissions.decorator'
import { CurrentUser } from '../common/current-user.decorator'

@Controller('tasks')
@UseGuards(PermissionsGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  findAll(
    @Query('projectId') projectId?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('creatorId') creatorId?: string,
    @Query('status') status?: string,
    @Query('teamId') teamId?: string,
  ) {
    return this.tasksService.findAll({ projectId, assigneeId, creatorId, status, teamId })
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tasksService.findOne(id)
  }

  @Post()
  create(@Body() dto: CreateTaskDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.tasksService.create(dto, actor)
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTaskStatusDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.tasksService.updateStatus(id, dto, actor)
  }

  @Post(':id/approve')
  @RequirePermissions('tasks:approve')
  approve(
    @Param('id') id: string,
    @Body() dto: ApproveTaskDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.tasksService.approve(id, dto, actor)
  }

  @Post(':id/reject')
  @RequirePermissions('tasks:reject')
  reject(
    @Param('id') id: string,
    @Body() dto: RejectTaskDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.tasksService.reject(id, dto, actor)
  }

  @Post(':id/reassign')
  @RequirePermissions('tasks:reassign')
  reassign(
    @Param('id') id: string,
    @Body() dto: ReassignTaskDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.tasksService.reassign(id, dto, actor)
  }

  @Patch(':id/checklist/:itemId')
  toggleChecklistItem(
    @Param('id') taskId: string,
    @Param('itemId') itemId: string,
    @Body('completed') completed?: boolean,
  ) {
    return this.tasksService.toggleChecklistItem(taskId, itemId, completed)
  }

  @Post(':id/submissions')
  submitWork(
    @Param('id') taskId: string,
    @Body() dto: SubmitTaskWorkDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.tasksService.submitWork(taskId, dto, actor)
  }

  @Post(':id/comments')
  addComment(
    @Param('id') taskId: string,
    @Body() dto: AddTaskCommentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.tasksService.addComment(taskId, dto, actor)
  }
}
