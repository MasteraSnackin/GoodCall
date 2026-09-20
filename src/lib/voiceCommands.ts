import type { Question } from './types';

type VoiceAction =
  | { type: 'navigate'; view: 'canvas' | 'questions' | 'knowledge' | 'reports' | 'published' }
  | { type: 'draft'; questionId: string }
  | { type: 'inspect'; topic: 'persona' | 'issues' | 'selected' }
  | { type: 'unsupported'; message: string };

export function parseVoiceCommand(command: string, questions: Question[], selectedQuestionId?: string): VoiceAction {
  const text = command.trim().toLowerCase().replace(/’/g, "'").replace(/[.!?]+$/, '').replace(/^(?:hey\s+)?maya[,:]?\s+/, '').replace(/^please\s+/, '').replace(/\s+please$/, '').replace(/\s+/g, ' ');
  if (["what's missing", 'what is missing', 'what needs checking', 'summarise the issues', 'summarize the issues'].includes(text)) return { type: 'inspect', topic: 'issues' };
  if (['who are you', 'what is your approach', 'how do you recommend products', 'explain your persona'].includes(text)) return { type: 'inspect', topic: 'persona' };
  if (['explain this card', 'explain the selected card', 'what needs checking on this card', 'is this answer ready'].includes(text)) return { type: 'inspect', topic: 'selected' };
  const navigation = text.match(/^(?:show|open|go to) (?:the )?(.+)$/)?.[1];
  const views: Record<string, Extract<VoiceAction, { type: 'navigate' }>['view']> = {
    canvas: 'canvas', board: 'canvas', 'answer canvas': 'canvas',
    questions: 'questions', inbox: 'questions', 'audience questions': 'questions',
    knowledge: 'knowledge', products: 'knowledge', shelf: 'knowledge',
    reports: 'reports', issues: 'reports', 'evidence checks': 'reports',
    published: 'published', 'published answers': 'published', 'approved advice': 'published', 'follower view': 'published',
  };
  if (navigation && Object.hasOwn(views, navigation)) return { type: 'navigate', view: views[navigation] };
  const drafting = text.match(/^(?:draft|write|prepare)(?: an?| the)? (?:answer|reply)(?: for (.+))?$/);
  if (drafting) {
    const target = drafting[1]?.replace(/^@/, '');
    if (target) {
      const matching = questions.filter(question => question.handle.replace(/^@/, '').toLowerCase() === target);
      if (matching.length === 1) return { type: 'draft', questionId: matching[0].id };
      return { type: 'unsupported', message: matching.length > 1
        ? 'There is more than one question from that follower. Select the question, then use “Draft an answer”.'
        : 'I could not find that exact follower handle. Select their question, then use “Draft an answer”.' };
    }
    if (selectedQuestionId && questions.some(question => question.id === selectedQuestionId)) return { type: 'draft', questionId: selectedQuestionId };
    return { type: 'unsupported', message: 'Select a question first, or use “Draft an answer for Sarah”.' };
  }
  return { type: 'unsupported', message: 'Try “Show reports”, “Show questions” or “Draft an answer for Sarah”. Approval and publishing use the review buttons.' };
}
