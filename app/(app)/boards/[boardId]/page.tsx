'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { 
  Plus,
  MoreVertical,
  Calendar,
  User,
  Tag,
  Clock,
  AlertCircle,
  ChevronDown,
  X,
  MessageSquare,
  Paperclip,
  Flag
} from 'lucide-react';
import Modal from '@/components/Modal';

interface Task {
  id: string;
  taskNumber: number;
  title: string;
  description: string | null;
  type: 'story' | 'task' | 'bug' | 'epic' | 'subtask';
  priority: 'lowest' | 'low' | 'medium' | 'high' | 'highest';
  storyPoints: number | null;
  columnId: string;
  sprintId: string | null;
  assignee?: { id: string; username: string; displayName: string | null; avatarUrl: string | null };
  reporter?: { id: string; username: string; displayName: string | null };
  labels?: { id: string; name: string; color: string }[];
  dueDate: string | null;
  sortOrder: number;
  comments?: any[];
}

interface Column {
  id: string;
  name: string;
  color: string | null;
  sortOrder: number;
  wipLimit: number | null;
  tasks: Task[];
}

interface Sprint {
  id: string;
  name: string;
  status: 'planning' | 'active' | 'completed';
  startDate: string | null;
  endDate: string | null;
}

interface Board {
  id: string;
  name: string;
  key: string;
  description: string | null;
  columns: Column[];
  sprints: Sprint[];
  labels: { id: string; name: string; color: string }[];
  myPermission: 'read' | 'write' | 'admin';
}

const TASK_TYPES = [
  { value: 'story', label: 'Story', icon: '📖', color: '#10b981' },
  { value: 'task', label: 'Task', icon: '✓', color: '#3b82f6' },
  { value: 'bug', label: 'Bug', icon: '🐛', color: '#ef4444' },
  { value: 'epic', label: 'Epic', icon: '⚡', color: '#8b5cf6' },
  { value: 'subtask', label: 'Subtask', icon: '📋', color: '#6b7280' }
];

const PRIORITIES = [
  { value: 'highest', label: 'Highest', icon: '⬆️⬆️', color: '#ef4444' },
  { value: 'high', label: 'High', icon: '⬆️', color: '#f97316' },
  { value: 'medium', label: 'Medium', icon: '➡️', color: '#eab308' },
  { value: 'low', label: 'Low', icon: '⬇️', color: '#22c55e' },
  { value: 'lowest', label: 'Lowest', icon: '⬇️⬇️', color: '#6b7280' }
];

export default function BoardPage() {
  const params = useParams();
  const boardId = params.boardId as string;
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSprint, setActiveSprint] = useState<string | null>(null);
  
  // Task modal state
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskForm, setTaskForm] = useState<{
    title: string;
    description: string;
    type: 'story' | 'task' | 'bug' | 'epic' | 'subtask';
    priority: 'lowest' | 'low' | 'medium' | 'high' | 'highest';
    columnId: string;
    sprintId: string;
    assigneeId: string;
    storyPoints: string;
    dueDate: string;
    labelIds: string[];
  }>({
    title: '',
    description: '',
    type: 'task',
    priority: 'medium',
    columnId: '',
    sprintId: '',
    assigneeId: '',
    storyPoints: '',
    dueDate: '',
    labelIds: []
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Quick add state
  const [quickAddColumn, setQuickAddColumn] = useState<string | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState('');

  // Drag state
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  useEffect(() => {
    loadBoard();
  }, [boardId]);

  useEffect(() => {
    const taskId = searchParams.get('task');
    if (taskId && board) {
      const task = board.columns.flatMap(c => c.tasks).find(t => t.id === taskId);
      if (task) {
        openTaskModal(task);
      }
    }
  }, [searchParams, board]);

  const loadBoard = async () => {
    try {
      const res = await fetch(`/api/boards/${boardId}`);
      const data = await res.json();
      
      if (!res.ok) {
        router.push('/boards');
        return;
      }
      
      setBoard(data.board);
      
      // Set active sprint
      const active = data.board.sprints?.find((s: Sprint) => s.status === 'active');
      setActiveSprint(active?.id || null);
    } catch (error) {
      console.error('Error loading board:', error);
    } finally {
      setLoading(false);
    }
  };

  const openTaskModal = (task?: Task) => {
    if (task) {
      setSelectedTask(task);
      setTaskForm({
        title: task.title,
        description: task.description || '',
        type: task.type,
        priority: task.priority,
        columnId: task.columnId,
        sprintId: task.sprintId || '',
        assigneeId: task.assignee?.id || '',
        storyPoints: task.storyPoints?.toString() || '',
        dueDate: task.dueDate ? task.dueDate.split('T')[0] : '',
        labelIds: task.labels?.map(l => l.id) || []
      });
    } else {
      setSelectedTask(null);
      setTaskForm({
        title: '',
        description: '',
        type: 'task',
        priority: 'medium',
        columnId: board?.columns[0]?.id || '',
        sprintId: activeSprint || '',
        assigneeId: '',
        storyPoints: '',
        dueDate: '',
        labelIds: []
      });
    }
    setShowTaskModal(true);
    setError('');
  };

  const handleSaveTask = async () => {
    if (!taskForm.title.trim()) {
      setError('Task title is required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const url = selectedTask 
        ? `/api/boards/${boardId}/tasks/${selectedTask.id}`
        : `/api/boards/${boardId}/tasks`;
      
      const res = await fetch(url, {
        method: selectedTask ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...taskForm,
          storyPoints: taskForm.storyPoints ? parseInt(taskForm.storyPoints) : null,
          sprintId: taskForm.sprintId || null,
          assigneeId: taskForm.assigneeId || null
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to save task');
        return;
      }

      setShowTaskModal(false);
      loadBoard();
    } catch (error) {
      setError('Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickAdd = async (columnId: string) => {
    if (!quickAddTitle.trim()) return;

    try {
      const res = await fetch(`/api/boards/${boardId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: quickAddTitle,
          columnId,
          sprintId: activeSprint
        })
      });

      if (res.ok) {
        setQuickAddColumn(null);
        setQuickAddTitle('');
        loadBoard();
      }
    } catch (error) {
      console.error('Quick add error:', error);
    }
  };

  const handleDragStart = (task: Task) => {
    setDraggedTask(task);
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDragOverColumn(columnId);
  };

  const handleDrop = async (columnId: string) => {
    if (!draggedTask || draggedTask.columnId === columnId) {
      setDraggedTask(null);
      setDragOverColumn(null);
      return;
    }

    try {
      await fetch(`/api/boards/${boardId}/tasks/${draggedTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columnId })
      });
      loadBoard();
    } catch (error) {
      console.error('Move task error:', error);
    }

    setDraggedTask(null);
    setDragOverColumn(null);
  };

  const handleDeleteTask = async () => {
    if (!selectedTask) return;
    
    if (!confirm(`Delete "${board?.key}-${selectedTask.taskNumber}: ${selectedTask.title}"?`)) return;

    try {
      await fetch(`/api/boards/${boardId}/tasks/${selectedTask.id}`, {
        method: 'DELETE'
      });
      setShowTaskModal(false);
      loadBoard();
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const getTypeInfo = (type: string) => TASK_TYPES.find(t => t.value === type) || TASK_TYPES[1];
  const getPriorityInfo = (priority: string) => PRIORITIES.find(p => p.value === priority) || PRIORITIES[2];

  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner" />
      </div>
    );
  }

  if (!board) {
    return null;
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span className="board-key-badge">{board.key}</span>
            <h1>{board.name}</h1>
          </div>
          {board.description && <p className="text-muted">{board.description}</p>}
        </div>
        <div className="flex gap-2">
          {board.sprints.length > 0 && (
            <select 
              className="form-input"
              value={activeSprint || ''}
              onChange={(e) => setActiveSprint(e.target.value || null)}
              style={{ width: '200px' }}
            >
              <option value="">All Tasks (Backlog)</option>
              {board.sprints.map(sprint => (
                <option key={sprint.id} value={sprint.id}>
                  {sprint.name} {sprint.status === 'active' ? '(Active)' : ''}
                </option>
              ))}
            </select>
          )}
          {board.myPermission !== 'read' && (
            <button className="btn btn-primary" onClick={() => openTaskModal()}>
              <Plus size={18} />
              Create Task
            </button>
          )}
        </div>
      </div>

      <div className="kanban-board">
        {board.columns.map(column => {
          const columnTasks = column.tasks.filter(t => 
            !activeSprint || t.sprintId === activeSprint || !t.sprintId
          );
          
          return (
            <div 
              key={column.id}
              className={`kanban-column ${dragOverColumn === column.id ? 'drag-over' : ''}`}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDrop={() => handleDrop(column.id)}
            >
              <div className="kanban-column-header" style={{ borderTopColor: column.color || '#6366f1' }}>
                <span className="column-name">{column.name}</span>
                <span className="column-count">{columnTasks.length}</span>
                {column.wipLimit && columnTasks.length > column.wipLimit && (
                  <span className="wip-warning" title="WIP limit exceeded">
                    <AlertCircle size={14} />
                  </span>
                )}
              </div>

              <div className="kanban-column-content">
                {columnTasks.map(task => {
                  const typeInfo = getTypeInfo(task.type);
                  const priorityInfo = getPriorityInfo(task.priority);
                  
                  return (
                    <div
                      key={task.id}
                      className={`task-card ${draggedTask?.id === task.id ? 'dragging' : ''}`}
                      draggable={board.myPermission !== 'read'}
                      onDragStart={() => handleDragStart(task)}
                      onClick={() => openTaskModal(task)}
                    >
                      <div className="task-card-header">
                        <span className="task-type" style={{ color: typeInfo.color }} title={typeInfo.label}>
                          {typeInfo.icon}
                        </span>
                        <span className="task-key">{board.key}-{task.taskNumber}</span>
                      </div>
                      
                      <div className="task-title">{task.title}</div>
                      
                      {task.labels && task.labels.length > 0 && (
                        <div className="task-labels">
                          {task.labels.slice(0, 3).map(label => (
                            <span 
                              key={label.id} 
                              className="task-label"
                              style={{ backgroundColor: label.color + '30', color: label.color }}
                            >
                              {label.name}
                            </span>
                          ))}
                          {task.labels.length > 3 && (
                            <span className="task-label-more">+{task.labels.length - 3}</span>
                          )}
                        </div>
                      )}

                      <div className="task-card-footer">
                        <div className="task-meta">
                          <span className="priority-icon" style={{ color: priorityInfo.color }} title={priorityInfo.label}>
                            <Flag size={12} />
                          </span>
                          {task.storyPoints && (
                            <span className="story-points">{task.storyPoints}</span>
                          )}
                          {task.dueDate && (
                            <span className="due-date">
                              <Calendar size={12} />
                              {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                        {task.assignee && (
                          <div 
                            className="task-assignee" 
                            title={task.assignee.displayName || task.assignee.username}
                          >
                            {task.assignee.displayName?.[0]?.toUpperCase() || task.assignee.username[0].toUpperCase()}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Quick Add */}
                {board.myPermission !== 'read' && (
                  <>
                    {quickAddColumn === column.id ? (
                      <div className="quick-add-form">
                        <input
                          type="text"
                          className="form-input"
                          placeholder="What needs to be done?"
                          value={quickAddTitle}
                          onChange={(e) => setQuickAddTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleQuickAdd(column.id);
                            if (e.key === 'Escape') setQuickAddColumn(null);
                          }}
                          autoFocus
                        />
                        <div className="quick-add-actions">
                          <button className="btn btn-primary btn-sm" onClick={() => handleQuickAdd(column.id)}>
                            Add
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setQuickAddColumn(null)}>
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button 
                        className="quick-add-btn"
                        onClick={() => setQuickAddColumn(column.id)}
                      >
                        <Plus size={16} />
                        Add task
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Task Modal */}
      <Modal
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        title={selectedTask ? `${board.key}-${selectedTask.taskNumber}` : 'Create Task'}
        size="large"
        footer={
          <>
            {selectedTask && board.myPermission !== 'read' && (
              <button className="btn btn-danger" onClick={handleDeleteTask} style={{ marginRight: 'auto' }}>
                Delete
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => setShowTaskModal(false)}>Cancel</button>
            {board.myPermission !== 'read' && (
              <button className="btn btn-primary" onClick={handleSaveTask} disabled={saving}>
                {saving ? <span className="spinner" /> : selectedTask ? 'Save Changes' : 'Create Task'}
              </button>
            )}
          </>
        }
      >
        {error && <div className="alert alert-error mb-4">{error}</div>}
        
        <div className="task-form-grid">
          <div className="task-form-main">
            <div className="form-group">
              <input
                type="text"
                className="form-input task-title-input"
                value={taskForm.title}
                onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                placeholder="Task title"
                disabled={board.myPermission === 'read'}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-input form-textarea"
                value={taskForm.description}
                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                placeholder="Add a description..."
                rows={6}
                disabled={board.myPermission === 'read'}
              />
            </div>
          </div>

          <div className="task-form-sidebar">
            <div className="form-group">
              <label className="form-label">Type</label>
              <select
                className="form-input"
                value={taskForm.type}
                onChange={(e) => setTaskForm({ ...taskForm, type: e.target.value as any })}
                disabled={board.myPermission === 'read'}
              >
                {TASK_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.icon} {type.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Priority</label>
              <select
                className="form-input"
                value={taskForm.priority}
                onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as any })}
                disabled={board.myPermission === 'read'}
              >
                {PRIORITIES.map(priority => (
                  <option key={priority.value} value={priority.value}>{priority.icon} {priority.label}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Status</label>
              <select
                className="form-input"
                value={taskForm.columnId}
                onChange={(e) => setTaskForm({ ...taskForm, columnId: e.target.value })}
                disabled={board.myPermission === 'read'}
              >
                {board.columns.map(col => (
                  <option key={col.id} value={col.id}>{col.name}</option>
                ))}
              </select>
            </div>

            {board.sprints.length > 0 && (
              <div className="form-group">
                <label className="form-label">Sprint</label>
                <select
                  className="form-input"
                  value={taskForm.sprintId}
                  onChange={(e) => setTaskForm({ ...taskForm, sprintId: e.target.value })}
                  disabled={board.myPermission === 'read'}
                >
                  <option value="">Backlog</option>
                  {board.sprints.map(sprint => (
                    <option key={sprint.id} value={sprint.id}>{sprint.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Story Points</label>
              <input
                type="number"
                className="form-input"
                value={taskForm.storyPoints}
                onChange={(e) => setTaskForm({ ...taskForm, storyPoints: e.target.value })}
                placeholder="0"
                min="0"
                disabled={board.myPermission === 'read'}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Due Date</label>
              <input
                type="date"
                className="form-input"
                value={taskForm.dueDate}
                onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                disabled={board.myPermission === 'read'}
              />
            </div>

            {board.labels.length > 0 && (
              <div className="form-group">
                <label className="form-label">Labels</label>
                <div className="label-picker">
                  {board.labels.map(label => (
                    <label 
                      key={label.id}
                      className={`label-option ${taskForm.labelIds.includes(label.id) ? 'selected' : ''}`}
                      style={{ '--label-color': label.color } as any}
                    >
                      <input
                        type="checkbox"
                        checked={taskForm.labelIds.includes(label.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setTaskForm({ ...taskForm, labelIds: [...taskForm.labelIds, label.id] });
                          } else {
                            setTaskForm({ ...taskForm, labelIds: taskForm.labelIds.filter(id => id !== label.id) });
                          }
                        }}
                        disabled={board.myPermission === 'read'}
                      />
                      <span className="label-color" style={{ backgroundColor: label.color }} />
                      {label.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>

      <style jsx>{`
        .board-key-badge {
          padding: 0.25rem 0.75rem;
          background: var(--glass-bg);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-sm);
          font-size: 0.875rem;
          font-weight: 600;
          font-family: monospace;
          color: var(--primary-color);
        }
        
        .kanban-board {
          display: flex;
          gap: 1rem;
          padding: 1rem;
          overflow-x: auto;
          min-height: calc(100vh - 200px);
        }
        
        .kanban-column {
          flex: 0 0 300px;
          background: var(--glass-bg);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-lg);
          display: flex;
          flex-direction: column;
          max-height: calc(100vh - 220px);
        }
        
        .kanban-column.drag-over {
          border-color: var(--primary-color);
          background: rgba(139, 92, 246, 0.1);
        }
        
        .kanban-column-header {
          padding: 1rem;
          border-top: 3px solid;
          border-radius: var(--radius-lg) var(--radius-lg) 0 0;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .column-name {
          font-weight: 600;
          flex: 1;
        }
        
        .column-count {
          background: var(--glass-bg-hover);
          padding: 0.125rem 0.5rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          color: var(--text-muted);
        }
        
        .wip-warning {
          color: var(--warning-color);
        }
        
        .kanban-column-content {
          flex: 1;
          overflow-y: auto;
          padding: 0.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        
        .task-card {
          background: rgba(30, 30, 60, 0.8);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-md);
          padding: 0.75rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .task-card:hover {
          border-color: var(--primary-color);
          transform: translateY(-1px);
        }
        
        .task-card.dragging {
          opacity: 0.5;
        }
        
        .task-card-header {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          margin-bottom: 0.5rem;
        }
        
        .task-type {
          font-size: 0.875rem;
        }
        
        .task-key {
          font-size: 0.75rem;
          color: var(--text-muted);
          font-family: monospace;
        }
        
        .task-title {
          font-size: 0.875rem;
          font-weight: 500;
          margin-bottom: 0.5rem;
          line-height: 1.4;
        }
        
        .task-labels {
          display: flex;
          gap: 0.25rem;
          flex-wrap: wrap;
          margin-bottom: 0.5rem;
        }
        
        .task-label {
          font-size: 0.625rem;
          padding: 0.125rem 0.375rem;
          border-radius: 9999px;
          font-weight: 500;
        }
        
        .task-label-more {
          font-size: 0.625rem;
          color: var(--text-muted);
        }
        
        .task-card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .task-meta {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .priority-icon {
          display: flex;
        }
        
        .story-points {
          background: var(--glass-bg-hover);
          padding: 0.125rem 0.375rem;
          border-radius: var(--radius-sm);
          font-size: 0.625rem;
          font-weight: 600;
        }
        
        .due-date {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.625rem;
          color: var(--text-muted);
        }
        
        .task-assignee {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--primary-color), #ec4899);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.625rem;
          font-weight: 600;
        }
        
        .quick-add-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          width: 100%;
          padding: 0.5rem;
          background: transparent;
          border: 1px dashed var(--glass-border);
          border-radius: var(--radius-md);
          color: var(--text-muted);
          cursor: pointer;
          font-size: 0.875rem;
          transition: all 0.2s ease;
        }
        
        .quick-add-btn:hover {
          border-color: var(--primary-color);
          color: var(--primary-color);
        }
        
        .quick-add-form {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        
        .quick-add-actions {
          display: flex;
          gap: 0.5rem;
        }
        
        .task-form-grid {
          display: grid;
          grid-template-columns: 1fr 280px;
          gap: 1.5rem;
        }
        
        .task-title-input {
          font-size: 1.25rem;
          font-weight: 600;
          border: none;
          background: transparent;
          padding: 0;
        }
        
        .task-title-input:focus {
          outline: none;
          box-shadow: none;
        }
        
        .label-picker {
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
        }
        
        .label-option {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.375rem 0.5rem;
          border-radius: var(--radius-sm);
          cursor: pointer;
          font-size: 0.875rem;
        }
        
        .label-option:hover {
          background: var(--glass-bg-hover);
        }
        
        .label-option.selected {
          background: var(--glass-bg-active);
        }
        
        .label-option input {
          display: none;
        }
        
        .label-color {
          width: 12px;
          height: 12px;
          border-radius: 2px;
        }
        
        @media (max-width: 768px) {
          .task-form-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}
