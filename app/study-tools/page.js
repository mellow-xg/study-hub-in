'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';

export default function StudyToolsPage() {
  const [userId, setUserId] = useState(null);
  const [bookmarks, setBookmarks] = useState([]);
  const [fontSize, setFontSize] = useState(16);
  const [highContrast, setHighContrast] = useState(false);
  const [remindersOn, setRemindersOn] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    setFontSize(Number(localStorage.getItem('fontSize') || 16));
    setHighContrast(localStorage.getItem('highContrast') === 'true');
    setRemindersOn(localStorage.getItem('remindersOn') === 'true');
  }, []);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('bookmarks')
      .select('id, resources(title, chapters(courses(title, slug)))')
      .eq('profile_id', userId)
      .then(({ data }) => setBookmarks(data || []));
  }, [userId]);

  useEffect(() => {
    document.documentElement.style.setProperty('--base-font-size', `${fontSize}px`);
    document.documentElement.classList.toggle('high-contrast', highContrast);
    localStorage.setItem('fontSize', String(fontSize));
    localStorage.setItem('highContrast', String(highContrast));
  }, [fontSize, highContrast]);

  const removeBookmark = async (id) => {
    const { error } = await supabase.from('bookmarks').delete().eq('id', id).eq('profile_id', userId);
    if (!error) setBookmarks((b) => b.filter((x) => x.id !== id));
  };

  const toggleReminders = async () => {
    const next = !remindersOn;
    if (next && !("Notification" in window)) return;
    if (next && Notification.permission !== 'granted') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return;
    }
    setRemindersOn(next);
    localStorage.setItem('remindersOn', String(next));
  };

  return (
    <main className="min-h-screen bg-white dark:bg-[#0e0e17] px-5 py-8 max-w-md mx-auto">
      <Link href="/" className="text-accent text-sm">← Home</Link>
      <h1 className="text-2xl font-semibold text-ink dark:text-white mb-8">Your study tools</h1>

      <div className="flex gap-6">
        <div className="w-px bg-gray-200 dark:bg-gray-700 shrink-0" />
        <div className="flex-1 space-y-10">

          <section>
            <h2 className="text-sm font-medium text-gray-500 dark:text-white/60 mb-3">Bookmarks</h2>
            {bookmarks.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-white/50">
                Nothing saved yet — tap the star on any resource to keep it here.
              </p>
            ) : (
              <ul className="space-y-3">
                {bookmarks.map((b) => (
                  <li key={b.id} className="flex items-center justify-between text-sm">
                    <div>
                      <Link className="text-ink dark:text-white underline" href={b.resources?.chapters?.courses?.slug ? `/courses/${b.resources.chapters.courses.slug}` : "/"}>{b.resources?.title}</Link>
                      <p className="text-gray-500 dark:text-white/50 text-xs">{b.resources?.chapters?.courses?.title}</p>
                    </div>
                    <button
                      onClick={() => removeBookmark(b.id)}
                      className="text-accent text-xs"
                      aria-label="Remove bookmark"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="text-sm font-medium text-gray-500 dark:text-white/60 mb-3">Reminders</h2>
            <label className="flex items-center justify-between text-sm text-ink dark:text-white">
              Daily study nudge
              <input
                type="checkbox"
                checked={remindersOn}
                onChange={toggleReminders}
                className="accent-accent w-5 h-5"
              />
            </label>
          </section>

          <section>
            <h2 className="text-sm font-medium text-gray-500 dark:text-white/60 mb-3">Display</h2>
            <label htmlFor="fontSize" className="block text-sm text-ink dark:text-white mb-1">
              Text size — {fontSize}px
            </label>
            <input
              id="fontSize"
              type="range"
              min={14}
              max={24}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-full accent-accent"
            />
            <label className="flex items-center justify-between text-sm text-ink dark:text-white mt-4">
              High contrast
              <input
                type="checkbox"
                checked={highContrast}
                onChange={(e) => setHighContrast(e.target.checked)}
                className="accent-accent w-5 h-5"
              />
            </label>
          </section>

        </div>
      </div>
    </main>
  );
}
