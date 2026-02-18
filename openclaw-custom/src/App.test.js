import { fireEvent, render, screen, within } from '@testing-library/react';

global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: () => Promise.resolve({
      agents: [
        { id: 'jarvis-1', name: 'Jarvis', role: 'Lead Orchestrator', status: 'awake', initial: 'J' },
        { id: 'friday-2', name: 'Friday', role: 'Task Planner', status: 'working', initial: 'F' }
      ],
      localFiles: [
        { name: 'USER.md', description: 'User profile', icon: '📄', type: 'config', lastModified: 'just now' }
      ],
      tasks: [
        { id: 'task-1', column: 'inbox', title: 'Review testimonials section design', description: 'Check the testimonials section.', time: 'Feb 14', assignee: 'Jarvis', assigneeInitial: 'J' },
        { id: 'task-2', column: 'assigned', title: 'Update landing page copy', description: 'Refresh copy.', time: 'Feb 15', assignee: 'Friday', assigneeInitial: 'F' },
        { id: 'task-3', column: 'progress', title: 'Build API integration', description: 'Connect APIs.', time: 'Feb 16', assignee: 'Jarvis', assigneeInitial: 'J' },
        { id: 'task-4', column: 'review', title: 'Design system audit', description: 'Audit design tokens.', time: 'Feb 17', assignee: 'Friday', assigneeInitial: 'F' }
      ],
      feedItems: [
        { agent: 'Jarvis', action: 'task assigned', message: 'Review testimonials section design', time: '14:30', status: 'green' }
      ],
      chatMessages: [
        { id: 'chat-1', role: 'assistant', author: 'Jarvis', message: 'Mission Control chat is online. Ask for status updates, task plans, or quick summaries.', time: '14:36' }
      ],
      timelineItems: [
        { id: 'tl-1', time: '14:30', agent: 'Jarvis', type: 'workflow', action: 'Jarvis \u2022 Completed task #42', detail: 'Task completed.' },
        { id: 'tl-2', time: '14:31', agent: 'Friday', type: 'task', action: 'Friday \u2022 Started task #43', detail: 'Task started.' }
      ],
      skillIntegrations: [
        { id: 'email-sender', name: 'Email Sender', version: '2.1.0', rating: 5, security: 'safe', summary: 'Send transactional emails.', permissions: ['email.send'], updateAvailable: false },
        { id: 'web-scraper', name: 'Web Scraper', version: '1.5.3', rating: 4, security: 'review', summary: 'Scrape web pages.', permissions: ['http.get'], updateAvailable: true }
      ],
      memorySpaces: [
        { id: 'mission-core', name: 'Mission Core', sizeMb: 18.4, entries: 12420, staleEntries: 520, clusters: ['Agents', 'Tasks', 'Policies', 'Integrations'] },
        { id: 'marketing-site', name: 'Marketing Site', sizeMb: 9.8, entries: 6870, staleEntries: 210, clusters: ['Pages', 'Components', 'Assets', 'Analytics'] }
      ],
      memoryGraphLinks: [
        { from: 'Mission Core', to: 'Mission Queue' }
      ],
      configurationValidator: {
        healthScore: 82,
        issues: [
          { id: 'warn-0', severity: 'warning', title: 'Agent timeout too high', suggestion: 'Lower timeout to 60s.', autoFixLabel: 'Auto Fix', status: 'open' }
        ],
        validatedFiles: [{ name: 'USER.md', status: 'valid' }]
      },
      tokenUsage: { today: 50000, cost: 0.6, budget: 25, topConsumers: [], weeklyTrend: [0,0,0,0,0,0,0], suggestions: [] },
      security: { score: 92, alerts: [], apiKeys: [], recentActivity: [] },
      health: { healthy: 2, degraded: 0, down: 0, systemHealth: [], recentErrors: [], agents: [] }
    })
  })
);

jest.mock('./config/runtimeConfig', () => ({
  runtimeConfig: {
    liveDataEnabled: true,
    missionApiBaseUrl: 'http://localhost:8797',
    missionWsUrl: '',
    requestTimeoutMs: 8000
  }
}));

import App from './App';

beforeEach(() => {
  window.localStorage.clear();
  document.body.classList.remove('dark-mode');
});

test('renders mission queue title', () => {
  render(<App />);
  expect(screen.getByText(/mission queue/i)).toBeInTheDocument();
});

test('renders full-width mission chat section', () => {
  render(<App />);

  expect(screen.getByText(/mission chat/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/message mission control/i)).toBeInTheDocument();
});

test('opens task modal when a task card is clicked', () => {
  render(<App />);

  fireEvent.click(screen.getByText('Review testimonials section design'));

  expect(screen.getByText('Edit Task')).toBeInTheDocument();
  expect(screen.getByDisplayValue('Review testimonials section design')).toBeInTheDocument();
});

test('updates task column on drag and drop', () => {
  render(<App />);

  const taskTitle = 'Review testimonials section design';
  const taskCard = screen.getByText(taskTitle).closest('.task-card');
  const inboxColumn = screen.getByText('INBOX').closest('.kanban-column');
  const assignedColumn = screen.getByText('ASSIGNED').closest('.kanban-column');

  expect(taskCard).not.toBeNull();
  expect(inboxColumn).not.toBeNull();
  expect(assignedColumn).not.toBeNull();
  expect(within(inboxColumn).getByText(taskTitle)).toBeInTheDocument();

  const dataTransfer = {
    data: {},
    setData(key, value) {
      this.data[key] = String(value);
    },
    getData(key) {
      return this.data[key];
    }
  };

  fireEvent.dragStart(taskCard, { dataTransfer });
  fireEvent.drop(assignedColumn, { dataTransfer });

  expect(within(assignedColumn).getByText(taskTitle)).toBeInTheDocument();
  expect(within(inboxColumn).queryByText(taskTitle)).not.toBeInTheDocument();
});

test('applies dark mode class to body when toggled', () => {
  render(<App />);

  fireEvent.click(screen.getByRole('button', { name: /toggle dark mode/i }));

  expect(document.body).toHaveClass('dark-mode');
});

test('emergency stop locks interactions and prevents drag/drop moves', () => {
  render(<App />);

  fireEvent.click(screen.getByRole('button', { name: /stop all agents/i }));

  expect(screen.getByText(/emergency stop active/i)).toBeInTheDocument();
  expect(screen.getByText(/interaction locked/i)).toBeInTheDocument();

  const taskTitle = 'Review testimonials section design';
  const taskCard = screen.getByText(taskTitle).closest('.task-card');
  const inboxColumn = screen.getByText('INBOX').closest('.kanban-column');
  const assignedColumn = screen.getByText('ASSIGNED').closest('.kanban-column');

  const dataTransfer = {
    data: {},
    setData(key, value) {
      this.data[key] = String(value);
    },
    getData(key) {
      return this.data[key];
    }
  };

  fireEvent.dragStart(taskCard, { dataTransfer });
  fireEvent.drop(assignedColumn, { dataTransfer });

  expect(within(inboxColumn).getByText(taskTitle)).toBeInTheDocument();
  expect(within(assignedColumn).queryByText(taskTitle)).not.toBeInTheDocument();
});

test('timeline tab supports filtering by agent', () => {
  render(<App />);

  fireEvent.click(screen.getByText('Timeline'));

  fireEvent.change(screen.getByLabelText(/filter timeline by agent/i), {
    target: { value: 'Friday' }
  });

  expect(screen.getByText(/Friday • Started task #43/i)).toBeInTheDocument();
  expect(screen.queryByText(/Jarvis • Completed task #42/i)).not.toBeInTheDocument();
});

test('skills tab renders integration manager cards', () => {
  render(<App />);

  fireEvent.click(screen.getByText('Skills'));

  expect(screen.getByText(/Email Sender v2\.1\.0/i)).toBeInTheDocument();
  expect(screen.getByText(/Web Scraper v1\.5\.3/i)).toBeInTheDocument();
  expect(screen.getByText(/Review needed/i)).toBeInTheDocument();
});

test('memory tab renders memory manager details and supports space switching', () => {
  render(<App />);

  fireEvent.click(screen.getByText('Memory'));

  expect(screen.getByText(/Total Memory/i)).toBeInTheDocument();
  expect(screen.getAllByText(/Mission Core/i).length).toBeGreaterThan(0);

  fireEvent.click(screen.getByRole('button', { name: /Marketing Site/i }));

  expect(screen.getAllByText(/Marketing Site/i).length).toBeGreaterThan(0);
  expect(screen.getByText(/Context isolation enabled/i)).toBeInTheDocument();
});

test('config tab can apply quick fixes', () => {
  render(<App />);

  fireEvent.click(screen.getByText('Config'));

  expect(screen.getByText(/Configuration Health Score/i)).toBeInTheDocument();

  fireEvent.click(screen.getAllByRole('button', { name: 'Auto Fix' })[0]);

  expect(screen.getByText(/Status: fixed/i)).toBeInTheDocument();
});

test('shows mock data mode when live integration is disabled', () => {
  render(<App />);

  expect(screen.getAllByText(/Mock data/i).length).toBeGreaterThan(0);
});

test('mission chat sends local response while in mock mode', () => {
  render(<App />);

  fireEvent.change(screen.getByLabelText(/message mission control/i), {
    target: { value: 'What is the next priority?' }
  });

  fireEvent.click(screen.getByRole('button', { name: /send/i }));

  expect(screen.getAllByText(/What is the next priority\?/i).length).toBeGreaterThan(0);
  expect(screen.getByText(/Working in local mode\./i)).toBeInTheDocument();
});

test('add agent modal adds a working agent in mock mode', () => {
  render(<App />);

  fireEvent.click(screen.getByRole('button', { name: /\+ add agent/i }));

  fireEvent.change(screen.getByLabelText(/agent name/i), {
    target: { value: 'Athena' }
  });
  fireEvent.change(screen.getByLabelText(/^role$/i), {
    target: { value: 'Mission Planner' }
  });
  fireEvent.change(screen.getByLabelText(/ai model/i), {
    target: { value: 'gpt-4.1-mini' }
  });
  fireEvent.change(screen.getByLabelText(/api key/i), {
    target: { value: 'sk-test-1234567890abcd' }
  });

  fireEvent.click(screen.getByRole('button', { name: /^add agent$/i }));

  expect(screen.getByText('Athena')).toBeInTheDocument();
  expect(screen.getByText('Mission Planner')).toBeInTheDocument();
  expect(screen.getByText(/^working$/i)).toBeInTheDocument();
});
