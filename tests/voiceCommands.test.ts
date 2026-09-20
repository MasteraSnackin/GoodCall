import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseVoiceCommand } from '../src/lib/voiceCommands';
import { seedQuestions } from '../src/lib/seed';

const questions = seedQuestions();
test('voice commands navigate only through recognised phrases', () => {
  assert.deepEqual(parseVoiceCommand('Please show reports.', questions), { type: 'navigate', view: 'reports' });
  assert.equal(parseVoiceCommand('Do not show reports', questions).type, 'unsupported');
  assert.equal(parseVoiceCommand('Publish all answers', questions).type, 'unsupported');
});
test('draft commands require exact, unambiguous follower handles', () => {
  const withShortHandle = [{ ...questions[0], id: 'short', handle: '@a' }, ...questions];
  assert.deepEqual(parseVoiceCommand('Draft an answer for Sarah', withShortHandle), { type: 'draft', questionId: 'q-04' });
  assert.equal(parseVoiceCommand('Draft an answer for Ben', questions, 'q-05').type, 'unsupported');
  assert.equal(parseVoiceCommand('Draft an answer for Sarah', [...questions, { ...questions[3], id: 'duplicate' }]).type, 'unsupported');
});
test('selection is used only when no explicit follower was spoken', () => {
  assert.deepEqual(parseVoiceCommand('Draft an answer', questions, 'q-05'), { type: 'draft', questionId: 'q-05' });
  assert.equal(parseVoiceCommand('Draft an answer', questions).type, 'unsupported');
});
