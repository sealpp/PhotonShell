import { ZxcvbnFactory, OptionsType } from '@zxcvbn-ts/core'
import { adjacencyGraphs, dictionary as commonDictionary } from '@zxcvbn-ts/language-common'
import { dictionary as zhDictionary, translations } from '@zxcvbn-ts/language-zh'

let factory: ZxcvbnFactory | undefined

function getFactory(): ZxcvbnFactory {
  if (!factory) {
    const options: OptionsType = {
      translations,
      graphs: adjacencyGraphs,
      dictionary: { ...commonDictionary, ...zhDictionary } as OptionsType['dictionary'],
    }
    factory = new ZxcvbnFactory(options)
  }
  return factory
}

export type StrengthVariant = 'weak' | 'medium' | 'strong'

export interface PasswordStrength {
  score: number
  label: string
  variant: StrengthVariant
  warning: string | null
  suggestions: string[]
}

const SCORE_LABELS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: '弱',
  1: '弱',
  2: '一般',
  3: '强',
  4: '强',
}

const SCORE_VARIANTS: Record<0 | 1 | 2 | 3 | 4, StrengthVariant> = {
  0: 'weak',
  1: 'weak',
  2: 'medium',
  3: 'strong',
  4: 'strong',
}

export function estimateStrength(password: string): PasswordStrength | undefined {
  if (password.length === 0) {
    return undefined
  }

  const result = getFactory().check(password)

  return {
    score: result.score,
    label: SCORE_LABELS[result.score],
    variant: SCORE_VARIANTS[result.score],
    warning: result.feedback.warning,
    suggestions: result.feedback.suggestions,
  }
}
