# components/TaskModal.tsx Documentation

## File
`/src/components/TaskModal.jsx`

## Purpose
Extracted modal component for editing task details.

## Key Props
- `task` - Current task object
- `agents` - List of agents for assignment
- `onClose` - Callback to close modal
- `onSave` - Callback to save changes
- `onDelete` - Callback to delete task

## Features
- Edit title, description, status, assignee, due date
- Form validation
- Delete confirmation
- Responsive design

## Related Files
- `MissionControl.jsx` - Parent component
- `Modal.css` - Modal styles
- `AgentModals.jsx` - Other modal components
