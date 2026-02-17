# Integration Guide: Adding Monitoring Features to Mission Control

## Step 1: Import the New Components

Add these imports to the top of your `MissionControl.jsx` file:

```javascript
import { TokenUsageMonitor, SecurityDashboard, AgentHealthMonitor } from './MonitoringComponents';
import './MonitoringStyles.css';
```

## Step 2: Add State Management

Inside your `MissionControl` component, add these state hooks:

```javascript
const [tokenMonitorExpanded, setTokenMonitorExpanded] = useState(false);
const [securityExpanded, setSecurityExpanded] = useState(false);
const [healthExpanded, setHealthExpanded] = useState(false);
```

## Step 3: Update the AgentsSidebar Component

Replace your current `AgentsSidebar` component with this enhanced version:

```javascript
const AgentsSidebar = ({ agents, files, onFileView, isOpen, onClose }) => (
  <div className={`agents-sidebar ${isOpen ? 'open' : ''}`} id="agentsSidebar">
    <button className="mobile-close-btn" onClick={onClose}>✕</button>
    
    <div className="sidebar-header">
      <span className="sidebar-title">Agents</span>
      <span className="agent-count">{agents.length}</span>
    </div>
    
    <div className="agents-list">
      {agents.map((agent, index) => (
        <AgentItem key={index} agent={agent} />
      ))}
    </div>

    {/* NEW: Add monitoring components here */}
    <TokenUsageMonitor 
      isExpanded={tokenMonitorExpanded}
      onToggle={() => setTokenMonitorExpanded(!tokenMonitorExpanded)}
    />
    
    <SecurityDashboard 
      isExpanded={securityExpanded}
      onToggle={() => setSecurityExpanded(!securityExpanded)}
    />
    
    <AgentHealthMonitor 
      agents={agents}
      isExpanded={healthExpanded}
      onToggle={() => setHealthExpanded(!healthExpanded)}
    />
    
    <FilesSection files={files} onFileView={onFileView} />
  </div>
);
```

## Step 4: Update the Sidebar Width (Optional but Recommended)

In `MissionControl.css`, update the sidebar width to accommodate the new content:

```css
.agents-sidebar {
    width: 280px; /* Changed from 200px */
    background: white;
    border-right: 1px solid #e5e7eb;
    overflow-y: auto;
}
```

## Step 5: Add to Main Component

Your main MissionControl component should now look like this:

```javascript
const MissionControl = () => {
  // ... existing state
  const [tokenMonitorExpanded, setTokenMonitorExpanded] = useState(false);
  const [securityExpanded, setSecurityExpanded] = useState(false);
  const [healthExpanded, setHealthExpanded] = useState(false);

  // ... existing code

  return (
    <div className="mission-control">
      <Header 
        time={time} 
        date={date} 
        isDarkMode={isDarkMode}
        onToggleDarkMode={handleToggleDarkMode}
      />
      
      <div className={`overlay ${overlayActive ? 'active' : ''}`} onClick={toggleSidebar}></div>
      
      <div className="main-container">
        <AgentsSidebar 
          agents={initialAgents} 
          files={initialFiles} 
          onFileView={handleFileView}
          isOpen={sidebarOpen}
          onClose={toggleSidebar}
        />
        
        {/* ... rest of your components */}
      </div>

      {/* ... modals */}
    </div>
  );
};
```

## Complete File Structure

Your project should now have:

```
src/
├── MissionControl.jsx          (main component with integration)
├── MissionControl.css          (original styles + width update)
├── MonitoringComponents.jsx    (NEW - the three monitoring components)
├── MonitoringStyles.css        (NEW - styles for monitoring components)
└── data.js                     (existing data file)
```

## Testing the Integration

1. Start your development server
2. Open the mission control board
3. Look at the left sidebar - you should see three new collapsible sections:
   - 💰 TOKEN USAGE
   - 🛡️ SECURITY
   - 🏥 HEALTH
4. Click each header to expand/collapse
5. Verify all metrics display correctly
6. Test in dark mode
7. Test on mobile (sidebar should slide in/out)

## Customization

### Update Real Data

Replace the mock data in `MonitoringComponents.jsx` with real API calls:

```javascript
// In TokenUsageMonitor
useEffect(() => {
  fetch('/api/token-usage')
    .then(res => res.json())
    .then(data => setTokenData(data));
}, []);

// In SecurityDashboard
useEffect(() => {
  fetch('/api/security-status')
    .then(res => res.json())
    .then(data => setSecurityData(data));
}, []);

// In AgentHealthMonitor
useEffect(() => {
  const ws = new WebSocket('ws://localhost:8080/health');
  ws.onmessage = (event) => {
    setHealthData(JSON.parse(event.data));
  };
  return () => ws.close();
}, []);
```

### Adjust Colors

Modify colors in `MonitoringStyles.css` to match your brand:

```css
.budget-fill {
    background: #your-brand-color;
}

.chart-bar {
    background: linear-gradient(to top, #your-color-1, #your-color-2);
}
```

### Add More Metrics

Extend any component by adding more data fields:

```javascript
// Example: Add weekly cost in TokenUsageMonitor
const [tokenData, setTokenData] = useState({
  today: 1200000,
  cost: 18.50,
  weeklyCost: 125.00,  // NEW
  // ... rest
});
```

## Troubleshooting

### Components Don't Show Up
- Verify imports are correct
- Check console for errors
- Ensure CSS files are imported

### Styles Look Wrong
- Clear browser cache
- Check that MonitoringStyles.css is imported after MissionControl.css
- Verify dark mode classes are applied

### Mobile Menu Doesn't Work
- Check that overlay toggle is working
- Verify sidebar classes are being added/removed
- Test z-index values

## Next Steps

Once integrated, you can:

1. Connect to real APIs for live data
2. Add WebSocket connections for real-time updates
3. Implement alert notifications
4. Add export/reporting features
5. Create admin settings for thresholds and alerts

## Support

For issues or questions:
- Check the FEATURE_ROADMAP.md for detailed specs
- Review component props and state management
- Test in isolation before full integration
