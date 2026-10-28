/**
 * English UI texts. This file defines the key set: `pl.ts` must have every key with the same
 * shape (plain text or a function with the same parameters), or the typecheck fails.
 */
import { enPlural } from './plural';

export const en = {
  // ── shell ──
  appName: 'Workshop Guide',
  navMain: 'Main',
  navWorkshops: 'Workshops',
  navQuiz: 'Quiz',
  navTrainer: 'Trainer',
  signedInAs: 'Signed in as',
  language: 'Language',
  loading: 'Loading',
  startErrorTitle: 'The guide could not start',
  unknownError: 'Unknown error',
  startErrorHelp: 'Reload the page. If it keeps failing, tell the trainer.',
  notFound: 'Page not found.',
  backToWorkshops: 'Back to the workshops',
  themeName: (theme: 'system' | 'light' | 'dark') => ({ system: 'system', light: 'light', dark: 'dark' })[theme],
  themeTitle: (name: string) => `Theme: ${name}`,
  themeSwitch: (name: string, next: string) => `Theme: ${name}. Switch to ${next}`,

  // ── time ──
  agoJustNow: 'just now',
  agoSeconds: (s: number) => `${s} s ago`,
  agoMinutes: (m: number) => `${m} min ago`,
  agoHours: (h: number) => `${h} h ago`,

  // ── step types and status ──
  typeFill: 'Fill in the blanks',
  typeOrder: 'Put in order',
  typeMatch: 'Match pairs',
  typeCode: 'Write the code',
  optional: 'Optional',
  optionalShort: 'opt.',
  /** Shown under the explanation of an optional step (the notebooks carry the same note). */
  optionalNote: 'This step is optional: you can skip it; the next steps do not depend on it.',
  statusPass: 'Passed',
  statusFail: 'Failed — try again',
  statusNone: 'Not started',

  // ── tracks (SPEC section 11) ──
  track: 'Track',
  trackName: (track: 'sql' | 'pyspark') => ({ sql: 'SQL', pyspark: 'PySpark' })[track],
  trackSwitchLabel: 'Choose your track: SQL or PySpark',
  trackHelp: 'You can switch at any time; a step counts once, in whichever track you pass it.',
  trackFallback: (track: string, shown: string) => `This step has no ${track} variant: both tracks use the ${shown} exercise.`,
  passedIn: (tracks: string) => `passed in: ${tracks}`,
  trackShared: (shown: string) => `${shown} (both tracks)`,
  trackChooseTitle: 'Choose your track',
  trackChooseIntro:
    'Every step has an SQL and a PySpark version. Pick the one that suits you; you can switch later with the SQL | PySpark switch at the top.',
  trackSqlDesc: 'You know SQL: SELECT, WHERE, GROUP BY. You work with queries and views.',
  trackPysparkDesc: 'You want to try Python: DataFrames and the PySpark API.',
  trackChooseButton: (track: string) => `Start in ${track}`,
  pickerTrackHint: 'Two tracks: SQL or PySpark. You choose when you open the workshop.',

  // ── workshop picker ──
  pickerTitle: 'Workshops and quiz',
  pickerIntro:
    'Pick a workshop and a track (SQL or PySpark). You do every exercise here and the guide checks it right away. Running the code in the notebook is optional.',
  unknownWorkshop: (id: string) => `Workshop “${id}” does not exist. Pick one below.`,
  stepCount: (required: number, optional: number) =>
    `${required} ${enPlural(required, 'step', 'steps')}${optional > 0 ? ` + ${optional} optional` : ''}`,
  openWorkshop: (name: string) => `Open ${name}`,
  quizItemTitle: 'III — Quiz',
  quizItemIntro:
    'Learning quiz for the whole day: one question at a time, with an explanation and the notebook section after each answer.',
  openQuiz: 'Open the quiz',

  // ── trainer unlock (participant side) ──
  lockedBadge: 'Locked',
  lockedText: 'Your trainer will unlock this at the right moment.',
  lockedNowTitle: 'Locked by the trainer',
  lockedNowText:
    'The trainer has locked this item for now. Nothing is lost: your answers and results stay saved. It opens again here as soon as the trainer unlocks it.',
  lockedQuizText: 'This page updates by itself.',
  lockedQuizNowText:
    'The trainer has locked the quiz for now. Nothing is lost: your answers so far are saved. The quiz opens again here as soon as the trainer unlocks it.',
  lockedForParticipants: 'Locked for participants',

  // ── trainer unlock (trainer view) ──
  accessTitle: 'Access',
  accessIntro: 'Participants see an item only after you unlock it. Saving takes a few seconds; participants see the change within about 15 seconds.',
  unlockAll: 'Unlock all',
  lockAll: 'Lock all',
  accessOn: 'Unlocked',
  accessOff: 'Locked',
  accessToggle: (label: string) => `Unlock ${label} for participants`,
  accessChanged: (by: string, ago: string) => `${by} · ${ago}`,
  accessDefault: 'Default — not changed yet',
  accessSaving: 'Saving…',
  lockAllTitle: 'Lock everything?',
  lockAllText:
    'All participants lose access to Workshops I and II and to the quiz right away. Their results and answers stay saved; after you unlock, they continue where they left off.',
  lockAllConfirm: 'Lock all',
  accessSaveFailed: (error: string) => `Could not save the change: ${error}`,
  accessLoadFailed: (error: string) => `Could not read the access state: ${error}. Retrying.`,
  notebookLocation: 'Notebook (optional): ',
  yourGitFolder: 'your Git folder',

  // ── workshop view ──
  workshopSteps: 'Workshop steps',
  stepsPassed: (passed: number, total: number) => `${passed} / ${total} steps passed`,
  optionalPassed: (n: number) => `+${n} optional`,
  requiredPassed: 'Required steps passed',
  progressLoading: 'Loading your progress…',
  progressPaused: 'Live status paused — retrying',
  progressLive: (ago: string) => `Live · updated ${ago}`,
  stepsButton: (passed: number, total: number) => `Steps (${passed}/${total})`,
  noStepsTitle: 'No steps',
  noStepsText: 'This workshop has no steps yet.',

  // ── reset my progress ──
  resetButton: 'Reset my progress',
  resetTitle: (label: string) => `Reset your progress in ${label}?`,
  resetText:
    'All your results in this workshop are deleted and every step starts again as not checked. Only your own results change. Your notebook, its code and the tables in your catalog stay as they are. This cannot be undone.',
  resetFailed: (error: string) => `Could not reset: ${error}`,
  resetConfirm: 'Reset progress',
  cancel: 'Cancel',

  // ── step pane ──
  stepNumber: (n: string) => `Step ${n}`,
  expectedResult: 'Expected result in the notebook: ',
  docsHeading: 'Documentation',
  stepNav: 'Step navigation',
  prevStep: 'Previous step',
  nextStep: 'Next step',
  liveTitlePass: 'Passed',
  liveTitleFail: 'Not yet — see the message',
  liveTitleNone: 'Not checked yet',
  announcePass: 'Passed',
  announceFail: 'Failed',
  checkRunCell: (n: string) =>
    `Run the Step ${n} cell in the notebook to the end (its last line saves your result), then press`,
  checkButton: 'Check',
  checkAgain: 'Check again',
  checking: 'Checking…',
  checkRunning: 'Running the check on the SQL warehouse…',
  checkFailed: (error: string) => `Check could not run: ${error}`,
  notRecorded: 'The result is shown here but was not saved to your progress. Press Check again.',
  lastCheck: (ago: string, runs: number) => `Last check ${ago} · ${runs} ${enPlural(runs, 'run', 'runs')}`,
  noResultYet: 'No result recorded yet',
  fromSource: (source: string) => ` · from ${source}`,
  liveUnavailable: (error: string) => `Live status unavailable: ${error}`,
  saveFailed: (error: string) => `Your result was not saved: ${error}`,
  saving: 'Saving your result…',
  saveRetry: 'Save the result again',

  // ── notebook (optional) ──
  notebookOptional: 'Notebook (optional)',
  notebookOptionalIntro: 'Want to see it on real data? Run the completed code in your notebook. This is optional and does not change your result here.',
  notebookSqlCell:
    'Paste it into a new cell of your workshop notebook (the first line %sql makes it an SQL cell). Views from earlier steps exist only in that notebook session, so run the steps in order there. In the SQL editor drop the %sql line and run USE CATALOG with your catalog first.',
  notebookPlaceholders: (list: string) => `Replace ${list} with your own values before you run it.`,
  notebookSaveNote: 'The last lines (comment “optional: saves your result…”) save your result for the Check on data button.',
  notebookPythonCell: 'Paste it into a new Python cell of your notebook.',
  notebookIncomplete: 'Finish the exercise above first; until then the code still has gaps or blocks out of order.',
  notebookNoCode: 'This exercise has no code to run.',
  dataCheckButton: 'Check on data',
  dataCheckBonus: 'optional bonus',
  dataCheckIntro: 'After running the code, check the tables in your catalog. The result is only for you: it does not change the step.',
  dataCheckPass: 'Your data looks right.',
  dataCheckFail: 'Your data is not there yet.',

  // ── hints ──
  hintsHeading: 'Hints',
  hintsShown: (shown: number, total: number) => `${shown} of ${total} shown`,
  hintN: (n: number) => `Hint ${n}`,
  solution: 'Solution',
  showHint: 'Show a hint',
  showNextHint: 'Show the next hint',
  showSolution: 'Show the solution',
  solutionConfirmTitle: 'Show the full solution?',
  solutionConfirmText: 'You learn more by trying once more with the hints you already have.',
  keepTrying: 'Keep trying',
  solutionConfirm: 'Show solution',

  // ── copy ──
  copy: 'Copy',
  copied: 'Copied',
  copyFailed: 'Copy failed',
  copiedToClipboard: 'Copied to clipboard',
  reset: 'Reset',

  // ── exercises ──
  codeNoStarter:
    'Write the code in the empty cell of this step in your notebook. Use the hints below if you get stuck.',
  codeStarter: 'Start from this skeleton in your notebook:',
  fillGroup: 'Code with blanks',
  blankN: (n: number) => `Blank ${n}`,
  blankWrongTitle: 'Not the expected answer yet: check the spelling, the keyword and any quotes.',
  fillAnyWrong:
    'A red blank is not the expected answer yet. Check the spelling, the exact keyword and any quotes; the hints below help.',
  fillAllCorrect: (total: number) => `All ${total} blanks correct.`,
  fillProgress: (correct: number, total: number) => `${correct} of ${total} blanks correct`,

  matchHowBefore: 'Drag each term onto its description, or tap a term and then tap',
  matchHowAfter: 'next to its description.',
  matchScreenReader:
    'Press Enter to select this term, then choose a description and press Enter to place it. Mouse users can drag.',
  terms: 'Terms',
  allTermsPlaced: 'All terms placed.',
  placeHere: 'Place here',
  dropTerm: 'Drop a term',
  placeOn: (description: string) => `Place selected term on: ${description}`,
  swap: 'Swap',
  swapOn: (description: string) => `Replace with selected term: ${description}`,
  moveBack: (term: string) => `Move ${term} back to terms`,
  correct: 'Correct',
  incorrect: 'Incorrect',
  placeEveryTerm: 'Place every term first',
  checkPairs: 'Check pairs',
  matchResult: (pass: boolean, correct: number, total: number) =>
    pass ? `All ${total} pairs matched.` : `${correct} of ${total} pairs matched.`,
  matchWrongMarked: 'Wrong pairs are marked; move them and check again.',

  orderHowMobile: (plus: string, solution: string) =>
    `Tap ${plus} to add a block to “${solution}”, then use ↑ / ↓ to put the blocks in order and × to take one out.`,
  orderHowDesktopBefore: 'Drag blocks into',
  orderHowDesktopAfter:
    'and put them in order, or use the + / ↑ / ↓ / × buttons. With the keyboard: focus a handle, press Space, move with the arrow keys, press Space again.',
  availableBlocks: 'Available blocks',
  yourSolution: 'Your solution',
  allBlocksUsed: 'All blocks are in your solution.',
  dragBlocksHere: 'Drag blocks here.',
  addToSolution: (line: string) => `Add to solution: ${line}`,
  moveUp: (line: string) => `Move up: ${line}`,
  moveDown: (line: string) => `Move down: ${line}`,
  removeFromSolution: (line: string) => `Remove from solution: ${line}`,
  dragBlock: (line: string) => `Drag block: ${line}`,
  checkOrder: 'Check order',
  orderCopyNext: 'The completed code is under “Notebook (optional)”.',
  orderResult: (r: {
    pass: boolean;
    total: number;
    correctPositions: number;
    distractorsUsed: number;
    missing: number;
  }) => {
    if (r.pass) return `Correct order: all ${r.total} blocks in place.`;
    const parts = [`${r.correctPositions} of ${r.total} blocks in the right place.`];
    if (r.distractorsUsed > 0)
      parts.push(`${r.distractorsUsed} ${enPlural(r.distractorsUsed, 'block does', 'blocks do')} not belong here.`);
    if (r.missing > 0) parts.push(`${r.missing} ${enPlural(r.missing, 'block is', 'blocks are')} missing.`);
    return parts.join(' ');
  },

  // ── trainer view ──
  trainerTitle: 'Trainer view',
  trainerOnly: 'This page is for trainers. Ask the trainer to add your email to',
  trainerOnlyAfter: 'in the app configuration.',
  groupProgress: 'Group progress',
  trainerIntroWorkshops: 'Latest result per participant and step. Refreshes every 5 seconds.',
  trainerIntroQuiz: 'Quiz results per participant and question. Refreshes every 5 seconds.',
  tabWorkshops: 'Workshops',
  tabQuiz: 'Quiz',
  workshop: 'Workshop',
  kpiParticipants: 'Participants',
  kpiParticipantsNote: 'with at least one result',
  kpiFinished: 'Finished all required',
  kpiFinishedNote: (of: number, required: number) => `of ${of} · ${required} required steps`,
  kpiStuck: 'Stuck right now',
  kpiStuckNote: 'latest result on a step is a fail',
  kpiLastActivity: 'Last activity',
  kpiLastActivityNote: 'any participant',
  updatedAt: (time: string, source: string) => `Updated ${time} · source: ${source}`,
  sourceProgress: 'progress table',
  sourceQuiz: 'progress table (workshop = quiz)',
  matrixLoadFailed: (error: string) => `Could not load the matrix: ${error}`,
  refreshFailed: (error: string) => `Could not refresh: ${error}. Showing the last data received; retrying.`,
  noResultsTitle: 'No results yet',
  noResultsText: 'Participants appear here after their first checked exercise in the guide.',
  matrixCaption: (label: string) => `${label}: result per participant and step`,
  colParticipant: 'Participant',
  colDone: 'Done',
  colHints: 'Hints',
  colLastActivity: 'Last activity',
  rowPassed: 'Passed',
  optionalSuffix: ' (optional)',
  stepTotals: (passed: number, failed: number, notStarted: number) =>
    `${passed} passed, ${failed} tried but not passed, ${notStarted} not started`,
  cellRuns: (runs: number) => `${runs} ${enPlural(runs, 'run', 'runs')}`,
  cellHints: (n: number) => `hints: ${n}`,
  cellAttempts: (n: number) => `attempts: ${n}`,
  cellNotStarted: 'not started',
  hintsCount: (n: number) => `${n} ${enPlural(n, 'hint', 'hints')}`,
  legend: 'Legend',
  legendPass: 'passed',
  legendFail: 'tried, not passed yet',
  legendNone: 'not started',
  legendHints: 'hints used',

  // ── trainer quiz tab ──
  quizUnavailable: 'Quiz unavailable',
  quizNotConfiguredTrainer: 'The quiz is not configured: participants cannot answer',
  unknownReason: 'Unknown reason.',
  quizFixBefore: 'Fix: run',
  quizFixUpload: ', upload',
  quizFixGrant: 'to the volume and grant the app service principal',
  quizFixAfter: '(README, “Quiz”). The app reloads the key within 30 s.',
  kpiQuizParticipantsNote: 'answered at least one question',
  kpiCompleted: 'Completed',
  kpiCompletedNote: (total: number) => `solved all ${total} questions`,
  kpiAverage: 'Average score',
  kpiAverageNote: 'first attempts correct',
  quizLoadFailed: (error: string) => `Could not load quiz results: ${error}`,
  quizRefreshFailed: (error: string) => `Could not refresh: ${error}. Retrying.`,
  noQuizAnswersTitle: 'No quiz answers yet',
  noQuizAnswersText: 'Participants appear here after their first answer on the Quiz page.',
  participantsCaption: 'First-attempt score and completion per participant',
  colFirstAttempt: 'First-attempt score',
  colSolved: 'Solved',
  solvedAll: 'all',
  solvedOpen: (n: number) => ` · ${n} open`,
  questionsHardest: 'Questions, hardest first',
  questionsCaption: 'First-attempt correct rate per question, lowest first',
  colQuestion: 'Question',
  colFirstTry: 'First try correct',
  colCommonWrong: 'Common wrong',

  // ── quiz page ──
  quizTitle: 'Quiz',
  quizIntro:
    'Check what stayed with you from today’s modules. After each answer you see an explanation and the notebook section that covers it. Retry until you get it right; your score counts first attempts.',
  quizAllModules: 'All modules',
  quizModule: 'Module',
  quizQuestion: 'Question',
  quizOf: 'of',
  quizCorrect: 'Correct!',
  quizIncorrect: 'Not this time. Try again.',
  quizWhereToLearn: 'Where to learn',
  quizNext: 'Next question',
  quizPrev: 'Previous',
  quizSkip: 'Skip',
  quizSummary: 'Summary',
  quizAnswered: (solved: number, total: number) => `${solved} / ${total} solved`,
  quizFirstAttempt: 'First-attempt score',
  quizToReview: 'To review',
  quizToReviewNote: 'Questions where your first answer was wrong.',
  quizNothingToReview: 'All correct on the first try. Well done!',
  quizNotAnswered: 'Not answered yet',
  quizBackToQuestions: 'Back to the questions',
  quizNotConfiguredTitle: 'The quiz is not configured yet',
  quizNotConfigured: 'The answer key is missing. Tell the trainer.',
  quizTrainerReason: 'Reason (visible to trainers only)',
  quizAlreadySolved: 'Solved. The explanation appears as soon as the server returns it.',
  quizSaving: 'Checking…',
  quizLoading: 'Loading the quiz…',
  quizKeyboard: 'Shortcuts: A–D picks an answer, N goes to the next question.',
  quizQuestions: 'Questions',
  quizQuestionCount: (n: number) => `${n} ${enPlural(n, 'question', 'questions')}`,
  quizRetried: 'after a retry',
  quizProgressLabel: 'Questions solved',
};
