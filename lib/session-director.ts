export type DirectorState = {
  childTurnCount: number;
  consecutiveAssistantQuestions: number;
  assistantTurnsWithoutEnglish: number;
  pendingPracticePhrase: string | null;
  pendingChildQuestion: string | null;
  recentChildTranscripts: string[];
  topicEstablished: boolean;
  slowSpeech: boolean;
};

export const INITIAL_DIRECTOR_STATE: DirectorState = {
  childTurnCount: 0,
  consecutiveAssistantQuestions: 0,
  assistantTurnsWithoutEnglish: 0,
  pendingPracticePhrase: null,
  pendingChildQuestion: null,
  recentChildTranscripts: [],
  topicEstablished: false,
  slowSpeech: false,
};

const UNCERTAIN_SCRIPT = /[\u0400-\u04ff\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/;

function practiceLooksAttempted(expected: string | null, actual: string) {
  if (!expected) return false;
  const expectedWords: string[] = expected.toLowerCase().match(/[a-z]+/g) ?? [];
  const actualWords: string[] = actual.toLowerCase().match(/[a-z]+/g) ?? [];
  const hasMatchingWord = actualWords.some((word) => expectedWords.includes(word));
  const koreanPhoneticAttempt = (actual.match(/[가-힣]/g) ?? []).length >= 4;
  return hasMatchingWord || koreanPhoneticAttempt;
}

export function recordAssistantTurn(
  state: DirectorState,
  transcript: string,
): DirectorState {
  const askedQuestion = transcript.includes("?");
  const containsEnglish = /\b[A-Za-z]{2,}\b/.test(transcript);
  const practiceMatch = transcript.match(
    /(?:이렇게 말해보자|따라 해볼까)[^"“]*["“]([^"”]+)["”]/,
  );
  const pendingPracticePhrase =
    practiceMatch?.[1] && /[A-Za-z]/.test(practiceMatch[1])
      ? practiceMatch[1].trim()
      : state.pendingPracticePhrase;
  return {
    ...state,
    consecutiveAssistantQuestions: askedQuestion
      ? state.consecutiveAssistantQuestions + 1
      : 0,
    assistantTurnsWithoutEnglish: containsEnglish
      ? 0
      : state.assistantTurnsWithoutEnglish + 1,
    pendingPracticePhrase,
    pendingChildQuestion: null,
  };
}

export function directChildTurn(
  state: DirectorState,
  transcript: string,
): {
  state: DirectorState;
  instructions: string;
  speed: number;
  mode: string;
} {
  const text = transcript.trim();
  const asksForSlowerSpeech = /말.{0,4}빠르|천천히|slow(?:er)?/i.test(text);
  const childUsedEnglish = /\b[A-Za-z]{2,}\b/.test(text);
  const sensitiveMoment = /무서|때렸|때려|아파|괴롭|비밀|도와줘|싫어 죽겠/.test(text);
  const repairRequest = /뭐라고|뭐라|못.{0,3}알아|어려워/.test(text);
  const childAskedQuestion =
    !repairRequest && /[?？]|궁금|어떻게|왜|뭐야|언제|누구/.test(text);
  const returnGreeting =
    state.childTurnCount === 0 && /^(?:안녕|hello|hi)[?!. ]*$/i.test(text);
  const doesNotEstablishTopic =
    returnGreeting ||
    repairRequest ||
    /모르겠|몰라|글쎄/.test(text);
  const practiceWasPending = state.pendingPracticePhrase !== null;
  const refusedPractice = /싫어|안 할|안해|안 해|모르겠|몰라|no\b/i.test(text);
  const attemptedPractice = practiceLooksAttempted(
    state.pendingPracticePhrase,
    text,
  );
  const nextState: DirectorState = {
    ...state,
    childTurnCount: state.childTurnCount + 1,
    pendingPracticePhrase: practiceWasPending
      ? null
      : state.pendingPracticePhrase,
    pendingChildQuestion: childAskedQuestion
      ? text
      : state.pendingChildQuestion,
    recentChildTranscripts: [...state.recentChildTranscripts, text].slice(-3),
    topicEstablished:
      state.topicEstablished ||
      (!doesNotEstablishTopic && !UNCERTAIN_SCRIPT.test(text)),
    slowSpeech: state.slowSpeech || asksForSlowerSpeech,
  };

  const common = [
    `The latest child transcript is: ${JSON.stringify(text)}.`,
    "Respond to this exact meaning before adding anything.",
    "Do not introduce a new object, activity, setting, or topic from one loosely related word.",
    "Use Korean to manage understanding, but keep this an English-learning conversation.",
    "In a normal turn, naturally echo one key part of Siha's meaning in 2 to 5 very easy English words.",
    "Do not use the phrase 'You can say' unless this is the occasional guided speaking turn.",
    `Recent child turns are: ${JSON.stringify(nextState.recentChildTranscripts)}.`,
    nextState.pendingChildQuestion
      ? `An unanswered child question has priority: ${JSON.stringify(nextState.pendingChildQuestion)}.`
      : "There is no unanswered child question.",
  ];

  let mode = "grounded_reply";
  const turnRules: string[] = [];

  if (!text || UNCERTAIN_SCRIPT.test(text)) {
    mode = "confirm_uncertain";
    turnRules.push(
      "The transcript is unreliable. Do not guess its meaning.",
      "In Korean, say you did not hear the last part clearly and ask her to repeat it once.",
      "Do not add a content question or a multiple-choice guess.",
    );
  } else if (returnGreeting) {
    mode = "return_greeting";
    turnRules.push(
      "Return the greeting warmly in one short sentence.",
      "Do not introduce yourself again or repeat the full opening.",
    );
  } else if (sensitiveMoment) {
    mode = "sensitive_support";
    turnRules.push(
      "This is a sensitive moment. Respond mainly in calm Korean and do not turn it into an English exercise.",
      "Reflect only what Siha actually said. Do not intensify it, judge anyone, take sides, or repeatedly investigate.",
      "Ask at most one simple safety clarification if needed. Encourage telling a nearby trusted adult if she may be unsafe.",
    );
  } else if (asksForSlowerSpeech) {
    mode = "slow_down";
    turnRules.push(
      "Acknowledge in Korean that you will speak more slowly.",
      "Use one short sentence, spoken calmly, and do not ask a new question in this turn.",
    );
  } else if (repairRequest) {
    mode = "repair_question";
    turnRules.push(
      "Briefly apologize in Korean and restate only your immediately previous question in easier Korean.",
      "Do not expand it with three choices or extra explanation.",
    );
  } else if (childAskedQuestion || state.pendingChildQuestion) {
    mode = "answer_question";
    turnRules.push(
      `Answer the child's unanswered question directly now: ${JSON.stringify(childAskedQuestion ? text : state.pendingChildQuestion)}.`,
      "Use age-appropriate Korean explanation with one or two tiny English examples when useful.",
      "Do not start speaking practice, do not ask a new question, and do not focus on a later side comment until the question is answered.",
    );
  } else if (practiceWasPending && (refusedPractice || !attemptedPractice)) {
    mode = "practice_skipped";
    turnRules.push(
      "Siha did not attempt the requested phrase. Say '괜찮아, 듣기만 해도 돼!' warmly and continue the previous topic.",
      "Do not ask her to repeat and do not offer another practice phrase now.",
    );
  } else if (practiceWasPending && attemptedPractice) {
    mode = "practice_completed";
    turnRules.push(
      `Siha attempted the practice phrase ${JSON.stringify(state.pendingPracticePhrase)}.`,
      "Praise the attempt briefly and specifically. Do not score pronunciation or grammar.",
      "If needed, say the natural phrase once in your own response, but never ask for another repetition.",
      "Then continue the topic from the phrase's meaning with a short reaction, not a quiz.",
    );
  } else if (/모르겠|몰라|글쎄/.test(text) && !state.topicEstablished) {
    mode = "lead_topic";
    const starterIndex = state.childTurnCount % 3;
    const topicStarter = [
      "a favorite animation or character",
      "one fun or surprising thing from kindergarten today",
      "a playful imagination such as having one magic power",
    ][starterIndex];
    turnRules.push(
      "Siha does not know what topic to choose. Take the lead confidently instead of asking the same broad question again.",
      `Start this one concrete topic now: ${topicStarter}.`,
      "Use a warm Korean lead-in and one very easy English phrase. Ask only one concrete, easy question.",
      "Do not list many categories and do not default to cats or dogs.",
    );
  } else if (/모르겠|몰라|글쎄/.test(text)) {
    mode = "accept_unknown";
    turnRules.push(
      "Warmly accept that she does not know.",
      "Do not repeat the same question, phrase model, or pretend scene.",
      "Offer to hear something she does know or simply make one reflective comment without a question.",
    );
  } else if (/다른.{0,5}(이야기|스토리)|싫어|안 좋아|don't like/i.test(text)) {
    mode = "change_direction";
    turnRules.push(
      "Stop the current branch immediately.",
      "In Korean, ask what Siha wants to talk about instead. Do not choose the replacement topic.",
    );
  } else {
    turnRules.push(
      "First reflect one concrete detail Siha just gave.",
      "Prefer a natural reaction over manufacturing another question.",
      "If a follow-up is genuinely useful, ask at most one short grounded question, preferably in Korean.",
    );

    const guidedEnglishTurn =
      !childUsedEnglish && nextState.childTurnCount % 4 === 0;
    if (guidedEnglishTurn) {
      mode = "guided_english";
      turnRules.push(
        "After responding to her meaning, choose exactly one 2-to-5-word English phrase derived from what she just said.",
        "Invite one clear repetition in Korean using this exact format: 이렇게 말해보자: “ENGLISH PHRASE”",
        "Say the English phrase slowly once, then stop and wait. Do not add another question in this turn.",
      );
    } else if (childUsedEnglish) {
      turnRules.push(
        "Siha used English. Celebrate the meaning naturally and continue; do not ask her to repeat it.",
      );
    }
  }

  if (!sensitiveMoment && state.assistantTurnsWithoutEnglish >= 1) {
    turnRules.push(
      "The previous assistant turn had no English. This normal response must include one tiny English echo tied to Siha's meaning.",
    );
  }

  if (state.consecutiveAssistantQuestions >= 2) {
    turnRules.push(
      "The assistant has asked questions in consecutive turns. This response must not contain a question.",
      "React, share one tiny comment, and leave room for Siha to continue.",
    );
  }

  return {
    state: nextState,
    instructions: [...common, ...turnRules].join("\n"),
    speed: nextState.slowSpeech ? 0.82 : 0.9,
    mode,
  };
}
