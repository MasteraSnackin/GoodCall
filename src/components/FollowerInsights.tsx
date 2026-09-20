import { useEffect, useState } from 'react';
import { ArrowUpRight, RefreshCw } from 'lucide-react';
import { FOLLOWER_ACTIVITY_EVENT, FOLLOWER_ACTIVITY_STORAGE_KEY, readFollowerActivity, summariseFollowerActivity } from '../lib/followerActivity';
import { FEEDBACK_CHANGED_EVENT, FEEDBACK_STORAGE_KEY, readFeedback } from '../lib/feedback';
import './FollowerInsights.css';

export default function FollowerInsights({ onOpenAdvice, onReviewFeedback }: { onOpenAdvice: (id: string) => void; onReviewFeedback: () => void }) {
  const [activity, setActivity] = useState(readFollowerActivity);
  const [feedback, setFeedback] = useState(readFeedback);
  function refresh() { setActivity(readFollowerActivity()); setFeedback(readFeedback()); }
  useEffect(() => {
    const refreshActivity = () => setActivity(readFollowerActivity());
    const refreshFeedback = () => setFeedback(readFeedback());
    const storage = (event: StorageEvent) => {
      if (event.key === null || event.key === FOLLOWER_ACTIVITY_STORAGE_KEY) refreshActivity();
      if (event.key === null || event.key === FEEDBACK_STORAGE_KEY) refreshFeedback();
    };
    window.addEventListener(FOLLOWER_ACTIVITY_EVENT, refreshActivity);
    window.addEventListener(FEEDBACK_CHANGED_EVENT, refreshFeedback);
    window.addEventListener('storage', storage);
    return () => {
      window.removeEventListener(FOLLOWER_ACTIVITY_EVENT, refreshActivity);
      window.removeEventListener(FEEDBACK_CHANGED_EVENT, refreshFeedback);
      window.removeEventListener('storage', storage);
    };
  }, []);
  const rows = summariseFollowerActivity(activity.items);
  const totals = rows.reduce((sum, row) => ({ opened: sum.opened + row.opened, saved: sum.saved + row.saved, shareCopied: sum.shareCopied + row.shareCopied, sharedOpened: sum.sharedOpened + row.sharedOpened, returnVisits: sum.returnVisits + row.returnVisits }), { opened: 0, saved: 0, shareCopied: 0, sharedOpened: 0, returnVisits: 0 });
  const metrics = [{ label: 'Opens', value: totals.opened }, { label: 'Saves', value: totals.saved }, { label: 'Links copied', value: totals.shareCopied }, { label: 'Shared link opens', value: totals.sharedOpened }, { label: 'Return visits', value: totals.returnVisits }];
  const unsure = feedback.items.filter(item => item.reason === 'still-unsure').length;
  return <section className="follower-insights" aria-labelledby="follower-insights-heading">
    <header><div><span className="eyebrow">AFTER THE ANSWER</span><h2 id="follower-insights-heading">Follower insights</h2></div><button className="secondary" onClick={refresh}><RefreshCw size={15}/>Refresh insights</button></header>
    <p className="insights-scope">Activity recorded in this browser only. These are actions and visits, not unique people or activity from other devices. Shared link opens can include your own opens and tests.</p>
    <p className="insights-scope">Link copies do not prove a message was sent or read. Private shares, purchases and social engagement are not measured.</p>
    {activity.error ? <p className="insights-error" role="alert">{activity.error}</p> : <>
      <dl className="insights-metrics">{metrics.map(metric => <div key={metric.label}><dt>{metric.label}</dt><dd>{metric.value}</dd></div>)}</dl>
      {activity.atCapacity && <p className="insights-error" role="status">The 1,000-event limit has been reached. These counts exclude any later actions that could not be recorded.</p>}
      <p className="insights-definition">Reopening the same answer version in one tab session counts once, including reloads. Opening it in a separate tab session counts as a return visit. Shared link opens are included in Opens. Saves count successful save actions; they do not show how many answers are currently bookmarked.</p>
      {rows.length === 0 ? <p className="insights-empty">No follower activity recorded in this browser yet. Open a published answer, save it or copy its link to begin.</p> : <div className="insights-answers">{rows.map(row => <article key={JSON.stringify([row.adviceId, row.adviceVersion])}>
        <div className="insights-answer-heading"><div><h3>{row.adviceTitle}</h3><p>Answer version {row.adviceVersion.split(':').at(-1)} · latest activity <time dateTime={row.lastActivityAt}>{new Date(row.lastActivityAt).toLocaleDateString('en-GB')}</time></p></div><button className="secondary" onClick={() => onOpenAdvice(row.adviceId)} aria-label={`Open published answer: ${row.adviceTitle}`}>Open answer<ArrowUpRight size={15}/></button></div>
        <dl className="insights-answer-counts"><div><dt>Opens</dt><dd>{row.opened}</dd></div><div><dt>Saves</dt><dd>{row.saved}</dd></div><div><dt>Links copied</dt><dd>{row.shareCopied}</dd></div><div><dt>Shared link opens</dt><dd>{row.sharedOpened}</dd></div><div><dt>Return visits</dt><dd>{row.returnVisits}</dd></div></dl>
      </article>)}</div>}
    </>}
    <section className="insights-feedback" aria-labelledby="insights-feedback-heading"><h3 id="insights-feedback-heading">Questions after the answer</h3>
      {feedback.error ? <p className="insights-error" role="alert">Still-unsure feedback count is unavailable. {feedback.error}</p> : <p><strong>{unsure}</strong> {unsure === 1 ? 'response marked' : 'responses marked'} “Still unsure” in this browser.</p>}
      <button className="secondary" onClick={onReviewFeedback}>Review follower feedback<ArrowUpRight size={15}/></button>
    </section>
  </section>;
}
