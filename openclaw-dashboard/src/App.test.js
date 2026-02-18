import { fireEvent, render, screen, within } from '@testing-library/react';

jest.mock('./config/runtimeConfig', () => ({
  runtimeConfig: {
    liveDataEnabled: false,
    openclawApiBaseUrl: '',
    openclawWsUrl: '',
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
  expect(screen.getByLabelText(/message openclaw/i)).toBeInTheDocument();
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
  expect(screen.getAllByText(/OpenClaw Core/i).length).toBeGreaterThan(0);

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

  fireEvent.change(screen.getByLabelText(/message openclaw/i), {
    target: { value: 'What is the next priority?' }
  });

  fireEvent.click(screen.getByRole('button', { name: /send to openclaw/i }));

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
