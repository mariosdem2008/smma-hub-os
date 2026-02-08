import * as openai from "./openai.ts"
import * as anthropic from "./anthropic.ts"
import * as gemini from "./gemini.ts"
import * as mock from "./mock.ts"

export const providers = {
  openai,
  anthropic,
  gemini,
  mock,
};
