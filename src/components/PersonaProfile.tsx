import { ArrowUpRight, BookOpen, Check, Volume2 } from 'lucide-react';
import { MAYA_PERSONA } from '../lib/persona';
import './PersonaProfile.css';

export default function PersonaProfile() {
  return <div className="persona-profile">
    <div className="persona-intro"><span className="persona-monogram" aria-hidden="true">m.</span><div><span className="eyebrow">CASE-FILE PERSONA · V{MAYA_PERSONA.version}</span><h3>{MAYA_PERSONA.tagline}.</h3><p>{MAYA_PERSONA.description}</p></div></div>
    <div className="persona-applies"><span><Check size={14}/>New answer drafts</span><span><Check size={14}/>Voice-companion replies</span></div>
    <section><h3><BookOpen size={16}/>What the files establish</h3><div className="persona-traits">{MAYA_PERSONA.traits.map(trait => <article key={trait.title}><div><strong>{trait.title}</strong><a href={`/operation-shade-case-file.pdf#page=${trait.page}`} target="_blank" rel="noreferrer">Page {trait.page}<ArrowUpRight size={12}/></a></div><p>{trait.description}</p><details><summary>Source wording</summary><blockquote>{trait.excerpt}</blockquote></details></article>)}</div></section>
    <section><h3>How we apply that style</h3><p className="persona-explanation">These are product choices drawn from the file, rather than recovered quotes.</p><ul>{MAYA_PERSONA.writingRules.map(rule => <li key={rule}>{rule}</li>)}</ul><blockquote className="persona-example">“What are you using now, and what would you actually like to change? Let’s start there before adding another bottle.”<small>New example wording · not a quote from Maya</small></blockquote></section>
    <section className="persona-voice-note"><h3><Volume2 size={16}/>The writing persona and the spoken voice</h3><p>The file supplies a transcript and a QR placeholder. Speech uses a synthetic browser voice; it does not reproduce Maya’s original voice.</p><p>Replies use local templates and the current canvas records. A live conversational AI service is not connected.</p></section>
    <p className="persona-preservation">The persona applies to new or deliberately regenerated drafts. Existing approved answers and shared copies keep their wording. Evidence checks and approval still apply.</p>
  </div>;
}
