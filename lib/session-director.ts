export type DirectorState = {
  childTurnCount: number;
  consecutiveAssistantQuestions: number;
  slowSpeech: boolean;
};

export const INITIAL_DIRECTOR_STATE: DirectorState = {
  childTurnCount: 0,
  consecutiveAssistantQuestions: 0,
  slowSpeech: false,
};

const UNCERTAIN_SCRIPT = /[\u0400-\u04ff\u3040-\u30ff]/;

export function recordAssistantTurn(
  state: DirectorState,
  transcript: string,
): DirectorState {
  const askedQuestion = transcript.includes("?");
  return {
    ...state,
    consecutiveAssistantQuestions: askedQuestion
      ? state.consecutiveAssistantQuestions + 1
      : 0,
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
  const nextState: DirectorState = {
    ...state,
    childTurnCount: state.childTurnCount + 1,
    slowSpeech: state.slowSpeech || asksForSlowerSpeech,
  };

  const common = [
    `The latest child transcript is: ${JSON.stringify(text)}.`,
    "Respond to this exact meaning before adding anything.",
    "Do not introduce a new object, activity, setting, or topic from one loosely related word.",
    "Do not teach or model an English phrase unless Siha explicitly asks for help.",
    "Use Korean for managing the conversation and very easy English only when it naturally fits the content.",
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
  } else if (asksForSlowerSpeech) {
    mode = "slow_down";
    turnRules.push(
      "Acknowledge in Korean that you will speak more slowly.",
      "Use one short sentence, spoken calmly, and do not ask a new question in this turn.",
    );
  } else if (/뭐라고|뭐라|못.{0,3}알아|어려워/.test(text)) {
    mode = "repair_question";
    turnRules.push(
      "Briefly apologize in Korean and restate only your immediately previous question in easier Korean.",
      "Do not expand it with three choices or extra explanation.",
    );
  } else if (/모르겠|몰라/.test(text)) {
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
