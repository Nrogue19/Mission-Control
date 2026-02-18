import React, { useState } from 'react';

// Types
interface Task {
  id: string;
  title: string;
  description: string;
  column: string;
  assignee: string | null;
  assigneeInitial: string | null;
  time: string;
}

interface Agent {
  name: string;
  role: string;
}

interface TaskModalProps {
  task: Task;
  agents: Agent[];
  onClose: () => void;
  onSave: (task: Task) => void;
  onDelete: (taskId: string) => void;
}

// TaskModal Component - Extracted from MissionControl.jsx
export const TaskModal: React.FC<TaskModalProps> = ({ task, agents, onClose, onSave, onDelete }) => {
  const [editedTask, setEditedTask] = useState<Task>(task);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(editedTask);
  };

  const handleChange = (field: keyof Task, value: string) => {
    setEditedTask(prev => ({ ...prev, [field]: value }));
  };

  const handleAssigneeChange = (agentName: string) => {
    const agent = agents.find(a => a.name === agentName);
    setEditedTask(prev => ({
      ...prev,
      assignee: agentName || null,
      assigneeInitial: agent ? agent.name.charAt(0).toUpperCase() : null
    }));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="modal-header">
            <h2 className="modal-title">Edit Task</h2>
            <button type="button" className="modal-close" onClick={onClose}>✕</button>
          </div>

          <div className="modal-content">
            <div className="modal-section">
              <label className="modal-label">Title</label>
              <input
                type="text"
                className="modal-input"
                value={editedTask.title}
                onChange={(e) => handleChange('title', e.target.value)}
                required
              />
            </div>

            <div className="modal-section">
              <label className="modal-label">Description</label>
              <textarea
                className="modal-textarea"
                value={editedTask.description}
                onChange={(e) => handleChange('description', e.target.value)}
                required
              />
            </div>

            <div className="modal-row">
              <div className="modal-section">
                <label className="modal-label">Status</label>
                <select
                  className="modal-select"
                  value={editedTask.column}
                  onChange={(e) => handleChange('column', e.target.value)}
                >
                  <option value="inbox">Inbox</option>
                  <option value="assigned">Assigned</option>
                  <option value="progress">In Progress</option>
                  <option value="review">Review</option>
                </select>
              </div>

              <div className="modal-section">
                <label className="modal-label">Assignee</label>
                <select
                  className="modal-select"
                  value={editedTask.assignee || ''}
                  onChange={(e) => handleAssigneeChange(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {agents.map(agent => (
                    <option key={agent.name} value={agent.name}>
                      {agent.name} - {agent.role}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="modal-section">
              <label className="modal-label">Due Date</label>
              <input
                type="text"
                className="modal-input"
                value={editedTask.time}
                onChange={(e) => handleChange('time', e.target.value)}
                placeholder="e.g., Feb 14"
              />
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="modal-button modal-button-danger"
              onClick={() => {
                if (window.confirm('Are you sure you want to delete this task?')) {
                  onDelete(task.id);
                }
              }}
            >
              Delete
            </button>
            <button
              type="button"
              className="modal-button modal-button-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="modal-button modal-button-primary"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskModal;
