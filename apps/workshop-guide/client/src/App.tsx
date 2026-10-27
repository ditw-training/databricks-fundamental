import { Alert, AlertDescription, AlertTitle, Badge, Skeleton } from '@databricks/appkit-ui/react';
import { AlertTriangle, GraduationCap } from 'lucide-react';
import type { ReactNode } from 'react';
import { createBrowserRouter, Link, NavLink, Outlet, RouterProvider } from 'react-router';
import type { Guide, MeResponse } from '../../shared/guide-schema';
import { ThemeToggle } from './components/ThemeToggle';
import { useGuides, useMe } from './lib/api';
import { ParticipantPage } from './pages/ParticipantPage';
import { TrainerPage } from './pages/TrainerPage';

interface Session {
  me: MeResponse;
  guides: Guide[];
}

function Shell({ me, children }: { me: MeResponse | null; children: ReactNode }) {
  const navClass = ({ isActive }: { isActive: boolean }) => `wg-nav ${isActive ? 'wg-nav-active' : ''}`;
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="wg-accent-bar" aria-hidden />
      <header className="border-b bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-2.5 md:px-6">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="wg-logo" aria-hidden>
              <GraduationCap className="size-4" />
            </span>
            <h1 className="text-base">Workshop Guide</h1>
          </Link>
          <span className="hidden text-sm text-muted-foreground sm:inline">Databricks Fundamental</span>
          <nav className="ml-4 flex gap-1" aria-label="Main">
            <NavLink to="/" end className={navClass}>
              Workshops
            </NavLink>
            {me?.isTrainer && (
              <NavLink to="/trainer" className={navClass}>
                Trainer
              </NavLink>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {me && (
              <Badge variant="outline" className="hidden max-w-64 truncate font-normal md:inline-flex" title="Signed in as">
                {me.email}
              </Badge>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-5 md:px-6">{children}</main>
    </div>
  );
}

function SessionGate({ render }: { render: (s: Session) => ReactNode }) {
  const me = useMe();
  const guides = useGuides();

  if (me.loading || guides.loading) {
    return (
      <Shell me={null}>
        <div className="grid gap-6 md:grid-cols-[300px_1fr]" aria-busy="true" aria-label="Loading">
          <Skeleton className="h-80 w-full" />
          <div className="space-y-3">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </Shell>
    );
  }

  const error = me.error ?? guides.error;
  if (error || !me.data || !guides.data) {
    return (
      <Shell me={me.data}>
        <Alert variant="destructive" className="mx-auto max-w-xl">
          <AlertTriangle aria-hidden />
          <AlertTitle>The guide could not start</AlertTitle>
          <AlertDescription>
            <p>{error ?? 'Unknown error'}</p>
            <p>Reload the page. If it keeps failing, tell the trainer.</p>
          </AlertDescription>
        </Alert>
      </Shell>
    );
  }

  return <Shell me={me.data}>{render({ me: me.data, guides: guides.data.guides })}</Shell>;
}

const router = createBrowserRouter([
  {
    element: <Outlet />,
    children: [
      {
        path: '/',
        element: <SessionGate render={({ me, guides }) => <ParticipantPage guides={guides} email={me.email} />} />,
      },
      {
        path: '/trainer',
        element: <SessionGate render={({ me, guides }) => <TrainerPage guides={guides} isTrainer={me.isTrainer} />} />,
      },
      {
        path: '*',
        element: (
          <SessionGate
            render={() => (
              <p className="text-muted-foreground">
                Page not found. <Link to="/">Back to the workshops</Link>
              </p>
            )}
          />
        ),
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
