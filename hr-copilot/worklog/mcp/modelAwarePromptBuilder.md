
# 🧾 Job Request: Multi-Provider Model-Aware AI Prompt Builder

## 📌 Objective
Build a reusable, configurable utility to safely and dynamically generate AI prompts from structured data (e.g. role + candidate matches), while adapting to model-specific token limits and formatting needs across different AI providers (e.g., OpenAI, Anthropic, Google, Mistral).

---

## 🎯 Goals

- Automatically format structured data (JSON or markdown) into a prompt suitable for a range of AI models.
- Respect model-specific token and formatting constraints.
- Automatically trim or restructure data to fit within safe limits.
- Return prompt metadata to support downstream monitoring and debugging.

---

## 🧱 Key Responsibilities

### 1. Define Model & Provider Configuration

- Support multiple AI providers and models via a shared config object:
  ```ts
  const modelProfiles = {
    'openai:gpt-4-turbo': {
      provider: 'openai',
      maxTokens: 30000,
      buffer: 2000,
      maxInputTokens: 28000
    },
    'openai:gpt-3.5-turbo': { ... },
    'anthropic:claude-3-opus': { ... },
    'google:gemini-1.5-pro': { ... },
    'mistral:mixtral-8x7b': { ... }
  }
  ```

- Each profile should support:
  - `maxTokens`
  - `maxInputTokens`
  - `buffer` (reserved output space)
  - `tokenizer` (function or adapter for estimating token usage)
  - Optional: model-specific formatting rules (e.g. Claude prefers plaintext, Gemini supports JSON natively)

---

### 2. Token Estimation Utilities

- Normalize token estimation across models using adapters:
  - Use `tiktoken` for OpenAI models
  - Use `@anthropic-ai/tokenizer` or Claude-compatible library
  - Provide fallback estimate using simple word count × multiplier

- Implement:
  ```ts
  function estimatePromptTokens(modelId: string, prompt: string): number
  ```

---

### 3. Data Trimming & Compression Logic

- If token estimate exceeds model limits:
  - Iteratively reduce number of candidates
  - Truncate verbose fields (e.g. summaries, long descriptions)
  - Optionally compress/reformat (e.g. flatten nested structure)

- Fail gracefully if minimum viable data set cannot fit

---

### 4. Prompt Assembly Engine

- Main function:
  ```ts
  function buildSafePrompt({
    modelId,
    role,
    candidates,
    contextMessage
  }): {
    system: string;
    user: string;
    metadata: {
      tokens: number;
      truncated: boolean;
      provider: string;
      model: string;
    };
  }
  ```

- Should generate consistent structure using either:
  - JSON block with `<json>` delimiters
  - Markdown table format (if preferred by model)
  - Plaintext fallback with clear labels and section headers

---

### 5. Format Configuration per Model (Optional)

- Allow extensibility for model-specific formatting preferences:
  ```ts
  const formatProfiles = {
    'openai:*': { format: 'json', useDelimiters: true },
    'anthropic:*': { format: 'plaintext', useDelimiters: false },
    'google:*': { format: 'json', useDelimiters: false }
  }
  ```

---

### 6. Logging & Testing Support

- Include logs/flags for:
  - Truncation events
  - Token usage estimates
  - Final structure metadata

- Provide tests for at least:
  - Over-limit prompts
  - Model switching
  - Format fallbacks
  - Minimum viable inputs

---

## 📦 Deliverables

- `promptBuilder.ts` module with:
  - `buildSafePrompt(...)`
  - `estimatePromptTokens(...)`
  - `modelProfiles` and `formatProfiles`
- Support for 3+ major providers (OpenAI, Anthropic, Google)
- Usage example and integration instructions

---

## 🧩 Tech Environment

- **Runtime**: Deno Edge Functions
- **Data Format**: `RoleData`, `CandidateMatch[]`
- **Target Providers**: OpenAI, Anthropic, Google, Mistral
- **Languages**: TypeScript
- **Tokenization**: tiktoken / anthropic-tokenizer / fallback

---

## ✅ Success Criteria

- Prompts never exceed the model’s token budget.
- Prompts retain actionable content and critical insight even when trimmed.
- Easily extended to new providers/models without breaking core logic.
- Usable across different flows: hiring, capability gap analysis, feedback reports.
