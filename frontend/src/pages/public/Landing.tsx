import { Link } from 'react-router-dom';
import { buttonClass, Card } from '../../components/ui';
import { PublicLayout } from '../../layouts/PublicLayout';

const features = [
  { icon: '🔔', title: 'Alerts', text: 'Know what is due by distance or time, before it becomes overdue.' },
  { icon: '📱', title: 'Driver app', text: 'Drivers log readings, trips and expenses from any phone.' },
  { icon: '🏢', title: 'Your data', text: 'Every company’s data is private and kept completely separate.' },
];

export function Landing() {
  return (
    <PublicLayout testId="page-landing">
      <main>
        <section className="bg-gradient-to-b from-blue-50 to-slate-100">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
            <h1 className="max-w-2xl text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
              Never miss a maintenance date again.
            </h1>
            <p className="mt-4 max-w-xl text-base text-slate-600 sm:text-lg">
              Track odometer readings, trips, expenses and service schedules for every vehicle in your fleet.
              Get alerts before anything becomes overdue.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/signup" className={buttonClass('primary', 'px-5 py-2.5')}>Start free</Link>
              <Link to="/login" className={buttonClass('secondary', 'px-5 py-2.5')}>Try the demo</Link>
            </div>
          </div>
        </section>
        <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-16 sm:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title}>
              <div className="text-2xl" aria-hidden>{f.icon}</div>
              <h2 className="mt-2 font-semibold text-slate-900">{f.title}</h2>
              <p className="mt-1 text-sm text-slate-600">{f.text}</p>
            </Card>
          ))}
        </section>
      </main>
    </PublicLayout>
  );
}
