import React, { useState, useEffect } from 'react';

// Types
interface Agent {
  id?: string;
  name: string;
  role: string;
  model: string;
  apiKey?: string;
}

interface AgentModalProps {
  onClose: () => void;
  onSubmit: (agent: Agent) => void;
  isSubmitting: boolean;
  errorMessage?: string;
}

interface EditAgentModalProps extends AgentModalProps {
  agent: Agent | null;
}

// Helper function
const normalizeAgentName = (value: string | undefined): string => String(value || '').trim();

// AddAgentModal Component
export const AddAgentModal: React.FC<AgentModalProps> = ({ onClose, onSubmit, isSubmitting, errorMessage }) => {
  const [formState, setFormState] = useState<Agent>({
    name: '',
    role: '',
    model: '',
    apiKey: ''
  });
  const [localError, setLocalError] = useState<string>('');

  const handleChange = (field: keyof Agent, value: string) => {
    setFormState((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextFormState: Agent = {
      name: normalizeAgentName(formState.name),
      role: normalizeAgentName(formState.role),
      model: normalizeAgentName(formState.model),
      apiKey: String(formState.apiKey || '').trim()
    };

    if (!nextFormState.name || !nextFormState.role || !nextFormState.model || !nextFormState.apiKey) {
      setLocalError('All fields are required to add an agent.');
      return;
    }

    setLocalError('');
    onSubmit(nextFormState);
  };

  return (
    <div className="modal-overlay" onClick={() => !isSubmitting && onClose()}>
      <div className="modal modal-agent-create" onClick={(event) => event.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="modal-header">
            <h2 className="modal-title">Add Agent</h2>
            <button
              type="button"
              className="modal-close"
              onClick={onClose}
              disabled={isSubmitting}
              aria-label="Close add agent dialog"
            >
              x
            </button>
          </div>

          <div className="modal-content">
            <div className="modal-section">
              <label className="modal-label" htmlFor="agent-name-input">Agent Name</label>
              <input
                id="agent-name-input"
                type="text"
                className="modal-input"
                value={formState.name}
                onChange={(event) => handleChange('name', event.target.value)}
                placeholder="e.g. Athena"
                required
              />
            </div>

            <div className="modal-section">
              <label className="modal-label" htmlFor="agent-role-input">Role</label>
              <input
                id="agent-role-input"
                type="text"
                className="modal-input"
                value={formState.role}
                onChange={(event) => handleChange('role', event.target.value)}
                placeholder="e.g. Incident Analyst"
                required
              />
            </div>

            <div className="modal-section">
              <label className="modal-label" htmlFor="agent-model-input">AI Model</label>
              <input
                id="agent-model-input"
                type="text"
                className="modal-input"
                value={formState.model}
                onChange={(event) => handleChange('model', event.target.value)}
                placeholder="e.g. gpt-4.1-mini"
                required
              />
            </div>

            <div className="modal-section">
              <label className="modal-label" htmlFor="agent-api-key-input">API Key</label>
              <input
                id="agent-api-key-input"
                type="password"
                className="modal-input"
                value={formState.apiKey}
                onChange={(event) => handleChange('apiKey', event.target.value)}
                autoComplete="new-password"
                placeholder="Paste API key"
                required
              />
            </div>

            {(localError || errorMessage) && (
              <div className="agent-create-error" role="alert">
                {localError || errorMessage}
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="modal-button modal-button-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="modal-button modal-button-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Adding...' : 'Add Agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// EditAgentModal Component
export const EditAgentModal: React.FC<EditAgentModalProps> = ({ agent, onClose, onSubmit, isSubmitting, errorMessage }) => {
  const [formState, setFormState] = useState<Agent>({
    name: normalizeAgentName(agent?.name),
    role: normalizeAgentName(agent?.role),
    model: normalizeAgentName(agent?.model || ''),
    apiKey: ''
  });
  const [localError, setLocalError] = useState<string>('');

  useEffect(() => {
    setFormState({
      name: normalizeAgentName(agent?.name),
      role: normalizeAgentName(agent?.role),
      model: normalizeAgentName(agent?.model || ''),
      apiKey: ''
    });
    setLocalError('');
  }, [agent]);

  const handleChange = (field: keyof Agent, value: string) => {
    setFormState((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const nextPayload: Agent = {
      id: agent?.id || '',
      name: normalizeAgentName(formState.name),
      role: normalizeAgentName(formState.role),
      model: normalizeAgentName(formState.model),
      apiKey: String(formState.apiKey || '').trim()
    };

    if (!nextPayload.name || !nextPayload.role || !nextPayload.model) {
      setLocalError('Agent name, role, and model are required.');
      return;
    }

    setLocalError('');
    onSubmit(nextPayload);
  };

  return (
    <div className="modal-overlay" onClick={() => !isSubmitting && onClose()}>
      <div className="modal modal-agent-create" onClick={(event) => event.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="modal-header">
            <h2 className="modal-title">Edit Agent</h2>
            <button
              type="button"
              className="modal-close"
              onClick={onClose}
              disabled={isSubmitting}
              aria-label="Close edit agent dialog"
            >
              x
            </button>
          </div>

          <div className="modal-content">
            <div className="modal-section">
              <label className="modal-label" htmlFor="edit-agent-name-input">Agent Name</label>
              <input
                id="edit-agent-name-input"
                type="text"
                className="modal-input"
                value={formState.name}
                onChange={(event) => handleChange('name', event.target.value)}
                required
              />
            </div>

            <div className="modal-section">
              <label className="modal-label" htmlFor="edit-agent-role-input">Role</label>
              <input
                id="edit-agent-role-input"
                type="text"
                className="modal-input"
                value={formState.role}
                onChange={(event) => handleChange('role', event.target.value)}
                required
              />
            </div>

            <div className="modal-section">
              <label className="modal-label" htmlFor="edit-agent-model-input">AI Model</label>
              <input
                id="edit-agent-model-input"
                type="text"
                className="modal-input"
                value={formState.model}
                onChange={(event) => handleChange('model', event.target.value)}
                required
              />
            </div>

            <div className="modal-section">
              <label className="modal-label" htmlFor="edit-agent-api-key-input">API Key (optional)</label>
              <input
                id="edit-agent-api-key-input"
                type="password"
                className="modal-input"
                value={formState.apiKey}
                onChange={(event) => handleChange('apiKey', event.target.value)}
                autoComplete="new-password"
                placeholder="Leave blank to keep current key"
              />
            </div>

            {(localError || errorMessage) && (
              <div className="agent-create-error" role="alert">
                {localError || errorMessage}
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="modal-button modal-button-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="modal-button modal-button-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save Agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default { AddAgentModal, EditAgentModal };
