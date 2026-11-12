import { Link } from 'react-router-dom';
import { buttonClass, StatusBadge } from '../../components/ui';
import { PublicLayout } from '../../layouts/PublicLayout';

const features = [
  { title: 'Alerts', text: 'Know what is due by distance or time, before it becomes overdue.' },
  { title: 'Driver app', text: 'Drivers log readings, trips and expenses from any phone.' },
  { title: 'Your data', text: 'Every company’s data is private and kept completely separate.' },
];

// Illustration only — shows what the dashboard list looks like
const preview = [
  { plate: 'TRK-104', task: 'Oil change', status: 'Overdue' },
  { plate: 'VAN-221', task: 'Brake check', status: 'Warning' },
  { plate: 'TRK-118', task: 'Tire rotation', status: 'Good' },
];

export function Landing() {
  return (
    <PublicLayout testId="page-landing">
      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs text-stone-600">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />
              Preventive maintenance for any fleet
            </p>
            <h1 className="mt-6 max-w-xl font-display text-4xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-6xl">
              Never miss a maintenance date again.
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-stone-500 sm:text-lg">
              Odometer readings, trips, expenses and service schedules for every vehicle — with alerts before
              anything becomes overdue.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/signup" className={buttonClass('primary', 'px-5 py-2.5')}>Start free</Link>
              <Link to="/login" className={buttonClass('secondary', 'px-5 py-2.5')}>Try the demo</Link>
            </div>
          </div>

          <div aria-hidden className="rounded-2xl border border-stone-200 bg-white p-2 shadow-[0_24px_48px_-24px_rgba(12,10,9,0.18)]">
            <div className="grid grid-cols-3 divide-x divide-stone-100 rounded-xl border border-stone-100">
              {[['Vehicles', '24'], ['Overdue', '1'], ['Due soon', '3']].map(([label, value]) => (
                <div key={label} className="px-4 py-3">
                  <p className="text-xs text-stone-500">{label}</p>
                  <p className={`num mt-1 text-2xl font-semibold ${label === 'Overdue' ? 'text-red-600' : ''}`}>{value}</p>
                </div>
              ))}
            </div>
            <ul className="mt-2 divide-y divide-stone-100 px-3">
              {preview.map((p) => (
                <li key={p.plate} className="flex items-center justify-between py-3 text-sm">
                  <span><span className="font-medium">{p.plate}</span> <span className="text-stone-500">· {p.task}</span></span>
                  <StatusBadge status={p.status} />
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="grid border-t border-stone-200 sm:grid-cols-3 sm:divide-x sm:divide-stone-200">
          {features.map((f, i) => (
            <div key={f.title} className="py-8 sm:px-8 sm:first:pl-0">
              <p className="num text-xs text-stone-400">0{i + 1}</p>
              <h2 className="mt-3 font-display font-semibold text-ink">{f.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-stone-500">{f.text}</p>
            </div>
          ))}
        </section>
      </main>
    </PublicLayout>
  );
}
