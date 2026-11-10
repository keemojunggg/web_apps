import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import TaskPlannerApp from './TaskPlannerApp';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <TaskPlannerApp />
  </StrictMode>,
);
