import { useEffect, useId, useRef, useState } from 'react';
import { prepareUpload } from '../lib/image';
import { buttonClass, cx, Spinner } from './ui';

// A required photo: one big "Take photo" button that opens the camera on phones.
// The chosen photo is shrunk once (see lib/image) and previewed with a Retake option.
export function PhotoField({ label, value, onChange, error }: {
  label: string;
  value: File | null;
  onChange: (file: File | null) => void;
  error?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  useEffect(() => {
    if (!value) { setPreview(null); return; }
    const url = URL.createObjectURL(value);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setFileError(null);
    setBusy(true);
    try {
      onChange(await prepareUpload(file));
    } catch (e) {
      setFileError(e instanceof Error ? e.message : 'Could not use that photo.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';   // picking the same file again still fires
    }
  };

  const message = fileError ?? error;
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-stone-700">{label}</p>
      <input
        ref={input}
        id={id}
        type="file"
        accept="image/jpeg,image/png"
        capture="environment"
        aria-label={label}
        className="sr-only"
        onChange={(e) => void choose(e.target.files?.[0])}
      />
      {preview ? (
        <div className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-2">
          <img src={preview} alt={`${label} preview`} className="h-16 w-16 rounded-lg object-cover" />
          <span className="min-w-0 flex-1 truncate text-sm text-stone-600">Photo added</span>
          <button type="button" onClick={() => input.current?.click()} className={buttonClass('ghost', 'min-h-11')}>
            Retake
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          aria-describedby={message ? `${id}-msg` : undefined}
          className={cx(
            'flex min-h-[72px] w-full items-center justify-center gap-2 rounded-xl border border-dashed text-sm font-medium transition-colors',
            message ? 'border-red-300 text-red-700' : 'border-stone-300 text-stone-700 hover:border-stone-400 hover:bg-white',
          )}
        >
          {busy ? <Spinner small /> : (
            <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="3.5" />
            </svg>
          )}
          Take photo
        </button>
      )}
      {message && <p id={`${id}-msg`} className="text-xs text-red-600">{message}</p>}
    </div>
  );
}
