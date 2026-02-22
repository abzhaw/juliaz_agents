import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import Home from './routes/Home';
import Dev from './routes/Dev';
import Architecture from './routes/Architecture';
import './globals.css';

const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  { path: '/dev', element: <Dev /> },
  { path: '/architecture', element: <Architecture /> },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
