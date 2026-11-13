import * as Alexa from 'ask-sdk-core';
import { generatedCarriers } from './generated-carriers';
import { legacyCarriers } from './legacy-carriers';
import { LLMProvider } from '../llm/provider';
import { ConversationStore } from '../conversation/store';
import { HistoryWriter } from '../history/database';
import { HistorySearch } from '../retrieval/retrieval';
import type { PersonalMemoryLookup } from '../memory/semantic';
import type { HybridHistoryLookup } from '../retrieval/history-semantic';
import type { AlwaysRetrieval } from '../retrieval/always';
import { Router, rulesRouter } from '../retrieval/router';
import { AssistantCore, type RetrievalSummary } from '../core/assistant';

const naturalPrefixes: Record<string, string> = {
  ...generatedCarriers,
  ...legacyCarriers,
  WhatIsIntent: 'what is',
  WhatAreIntent: 'what are',
  WhatAboutIntent: 'what about',
  HowManyIntent: 'how many',
  DidWeTalkIntent: 'what did we talk about',
  RememberIntent: 'do you remember',
  CanYouIntent: 'can you',
  CouldYouIntent: 'could you',
  WouldYouIntent: 'would you',
  WouldYouLikeIntent: 'would you like',
  DoYouKnowIntent: 'do you know',
  TellMeIntent: 'tell me',
  HowDoesIntent: 'how does',
  HowDoIntent: 'how do',
  HowCanIntent: 'how can',
  WhyIsIntent: 'why is',
  WhyDoesIntent: 'why does',
  WhereIsIntent: 'where is',
  WhenIsIntent: 'when is',
  WhoIsIntent: 'who is',
  IsItIntent: 'is it',
  CanWeIntent: 'can we',
  PleaseIntent: 'please',
  IWantToKnowIntent: 'i want to know',
  IWonderIntent: 'i wonder',
  RemindMeIntent: 'remind me',
};

const reprompt = 'What else would you like to ask?';
const escapeSpeech = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c] as string,
  );

export function createSkill(
  skillId: string,
  provider: LLMProvider,
  store = new ConversationStore(),
  history?: HistoryWriter & Partial<HistorySearch>,
  onHistoryError: () => void = () => {},
  router: Router = rulesRouter,
  memoryLookup?: PersonalMemoryLookup,
  historyLookup?: HybridHistoryLookup,
  alwaysRetrieval?: AlwaysRetrieval,
  onRetrieval?: (summary: RetrievalSummary) => void,
) {
  const core = new AssistantCore(
    provider,
    store,
    history,
    onHistoryError,
    router,
    memoryLookup,
    historyLookup,
    alwaysRetrieval,
    onRetrieval,
  );
  const intent = (name: string) => (h: Alexa.HandlerInput) =>
    Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest' &&
    Alexa.getIntentName(h.requestEnvelope) === name;
  const sessionId = (h: Alexa.HandlerInput) => h.requestEnvelope.session?.sessionId;
  return Alexa.SkillBuilders.custom()
    .withSkillId(skillId)
    .addRequestHandlers(
      {
        canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'LaunchRequest',
        handle: (h) =>
          h.responseBuilder
            .speak('Hello, ask me a question.')
            .reprompt('What would you like to ask?')
            .withShouldEndSession(false)
            .getResponse(),
      },
      {
        canHandle: (h) =>
          intent('QuestionIntent')(h) ||
          Object.keys(naturalPrefixes).some((name) => intent(name)(h)),
        async handle(h) {
          const slot = Alexa.getSlotValue(h.requestEnvelope, 'question')?.trim();
          const name = Alexa.getIntentName(h.requestEnvelope);
          const question = slot
            ? [naturalPrefixes[name], slot].filter(Boolean).join(' ')
            : undefined;
          if (!question || question.length > 1000)
            return h.responseBuilder
              .speak(
                question
                  ? 'Please ask a shorter question.'
                  : name === 'RememberIntent'
                    ? 'What would you like me to remember? Please mention the topic.'
                    : 'I did not hear your question. Please try again.',
              )
              .reprompt(reprompt)
              .withShouldEndSession(false)
              .getResponse();
          const id = sessionId(h);
          if (!id)
            return h.responseBuilder
              .speak('Sorry, I could not start a conversation.')
              .withShouldEndSession(true)
              .getResponse();
          const answer = await core.respond(id, question);
          return h.responseBuilder
            .speak(escapeSpeech(answer))
            .reprompt(reprompt)
            .withShouldEndSession(false)
            .getResponse();
        },
      },
      {
        canHandle: (h) => intent('AMAZON.YesIntent')(h) || intent('AMAZON.NoIntent')(h),
        handle: async (h) => {
          const id = sessionId(h);
          if (!id)
            return h.responseBuilder
              .speak('Sorry, I could not start a conversation.')
              .withShouldEndSession(true)
              .getResponse();
          const response = await core.respond(id, intent('AMAZON.YesIntent')(h) ? 'yes' : 'no');
          return h.responseBuilder
            .speak(escapeSpeech(response))
            .reprompt(reprompt)
            .withShouldEndSession(false)
            .getResponse();
        },
      },
      {
        canHandle: intent('AMAZON.HelpIntent'),
        handle: (h) =>
          h.responseBuilder
            .speak(
              'You can say ask, explain, what is, or what about, followed by your question. Say stop when you are done.',
            )
            .reprompt(reprompt)
            .withShouldEndSession(false)
            .getResponse(),
      },
      {
        canHandle: (h) => intent('AMAZON.StopIntent')(h) || intent('AMAZON.CancelIntent')(h),
        handle: (h) => {
          const id = sessionId(h);
          if (id) core.endSession(id);
          return h.responseBuilder.speak('Goodbye.').withShouldEndSession(true).getResponse();
        },
      },
      {
        canHandle: intent('AMAZON.FallbackIntent'),
        handle: (h) =>
          h.responseBuilder
            .speak('Please say ask followed by your question.')
            .reprompt(reprompt)
            .withShouldEndSession(false)
            .getResponse(),
      },
      {
        canHandle: (h) => Alexa.getRequestType(h.requestEnvelope) === 'SessionEndedRequest',
        handle: (h) => {
          const id = sessionId(h);
          if (id) core.endSession(id);
          return h.responseBuilder.getResponse();
        },
      },
      {
        canHandle: () => true,
        handle: (h) =>
          h.responseBuilder
            .speak('Sorry, I could not understand that.')
            .reprompt(reprompt)
            .withShouldEndSession(false)
            .getResponse(),
      },
    )
    .addErrorHandlers({
      canHandle: () => true,
      handle: (h) =>
        h.responseBuilder
          .speak('Sorry, something went wrong.')
          .withShouldEndSession(true)
          .getResponse(),
    })
    .create();
}
