// data.js - All data for OpenClaw Mission Control

export const agentColors = {
  'Garry': '#ec4899',
  'Friday': '#f59e0b',
  'Fury': '#8b5cf6',
  'Coach': '#10b981',
  'Loki': '#f59e0b',
  'Pepper': '#ef4444',
  'Quill': '#f59e0b',
  'Shuri': '#ec4899',
  'Vision': '#6366f1',
  'Wanda': '#10b981',
  'Wong': '#10b981'
};

export const agents = [
  { name: 'Garry', role: 'Big Brains', status: 'awake', initial: 'G' },
  { name: 'Friday', role: 'Developer', status: 'idle', initial: 'F' },
  { name: 'Fury', role: 'Customer Researcher', status: 'idle', initial: 'F' },
  { name: 'Coach', role: 'Coach Entrepreneur', status: 'idle', initial: 'C' },
  { name: 'Loki', role: 'Content Writer', status: 'idle', initial: 'L' },
  { name: 'Pepper', role: 'Email Marketing Spec', status: 'idle', initial: 'P' },
  { name: 'Quill', role: 'Social Media Manager', status: 'idle', initial: 'Q' },
  { name: 'Shuri', role: 'Product Analyst', status: 'idle', initial: 'S' },
  { name: 'Vision', role: 'SEO Analyst', status: 'idle', initial: 'V' },
  { name: 'Wanda', role: 'Designer', status: 'idle', initial: 'W' },
  { name: 'Wong', role: 'Documentation Spec', status: 'idle', initial: 'W' }
];

export const localFiles = [
  {
    name: 'USER.md',
    description: 'User profile & preferences',
    icon: '👤',
    type: 'config',
    lastModified: '2 hours ago',
    path: './USER.md'
  },
  {
    name: 'AGENT.md',
    description: 'Agent configuration',
    icon: '🤖',
    type: 'config',
    lastModified: '1 day ago',
    path: './AGENT.md'
  },
  {
    name: 'SOUL.md',
    description: 'Personality & behavior rules',
    icon: '✨',
    type: 'config',
    lastModified: '3 days ago',
    path: './SOUL.md'
  },
  {
    name: 'HEARTBEAT.md',
    description: 'Background monitoring checklist',
    icon: '💓',
    type: 'schedule',
    lastModified: '5 hours ago',
    path: './HEARTBEAT.md'
  },
  {
    name: 'MEMORY.md',
    description: 'Long-term memory storage',
    icon: '🧠',
    type: 'data',
    lastModified: '30 mins ago',
    path: './MEMORY.md'
  },
  {
    name: 'CRON.md',
    description: 'Scheduled tasks & jobs',
    icon: '⏰',
    type: 'schedule',
    lastModified: '1 day ago',
    path: './CRON.md'
  },
  {
    name: 'TOOLS.md',
    description: 'Tool configurations',
    icon: '🔧',
    type: 'config',
    lastModified: '2 days ago',
    path: './TOOLS.md'
  }
];

export const tasks = [
  {
    id: 1,
    column: 'inbox',
    title: 'Review testimonials section design',
    description: 'Review and modernize the testimonials section of the website...',
    time: 'Feb 14',
    assignee: null
  },
  {
    id: 2,
    column: 'inbox',
    title: 'Add FAQ section',
    description: 'Create a new FAQ section with frequently asked questions...',
    time: 'Feb 15',
    assignee: null
  },
  {
    id: 3,
    column: 'assigned',
    title: 'Fix ARIA accessibility',
    description: 'Add ARIA labels, alt text on all images, and improve accessibility...',
    time: 'Feb 10',
    assignee: 'Wanda',
    assigneeInitial: 'W'
  },
  {
    id: 4,
    column: 'assigned',
    title: 'Improve mobile menu animation',
    description: 'Improve transitions and animations of the mobile burger menu...',
    time: 'Feb 11',
    assignee: 'Vision',
    assigneeInitial: 'V'
  },
  {
    id: 5,
    column: 'assigned',
    title: 'Add floating WhatsApp button',
    description: 'Add a floating WhatsApp button at the bottom right of the page...',
    time: 'Feb 11',
    assignee: 'Loki',
    assigneeInitial: 'L'
  },
  {
    id: 6,
    column: 'assigned',
    title: 'Optimize loading performance',
    description: 'Optimize page loading speed and improve performance metrics...',
    time: 'Feb 10',
    assignee: 'Quill',
    assigneeInitial: 'Q'
  },
  {
    id: 7,
    column: 'progress',
    title: 'Optimize website images',
    description: 'Compress and convert all images in the folder for better performance...',
    time: 'Feb 9',
    assignee: 'Shuri',
    assigneeInitial: 'S'
  },
  {
    id: 8,
    column: 'review',
    title: 'Add SEO meta tags and Open Graph',
    description: 'Add meta tags for SEO (description, keywords) and social sharing...',
    time: 'Feb 10',
    assignee: 'Friday',
    assigneeInitial: 'F'
  }
];

export const feedItems = [
  {
    agent: 'Garry',
    action: 'message sent',
    message: 'Commented on task',
    time: 'about 4 days ago',
    status: 'yellow'
  },
  {
    agent: 'Garry',
    action: 'task completed',
    message: 'Completed Sicarro Marketing Image using MiniMax-M2.5. Output...',
    time: 'about 4 days ago',
    status: 'green'
  },
  {
    agent: 'Garry',
    action: 'message sent',
    message: 'Commented on task',
    time: 'about 4 days ago',
    status: 'yellow'
  },
  {
    agent: 'Garry',
    action: 'heartbeat check',
    message: 'Friday unresponsive on Sicarro marketing image task (3.5 hrs). Attempted contact faile...',
    time: 'about 4 days ago',
    status: 'yellow'
  },
  {
    agent: 'Garry',
    action: 'message sent',
    message: 'Commented on task',
    time: 'about 5 days ago',
    status: 'yellow'
  },
  {
    agent: 'Wanda',
    action: 'task completed',
    message: 'Completed Sicarro Car Image v6 using MiniMax-M2.5. Output: sicarro-ca...',
    time: 'about 5 days ago',
    status: 'green'
  }
];

export const missionChatSeed = [
  {
    id: 'chat-1',
    role: 'assistant',
    author: 'Garry',
    message: 'OpenClaw chat is online. Ask for status updates, task plans, or quick summaries.',
    time: '14:36'
  },
  {
    id: 'chat-2',
    role: 'user',
    author: 'You',
    message: 'Give me a quick mission overview.',
    time: '14:37'
  },
  {
    id: 'chat-3',
    role: 'assistant',
    author: 'Garry',
    message: '8 active tasks, 1 in review, no critical blockers. Timeline and memory checks look healthy.',
    time: '14:37'
  }
];

export const auditTimeline = [
  {
    id: 1,
    time: '14:32:15',
    agent: 'Garry',
    type: 'task',
    action: 'Completed task #42',
    detail: 'Sent email to user@example.com and used MiniMax-M2.5 API (2.3K tokens).'
  },
  {
    id: 2,
    time: '14:30:48',
    agent: 'Friday',
    type: 'workflow',
    action: 'Started task #43',
    detail: 'Read AGENT.md and initialized content brief draft.'
  },
  {
    id: 3,
    time: '14:28:12',
    agent: 'Vision',
    type: 'error',
    action: 'API call failed',
    detail: 'Timeout connecting to MiniMax-M2.5 API. Retrying (attempt 2/3).'
  },
  {
    id: 4,
    time: '14:25:03',
    agent: 'Shuri',
    type: 'memory',
    action: 'Updated MEMORY.md',
    detail: 'Added 3 long-term memory entries and linked project tags.'
  },
  {
    id: 5,
    time: '14:20:11',
    agent: 'System',
    type: 'security',
    action: 'Permission policy refreshed',
    detail: 'Skill access matrix synced with latest role constraints.'
  }
];

export const skillIntegrations = [
  {
    id: 'email-sender',
    name: 'Email Sender',
    version: '2.1.0',
    rating: 5,
    security: 'safe',
    summary: 'Send emails via Gmail API with templating support.',
    permissions: ['gmail.send', 'gmail.read'],
    updateAvailable: false
  },
  {
    id: 'web-scraper',
    name: 'Web Scraper',
    version: '1.5.3',
    rating: 3,
    security: 'review',
    summary: 'Scrape and normalize website content for research tasks.',
    permissions: ['http.request', 'filesystem.write'],
    updateAvailable: true
  },
  {
    id: 'file-manager',
    name: 'File Manager',
    version: '3.0.1',
    rating: 5,
    security: 'safe',
    summary: 'Read and write local workspace files with audit logging.',
    permissions: ['filesystem.read', 'filesystem.write'],
    updateAvailable: false
  }
];

export const memorySpaces = [
  {
    id: 'openclaw-core',
    name: 'OpenClaw Core',
    sizeMb: 18.4,
    entries: 12420,
    staleEntries: 520,
    clusters: ['Agents', 'Tasks', 'Policies', 'Integrations']
  },
  {
    id: 'marketing-site',
    name: 'Marketing Site',
    sizeMb: 9.8,
    entries: 6870,
    staleEntries: 210,
    clusters: ['SEO', 'Content', 'Brand', 'Performance']
  },
  {
    id: 'ops-automation',
    name: 'Ops Automation',
    sizeMb: 13.1,
    entries: 9050,
    staleEntries: 430,
    clusters: ['Alerts', 'Runbooks', 'Schedules', 'Incidents']
  }
];

export const memoryGraphLinks = [
  { from: 'User Goals', to: 'Projects' },
  { from: 'Projects', to: 'Agents' },
  { from: 'Projects', to: 'Tasks' },
  { from: 'Agents', to: 'Memories' },
  { from: 'Tasks', to: 'Files' },
  { from: 'Files', to: 'Policies' }
];

export const configurationValidator = {
  healthScore: 92,
  issues: [
    {
      id: 1,
      severity: 'warning',
      title: 'Port 8080 conflict with existing service',
      suggestion: 'Use port 8081 instead.',
      autoFixLabel: 'Auto Fix',
      status: 'open'
    },
    {
      id: 2,
      severity: 'warning',
      title: 'AGENT.md missing required field "timeout"',
      suggestion: 'Add default timeout of 30s.',
      autoFixLabel: 'Auto Fix',
      status: 'open'
    },
    {
      id: 3,
      severity: 'review',
      title: 'OpenAI API key format looks incorrect',
      suggestion: 'Review and re-paste the key format.',
      autoFixLabel: 'Review',
      status: 'open'
    }
  ],
  validatedFiles: [
    { name: 'USER.md', status: 'valid' },
    { name: 'AGENT.md', status: 'warning' },
    { name: 'SOUL.md', status: 'valid' },
    { name: 'HEARTBEAT.md', status: 'valid' },
    { name: 'MEMORY.md', status: 'valid' },
    { name: 'CRON.md', status: 'valid' },
    { name: 'TOOLS.md', status: 'valid' }
  ]
};
