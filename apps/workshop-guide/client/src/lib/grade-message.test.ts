import { describe, expect, it } from 'vitest';
import { checkFill, checkMatch, checkOrder } from '../../../shared/grading';
import { en } from '../i18n/en';
import { pl } from '../i18n/pl';
import { notebookCode, placeholders } from './notebook';
import { localizeGradeMessage } from './grade-message';

const order = {
  blocks: [
    { id: 'a', code: 'A' },
    { id: 'b', code: 'B' },
    { id: 'x', code: 'X' },
  ],
  solution: ['a', 'b'],
  distractors: ['x'],
};

describe('app grading messages in the UI language', () => {
  it('translates every message the app grades with', () => {
    const fill = { template: '{{b1}} {{b2}}', blanks: { b1: { answers: ['a'], case_sensitive: false }, b2: { answers: ['b'], case_sensitive: false } } };
    expect(localizeGradeMessage(checkFill(fill, { b1: 'a', b2: 'b' }).message, pl)).toBe('Wszystkie luki poprawne (2).');
    expect(localizeGradeMessage(checkFill(fill, { b1: 'a' }).message, pl)).toBe('Poprawne luki: 1 z 2.');
    const pairs = { pairs: [{ left: 'A', right: '1' }, { left: 'B', right: '2' }] };
    expect(localizeGradeMessage(checkMatch(pairs, { 0: 0, 1: 1 }).message, pl)).toBe('Wszystkie pary połączone dobrze (2).');
    expect(localizeGradeMessage(checkMatch(pairs, { 0: 1, 1: 0 }).message, pl)).toBe('Dobrze połączone pary: 0 z 2.');
    expect(localizeGradeMessage(checkOrder(order, ['a', 'b']).message, pl)).toBe('Dobra kolejność: wszystkie bloki na miejscu (2).');
    expect(localizeGradeMessage(checkOrder(order, ['x', 'a']).message, pl)).toBe(
      'Bloki na właściwym miejscu: 0 z 2. Bloki, które tu nie pasują: 1. Brakujące bloki: 1.',
    );
    expect(localizeGradeMessage(checkOrder(order, ['b', 'a']).message, en)).toBe('0 of 2 blocks in the right place.');
  });

  it('leaves notebook and data-check messages alone', () => {
    expect(localizeGradeMessage('Table lab_delta_cust_ws not found.', pl)).toBeNull();
  });
});

describe('notebook code', () => {
  const save = '-- optional: saves your result for the Check on data button\nCREATE OR REPLACE TABLE default._ws_x AS SELECT 1;';
  it('adds %sql for the SQL track and the save lines once', () => {
    expect(notebookCode('SELECT 1;', true, save)).toBe(`%sql\nSELECT 1;\n\n${save}`);
    expect(notebookCode('x = 1', false, null)).toBe('x = 1');
    const already = 'SELECT 1;\nCREATE OR REPLACE TABLE default._ws_x AS SELECT 1;';
    expect(notebookCode(already, false, save)).toBe(already);
  });

  it('lists placeholders to replace', () => {
    expect(placeholders("FROM '/Volumes/<catalog>/x' TIMESTAMP AS OF '<timestamp of the INSERT>' WHERE a < b")).toEqual([
      '<catalog>',
      '<timestamp of the INSERT>',
    ]);
  });
});
