import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider, Outlet } from 'react-router';
import Home from './routes/Home';
import Dev from './routes/Dev';
import Architecture from './routes/Architecture';
import { ViewSwitcher } from './components/ViewSwitcher';
import './globals.css';

const Layout = () => (
  <>
    <Outlet />
    <ViewSwitcher />
  </>
);

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/dev', element: <Dev /> },
      { path: '/architecture', element: <Architecture /> },
    ]
  }
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
