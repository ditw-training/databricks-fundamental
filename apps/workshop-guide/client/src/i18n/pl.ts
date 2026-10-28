/** Polish UI texts. Same keys and shapes as `en.ts` (checked by the type `Dict`). */
import type { en } from './en';
import { plPlural } from './plural';

export type Dict = typeof en;

export const pl: Dict = {
  // ── shell ──
  appName: 'Workshop Guide',
  navMain: 'Menu główne',
  navWorkshops: 'Warsztaty',
  navQuiz: 'Quiz',
  navTrainer: 'Trener',
  signedInAs: 'Zalogowano jako',
  language: 'Język',
  loading: 'Ładowanie',
  startErrorTitle: 'Nie udało się uruchomić przewodnika',
  unknownError: 'Nieznany błąd',
  startErrorHelp: 'Odśwież stronę. Jeśli błąd wraca, daj znać prowadzącemu.',
  notFound: 'Nie ma takiej strony.',
  backToWorkshops: 'Wróć do warsztatów',
  themeName: (theme) => ({ system: 'systemowy', light: 'jasny', dark: 'ciemny' })[theme],
  themeTitle: (name) => `Motyw: ${name}`,
  themeSwitch: (name, next) => `Motyw: ${name}. Przełącz na: ${next}`,

  // ── time ──
  agoJustNow: 'przed chwilą',
  agoSeconds: (s) => `${s} s temu`,
  agoMinutes: (m) => `${m} min temu`,
  agoHours: (h) => `${h} godz. temu`,

  // ── step types and status ──
  typeFill: 'Uzupełnij luki',
  typeOrder: 'Ułóż w kolejności',
  typeMatch: 'Połącz w pary',
  typeCode: 'Napisz kod',
  optional: 'Opcjonalny',
  optionalShort: 'opc.',
  optionalNote: 'Ten krok jest opcjonalny: możesz go pominąć, kolejne kroki go nie wymagają.',
  statusPass: 'Zaliczony',
  statusFail: 'Niezaliczony, spróbuj jeszcze raz',
  statusNone: 'Nierozpoczęty',

  // ── workshop picker ──
  pickerTitle: 'Warsztaty i quiz',
  pickerIntro:
    'Obok przewodnika otwórz odpowiedni notebook. Tam piszesz i uruchamiasz kod, a przewodnik objaśnia każdy krok i pokazuje twoje postępy.',
  unknownWorkshop: (id) => `Warsztat „${id}” nie istnieje. Wybierz jeden z poniższych.`,
  stepCount: (required, optional) =>
    `${required} ${plPlural(required, 'krok', 'kroki', 'kroków')}${
      optional > 0 ? ` + ${optional} ${plPlural(optional, 'opcjonalny', 'opcjonalne', 'opcjonalnych')}` : ''
    }`,
  openWorkshop: (name) => `Otwórz ${name}`,
  quizItemTitle: 'III — Quiz',
  quizItemIntro:
    'Quiz utrwalający z całego dnia: jedno pytanie naraz, po każdej odpowiedzi wyjaśnienie i sekcja notebooka.',
  openQuiz: 'Otwórz quiz',

  // ── trainer unlock (participant side) ──
  lockedBadge: 'Zablokowane',
  lockedText: 'Trener odblokuje to w odpowiednim momencie.',
  lockedNowTitle: 'Zablokowane przez trenera',
  lockedNowText:
    'Trener na razie zablokował tę część. Nic nie ginie: kod zostaje w notebooku, a wyniki są zapisane. Strona otworzy się tu znowu, gdy trener ją odblokuje.',
  lockedQuizText: 'Ta strona odświeży się sama.',
  lockedQuizNowText:
    'Trener na razie zablokował quiz. Nic nie ginie: twoje dotychczasowe odpowiedzi są zapisane. Quiz otworzy się tu znowu, gdy trener go odblokuje.',
  lockedForParticipants: 'Zablokowane dla uczestników',

  // ── trainer unlock (trainer view) ──
  accessTitle: 'Dostęp',
  accessIntro: 'Uczestnicy widzą daną część dopiero po jej odblokowaniu. Zapis trwa kilka sekund, a uczestnicy widzą zmianę najpóźniej kilkanaście sekund później.',
  unlockAll: 'Odblokuj wszystko',
  lockAll: 'Zablokuj wszystko',
  accessOn: 'Odblokowane',
  accessOff: 'Zablokowane',
  accessToggle: (label) => `Odblokuj ${label} dla uczestników`,
  accessChanged: (by, ago) => `${by} · ${ago}`,
  accessDefault: 'Ustawienie domyślne — jeszcze nie zmieniano',
  accessSaving: 'Zapisuję…',
  lockAllTitle: 'Zablokować wszystko?',
  lockAllText:
    'Wszyscy uczestnicy stracą od razu dostęp do warsztatów I i II oraz do quizu. Ich wyniki i odpowiedzi zostają zapisane; po odblokowaniu wracają tam, gdzie skończyli.',
  lockAllConfirm: 'Zablokuj wszystko',
  accessSaveFailed: (error) => `Nie udało się zapisać zmiany: ${error}`,
  accessLoadFailed: (error) => `Nie udało się odczytać dostępu: ${error}. Ponawiam.`,
  notebookLocation: 'Lokalizacja notebooka: ',
  yourGitFolder: 'twój folder Git',

  // ── workshop view ──
  workshopSteps: 'Kroki warsztatu',
  stepsPassed: (passed, total) => `Zaliczone kroki: ${passed} / ${total}`,
  requiredPassed: 'Zaliczone kroki obowiązkowe',
  progressLoading: 'Wczytuję twoje postępy…',
  progressPaused: 'Podgląd na żywo wstrzymany, ponawiam…',
  progressLive: (ago) => `Na żywo · odświeżono ${ago}`,
  stepsButton: (passed, total) => `Kroki (${passed}/${total})`,
  noStepsTitle: 'Brak kroków',
  noStepsText: 'Ten warsztat nie ma jeszcze kroków.',

  // ── reset my progress ──
  resetButton: 'Wyczyść moje postępy',
  resetTitle: (label) => `Wyczyścić twoje postępy (${label})?`,
  resetText:
    'Wszystkie twoje wyniki w tym warsztacie zostaną usunięte, a każdy krok wróci do stanu „nie sprawdzono”. Zmieniają się tylko twoje wyniki. Notebook, jego kod i tabele w twoim katalogu zostają bez zmian. Tego nie da się cofnąć.',
  resetFailed: (error) => `Nie udało się wyczyścić postępów: ${error}`,
  resetConfirm: 'Wyczyść postępy',
  cancel: 'Anuluj',

  // ── step pane ──
  stepNumber: (n) => `Krok ${n}`,
  expectedResult: 'Oczekiwany wynik: ',
  docsHeading: 'Dokumentacja',
  stepNav: 'Nawigacja między krokami',
  prevStep: 'Poprzedni krok',
  nextStep: 'Następny krok',
  liveTitlePass: 'Zaliczone',
  liveTitleFail: 'Jeszcze nie, przeczytaj komunikat',
  liveTitleNone: 'Jeszcze nie sprawdzono',
  announcePass: 'Zaliczone',
  announceFail: 'Niezaliczone',
  checkRunCell: (n) =>
    `Uruchom do końca komórkę pod nagłówkiem Step ${n} w notebooku (jej ostatnia linia zapisuje twój wynik), a potem kliknij`,
  checkButton: 'Sprawdź',
  checkAgain: 'Sprawdź ponownie',
  checking: 'Sprawdzam…',
  checkRunning: 'Uruchamiam sprawdzenie na SQL warehouse…',
  checkFailed: (error) => `Nie udało się uruchomić sprawdzenia: ${error}`,
  notRecorded: 'Wynik widać tutaj, ale nie zapisał się w twoich postępach. Kliknij ponownie Sprawdź.',
  lastCheck: (ago, runs) =>
    `Ostatnie sprawdzenie ${ago} · ${runs} ${plPlural(runs, 'uruchomienie', 'uruchomienia', 'uruchomień')}`,
  noResultYet: 'Brak zapisanego wyniku',
  fromSource: (source) => ` · źródło: ${source}`,
  liveUnavailable: (error) => `Podgląd na żywo niedostępny: ${error}`,
  saveFailed: (error) => `Twój wynik nie został zapisany: ${error}`,

  // ── paste hint ──
  pasteInto: 'Wklej do komórki z kodem pod nagłówkiem',
  pasteIn: 'w notebooku',
  pasteSql: '(zastąp kod, zostaw pierwszą linię',
  pasteReplace: '(zastąp kod, który tam jest',
  pasteKeepSaveLine: '; jeśli komórka kończy się linią zapisującą twój wynik, zostaw ją na końcu)',
  pasteRun: 'Uruchom komórkę do końca',
  pasteRunThenCheck: ', a potem kliknij Sprawdź poniżej',

  // ── hints ──
  hintsHeading: 'Podpowiedzi',
  hintsShown: (shown, total) => `widoczne: ${shown} z ${total}`,
  hintN: (n) => `Podpowiedź ${n}`,
  solution: 'Rozwiązanie',
  showHint: 'Pokaż podpowiedź',
  showNextHint: 'Pokaż kolejną podpowiedź',
  showSolution: 'Pokaż rozwiązanie',
  solutionConfirmTitle: 'Pokazać całe rozwiązanie?',
  solutionConfirmText: 'Więcej się nauczysz, jeśli spróbujesz jeszcze raz z podpowiedziami, które już masz.',
  keepTrying: 'Spróbuję jeszcze',
  solutionConfirm: 'Pokaż rozwiązanie',

  // ── copy ──
  copy: 'Kopiuj',
  copied: 'Skopiowano',
  copyFailed: 'Nie udało się skopiować',
  copiedToClipboard: 'Skopiowano do schowka',
  copyToNotebook: 'Kopiuj do notebooka',
  reset: 'Wyczyść',

  // ── exercises ──
  codeNoStarter:
    'Napisz kod w pustej komórce tego kroku w notebooku. Jeśli utkniesz, skorzystaj z podpowiedzi poniżej.',
  codeStarter: 'Zacznij w notebooku od tego szkieletu:',
  fillGroup: 'Kod z lukami',
  blankN: (n) => `Luka ${n}`,
  blankWrongTitle: 'To jeszcze nie ta odpowiedź: sprawdź pisownię, słowo kluczowe i cudzysłowy.',
  fillAnyWrong:
    'Czerwona luka to jeszcze nie ta odpowiedź. Sprawdź pisownię, dokładne słowo kluczowe i cudzysłowy. Pomogą ci podpowiedzi poniżej.',
  fillAllCorrect: (total) =>
    `${total === 1 ? 'Luka poprawna' : `Wszystkie luki poprawne (${total})`}. Skopiuj kod do notebooka.`,
  fillProgress: (correct, total) => `Poprawne luki: ${correct} z ${total}`,
  fillEmptyCopied: 'Puste luki kopiują się jako ____, żeby łatwo było je znaleźć w notebooku.',

  matchHowBefore: 'Przeciągnij każde pojęcie na jego opis albo kliknij pojęcie, a potem',
  matchHowAfter: 'obok opisu.',
  matchScreenReader:
    'Naciśnij Enter, aby wybrać to pojęcie, potem wybierz opis i naciśnij Enter, aby je tam umieścić. Myszą możesz przeciągać.',
  terms: 'Pojęcia',
  allTermsPlaced: 'Wszystkie pojęcia są na miejscach.',
  placeHere: 'Umieść tutaj',
  dropTerm: 'Upuść pojęcie',
  placeOn: (description) => `Umieść wybrane pojęcie przy opisie: ${description}`,
  swap: 'Zamień',
  swapOn: (description) => `Zamień na wybrane pojęcie: ${description}`,
  moveBack: (term) => `Odłóż ${term} z powrotem do pojęć`,
  correct: 'Dobrze',
  incorrect: 'Źle',
  placeEveryTerm: 'Najpierw umieść wszystkie pojęcia',
  checkPairs: 'Sprawdź pary',
  matchResult: (pass, correct, total) =>
    pass ? `Wszystkie pary połączone dobrze (${total}).` : `Dobrze połączone pary: ${correct} z ${total}.`,
  matchWrongMarked: 'Błędne pary są oznaczone. Przenieś je i sprawdź ponownie.',

  orderHowMobile: (plus, solution) =>
    `Kliknij ${plus}, aby dodać blok do sekcji „${solution}”. Strzałkami ↑ / ↓ ułóż bloki w kolejności, a × usuwa blok.`,
  orderHowDesktopBefore: 'Przeciągnij bloki do sekcji',
  orderHowDesktopAfter:
    'i ułóż je w kolejności albo użyj przycisków + / ↑ / ↓ / ×. Z klawiatury: przejdź do uchwytu, naciśnij Spację, przesuń blok strzałkami i znów naciśnij Spację.',
  availableBlocks: 'Dostępne bloki',
  yourSolution: 'Twoje rozwiązanie',
  allBlocksUsed: 'Wszystkie bloki są w twoim rozwiązaniu.',
  dragBlocksHere: 'Przeciągnij bloki tutaj.',
  addToSolution: (line) => `Dodaj do rozwiązania: ${line}`,
  moveUp: (line) => `Przesuń w górę: ${line}`,
  moveDown: (line) => `Przesuń w dół: ${line}`,
  removeFromSolution: (line) => `Usuń z rozwiązania: ${line}`,
  dragBlock: (line) => `Przeciągnij blok: ${line}`,
  addBlocksFirst: 'Najpierw dodaj bloki do rozwiązania',
  checkOrder: 'Sprawdź kolejność',
  orderCopyNext: 'Skopiuj kod do notebooka i uruchom komórkę.',
  orderResult: (r) => {
    if (r.pass) return `Dobra kolejność: wszystkie bloki na miejscu (${r.total}).`;
    const parts = [`Bloki na właściwym miejscu: ${r.correctPositions} z ${r.total}.`];
    if (r.distractorsUsed > 0) parts.push(`Bloki, które tu nie pasują: ${r.distractorsUsed}.`);
    if (r.missing > 0) parts.push(`Brakujące bloki: ${r.missing}.`);
    return parts.join(' ');
  },

  // ── trainer view ──
  trainerTitle: 'Widok trenera',
  trainerOnly: 'Ta strona jest dla prowadzących. Poproś prowadzącego, żeby dodał twój e-mail do',
  trainerOnlyAfter: 'w konfiguracji aplikacji.',
  groupProgress: 'Postępy grupy',
  trainerIntroWorkshops: 'Ostatni wynik każdego uczestnika w każdym kroku. Odświeża się co 5 sekund.',
  trainerIntroQuiz: 'Wyniki quizu według uczestników i pytań. Odświeża się co 5 sekund.',
  tabWorkshops: 'Warsztaty',
  tabQuiz: 'Quiz',
  workshop: 'Warsztat',
  kpiParticipants: 'Uczestnicy',
  kpiParticipantsNote: 'z co najmniej jednym wynikiem',
  kpiFinished: 'Ukończyli obowiązkowe',
  kpiFinishedNote: (of, required) =>
    `z ${of} · ${required} ${plPlural(required, 'krok obowiązkowy', 'kroki obowiązkowe', 'kroków obowiązkowych')}`,
  kpiStuck: 'Utknęli teraz',
  kpiStuckNote: 'ostatni wynik w kroku jest niezaliczony',
  kpiLastActivity: 'Ostatnia aktywność',
  kpiLastActivityNote: 'dowolny uczestnik',
  updatedAt: (time, source) => `Odświeżono ${time} · źródło: ${source}`,
  sourceProgress: 'tabela postępów',
  sourceQuiz: 'tabela postępów (workshop = quiz)',
  matrixLoadFailed: (error) => `Nie udało się wczytać tabeli: ${error}`,
  refreshFailed: (error) => `Nie udało się odświeżyć: ${error}. Pokazuję ostatnie dane, ponawiam.`,
  noResultsTitle: 'Brak wyników',
  noResultsText:
    'Uczestnicy pojawią się tutaj po pierwszym kliknięciu Sprawdź albo po pierwszym sprawdzonym ćwiczeniu.',
  matrixCaption: (label) => `${label}: wynik każdego uczestnika w każdym kroku`,
  colParticipant: 'Uczestnik',
  colDone: 'Zaliczone',
  colHints: 'Podpowiedzi',
  colLastActivity: 'Ostatnia aktywność',
  rowPassed: 'Zaliczyli',
  optionalSuffix: ' (opcjonalny)',
  stepTotals: (passed, failed, notStarted) =>
    `zaliczyło: ${passed}, próbowało bez zaliczenia: ${failed}, nie zaczęło: ${notStarted}`,
  cellRuns: (runs) => `${runs} ${plPlural(runs, 'uruchomienie', 'uruchomienia', 'uruchomień')}`,
  cellHints: (n) => `podpowiedzi: ${n}`,
  cellAttempts: (n) => `próby: ${n}`,
  cellNotStarted: 'nierozpoczęty',
  hintsCount: (n) => `${n} ${plPlural(n, 'podpowiedź', 'podpowiedzi', 'podpowiedzi')}`,
  legend: 'Legenda',
  legendPass: 'zaliczony',
  legendFail: 'ostatnie sprawdzenie niezaliczone',
  legendNone: 'nierozpoczęty',
  legendHints: 'użyte podpowiedzi (kroki sprawdzane w aplikacji)',

  // ── trainer quiz tab ──
  quizUnavailable: 'Quiz niedostępny',
  quizNotConfiguredTrainer: 'Quiz nie jest skonfigurowany: uczestnicy nie mogą odpowiadać',
  unknownReason: 'Nieznany powód.',
  quizFixBefore: 'Naprawa: uruchom',
  quizFixUpload: ', wgraj',
  quizFixGrant: 'do woluminu i nadaj service principalowi aplikacji uprawnienie',
  quizFixAfter: '(README, „Quiz”). Aplikacja wczyta klucz w ciągu 30 s.',
  kpiQuizParticipantsNote: 'odpowiedzieli na co najmniej jedno pytanie',
  kpiCompleted: 'Ukończyli',
  kpiCompletedNote: (total) => `rozwiązali wszystkie pytania (${total})`,
  kpiAverage: 'Średni wynik',
  kpiAverageNote: 'dobre odpowiedzi za pierwszym razem',
  quizLoadFailed: (error) => `Nie udało się wczytać wyników quizu: ${error}`,
  quizRefreshFailed: (error) => `Nie udało się odświeżyć: ${error}. Ponawiam.`,
  noQuizAnswersTitle: 'Brak odpowiedzi w quizie',
  noQuizAnswersText: 'Uczestnicy pojawią się tutaj po pierwszej odpowiedzi na stronie Quiz.',
  participantsCaption: 'Wynik za pierwszą próbę i ukończenie według uczestników',
  colFirstAttempt: 'Wynik za pierwszą próbę',
  colSolved: 'Rozwiązane',
  solvedAll: 'wszystkie',
  solvedOpen: (n) => ` · otwarte: ${n}`,
  questionsHardest: 'Pytania, od najtrudniejszych',
  questionsCaption: 'Odsetek dobrych odpowiedzi za pierwszym razem, od najniższego',
  colQuestion: 'Pytanie',
  colFirstTry: 'Dobrze za pierwszym razem',
  colCommonWrong: 'Częsta zła odpowiedź',

  // ── quiz page ──
  quizTitle: 'Quiz',
  quizIntro:
    'Sprawdź, co zostało z dzisiejszych modułów. Po każdej odpowiedzi zobaczysz wyjaśnienie i miejsce w notebooku, gdzie temat był omawiany. Możesz próbować do skutku; do wyniku liczy się pierwsza próba.',
  quizAllModules: 'Wszystkie moduły',
  quizModule: 'Moduł',
  quizQuestion: 'Pytanie',
  quizOf: 'z',
  quizCorrect: 'Dobrze!',
  quizIncorrect: 'Nie tym razem. Spróbuj ponownie.',
  quizWhereToLearn: 'Gdzie się tego nauczyć',
  quizNext: 'Następne pytanie',
  quizPrev: 'Poprzednie',
  quizSkip: 'Pomiń',
  quizSummary: 'Podsumowanie',
  quizAnswered: (solved, total) => `Rozwiązane: ${solved} / ${total}`,
  quizFirstAttempt: 'Wynik za pierwszą próbę',
  quizToReview: 'Do powtórki',
  quizToReviewNote: 'Pytania, w których pierwsza odpowiedź była błędna.',
  quizNothingToReview: 'Wszystko dobrze za pierwszym razem. Brawo!',
  quizNotAnswered: 'Bez odpowiedzi',
  quizBackToQuestions: 'Wróć do pytań',
  quizNotConfiguredTitle: 'Quiz nie jest jeszcze skonfigurowany',
  quizNotConfigured: 'Brakuje klucza odpowiedzi. Daj znać prowadzącemu.',
  quizTrainerReason: 'Powód (widoczny tylko dla prowadzących)',
  quizAlreadySolved: 'Rozwiązane. Wyjaśnienie pojawi się, gdy tylko serwer je zwróci.',
  quizSaving: 'Sprawdzam…',
  quizLoading: 'Ładowanie quizu…',
  quizKeyboard: 'Skróty: A–D wybiera odpowiedź, N następne pytanie.',
  quizQuestions: 'Pytania',
  quizQuestionCount: (n) => `${n} ${plPlural(n, 'pytanie', 'pytania', 'pytań')}`,
  quizRetried: 'po kolejnej próbie',
  quizProgressLabel: 'Rozwiązane pytania',
};
