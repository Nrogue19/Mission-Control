// data.js - All data for OpenClaw Mission Control

export const agentColors = {
  'Jarvis': '#ec4899',
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
  { name: 'Jarvis', role: 'Squad Lead', status: 'awake', initial: 'J' },
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
    agent: 'Jarvis',
    action: 'message sent',
    message: 'Commented on task',
    time: 'about 4 days ago',
    status: 'yellow'
  },
  {
    agent: 'Jarvis',
    action: 'task completed',
    message: 'Completed Sicarro Marketing Image using Gemini 3 Pro (nano-banana-pro). Output...',
    time: 'about 4 days ago',
    status: 'green'
  },
  {
    agent: 'Jarvis',
    action: 'message sent',
    message: 'Commented on task',
    time: 'about 4 days ago',
    status: 'yellow'
  },
  {
    agent: 'Jarvis',
    action: 'heartbeat check',
    message: 'Friday unresponsive on Sicarro marketing image task (3.5 hrs). Attempted contact faile...',
    time: 'about 4 days ago',
    status: 'yellow'
  },
  {
    agent: 'Jarvis',
    action: 'message sent',
    message: 'Commented on task',
    time: 'about 5 days ago',
    status: 'yellow'
  },
  {
    agent: 'Wanda',
    action: 'task completed',
    message: 'Completed Sicarro Car Image v6 using Gemini image generation. Output: sicarro-ca...',
    time: 'about 5 days ago',
    status: 'green'
  }
];
