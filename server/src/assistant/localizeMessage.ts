import { assistantLanguageConfig, type AssistantChatResponse } from '@aquaflow/shared'
import { handleAssistantMessage } from './handleMessage.js'
import { parseIntent } from './parseIntent.js'
import { translateWithKhaya } from '../speech/khayaTranslate.js'

/**
 * Language wrapper around the existing farm brain.
 * parseIntent, safetyController, and handleAssistantMessage stay unchanged.
 *
 * Ghanaian words are translated to English only when the existing matcher
 * cannot already understand them. The farm answer is then translated back
 * for the farmer. English requests skip translation.
 */
export async function handleLocalizedAssistantMessage(
  message: string,
  languageId?: string,
): Promise<AssistantChatResponse> {
  const language = assistantLanguageConfig(languageId)
  const forBrain = await messageForFarmBrain(message, language.translateCode)
  const result = await handleAssistantMessage(forBrain)
  if (!language.translateCode) return result

  const localized = await translateWithKhaya(result.reply, `eng-${language.translateCode}`)
  if (!localized) return result
  return { ...result, reply: localized }
}

async function messageForFarmBrain(message: string, translateCode: string | null): Promise<string> {
  if (!translateCode) return message
  const alreadyUnderstood = parseIntent(message).type !== 'unclear'
  if (alreadyUnderstood) return message
  const english = await translateWithKhaya(message, `${translateCode}-eng`)
  return english || message
}
