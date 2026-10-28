import { Alert, AlertDescription, AlertTitle, Badge, Skeleton } from '@databricks/appkit-ui/react';
import { AlertTriangle, GraduationCap } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { createBrowserRouter, Link, NavLink, Outlet, RouterProvider } from 'react-router';
import { localizeGuides } from '../../shared/guide-i18n';
import { sortGuides, type Guide, type MeResponse } from '../../shared/guide-schema';
import { LangSwitch } from './components/LangSwitch';
import { ThemeToggle } from './components/ThemeToggle';
import { useI18n } from './i18n/context';
import { LanguageProvider } from './i18n/LanguageProvider';
import { useGuides, useMe } from './lib/api';
import { ParticipantPage } from './pages/ParticipantPage';
import { QuizPage } from './pages/QuizPage';
import { TrainerPage } from './pages/TrainerPage';

interface Session {
  me: MeResponse;
  guides: Guide[];
}

function Shell({ me, children }: { me: MeResponse | null; children: ReactNode }) {
  const { m } = useI18n();
  const navClass = ({ isActive }: { isActive: boolean }) => `wg-nav ${isActive ? 'wg-nav-active' : ''}`;
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="wg-accent-bar" aria-hidden />
      <header className="border-b bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center gap-1.5 px-4 py-2.5 sm:gap-3 md:px-6">
          <Link to="/" className="flex shrink-0 items-center gap-2 font-semibold tracking-tight" aria-label={m.appName}>
            <span className="wg-logo" aria-hidden>
              <GraduationCap className="size-4" />
            </span>
            <h1 className="text-base">
              <span className="sr-only sm:hidden">{m.appName}</span>
              <span className="hidden sm:inline">{m.appName}</span>
            </h1>
          </Link>
          <span className="hidden text-sm text-muted-foreground lg:inline">Databricks Fundamental</span>
          <nav className="wg-navbar flex min-w-0 gap-0.5 overflow-x-auto sm:ml-4 sm:gap-1" aria-label={m.navMain}>
            <NavLink to="/" end className={navClass}>
              {m.navWorkshops}
            </NavLink>
            <NavLink to="/quiz" className={navClass}>
              {m.navQuiz}
            </NavLink>
            {me?.isTrainer && (
              <NavLink to="/trainer" className={navClass}>
                {m.navTrainer}
              </NavLink>
            )}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            {me && (
              <Badge variant="outline" className="hidden max-w-64 truncate font-normal md:inline-flex" title={m.signedInAs}>
                {me.email}
              </Badge>
            )}
            <LangSwitch />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-5 md:px-6">{children}</main>
    </div>
  );
}

function SessionGate({ render }: { render: (s: Session) => ReactNode }) {
  const { lang, m } = useI18n();
  const me = useMe();
  const guides = useGuides();
  // Ordered by number (Workshop I, II, …) and translated on the client: switching the
  // language needs no request, and ids stay the same, so progress and stored answers carry over.
  const localized = useMemo(
    () => (guides.data ? localizeGuides(sortGuides(guides.data.guides), guides.data.overlays, lang) : null),
    [guides.data, lang]
  );

  if (me.loading || guides.loading) {
    return (
      <Shell me={null}>
        <div className="grid gap-6 md:grid-cols-[300px_1fr]" aria-busy="true" aria-label={m.loading}>
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
  if (error || !me.data || !localized) {
    return (
      <Shell me={me.data}>
        <Alert variant="destructive" className="mx-auto max-w-xl">
          <AlertTriangle aria-hidden />
          <AlertTitle>{m.startErrorTitle}</AlertTitle>
          <AlertDescription>
            <p>{error ?? m.unknownError}</p>
            <p>{m.startErrorHelp}</p>
          </AlertDescription>
        </Alert>
      </Shell>
    );
  }

  return <Shell me={me.data}>{render({ me: me.data, guides: localized })}</Shell>;
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
        path: '/quiz',
        element: <SessionGate render={({ me }) => <QuizPage email={me.email} />} />,
      },
      {
        path: '/trainer',
        element: <SessionGate render={({ me, guides }) => <TrainerPage guides={guides} isTrainer={me.isTrainer} />} />,
      },
      {
        path: '*',
        element: (
          <SessionGate
            render={() => <NotFound />}
          />
        ),
      },
    ],
  },
]);

function NotFound() {
  const { m } = useI18n();
  return (
    <p className="text-muted-foreground">
      {m.notFound} <Link to="/">{m.backToWorkshops}</Link>
    </p>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <RouterProvider router={router} />
    </LanguageProvider>
  );
}
