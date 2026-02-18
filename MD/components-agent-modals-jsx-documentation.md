# components/AgentModals.tsx Documentation

## File
`/src/components/AgentModals.jsx`

## Purpose
Extracted modal components for adding and editing agents.

## Key Components

### AddAgentModal
- Form for creating new agents
- Fields: name, role, model, API key
- Validation with error messages
- Submit loading state

### EditAgentModal
- Form for editing existing agents
- Pre-populated with agent data
- Optional API key update
- Validation with error messages

## Key Props
- `agent` - Current agent (for EditAgentModal)
- `onClose` - Callback to close modal
- `onSubmit` - Callback to submit form
- `isSubmitting` - Loading state
- `errorMessage` - Error display

## Related Files
- `MissionControl.jsx` - Parent component
- `Modal.css` - Modal styles
- `TaskModal.jsx` - Task editing modal
