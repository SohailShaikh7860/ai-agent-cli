import OpenAI from "openai";
import { generateObject, streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { openaiConfig } from "../../config/openai.config.js";
import chalk from "chalk";

export class AIService {
  private client: OpenAI;
  private model = openaiConfig.model;
  private openaiProvider: ReturnType<typeof createOpenAI>;

  constructor() {
    // Debug: Check if API key is loaded
    const apiKey = openaiConfig.apiKey || process.env.OPENAI_API_KEY;
    
    if (!apiKey || apiKey.trim() === '') {
      console.error(chalk.red('DEBUG: OPENAI_API_KEY is empty or not set'));
      console.error(chalk.yellow('Make sure you have a .env file in the server directory with:'));
      console.error(chalk.yellow('OPENAI_API_KEY=sk-your-key-here'));
      throw new Error(
        "OpenAI API key is not configured. Please set the OPENAI_API_KEY environment variable."
      );
    }

    // Use the API key from config or fallback to env
    const finalApiKey = openaiConfig.apiKey || apiKey;

    this.client = new OpenAI({
      apiKey: finalApiKey,
    });

    // Create OpenAI provider with API key for AI SDK
    // Explicitly set baseURL to avoid AI Gateway fallback
    this.openaiProvider = createOpenAI({
      apiKey: finalApiKey,
      baseURL: 'https://api.openai.com/v1',
    });
  }

  /**
   * Send a message to the OpenAI API and stream the response.
   * @param {Array} messages
   * @param {Function} onChunk
   * @param {Object} tools
   * @param {Function} onToolCall
   * @returns {Promise<Object>}
   *
   */

  async sendMessage(
    messages: any,
    onChunk: any,
    tools = undefined,
    onToolCall: ((toolCall: any) => void) | null = null
  ) {
    try {
      const streamConfig: any = {
        model: this.openaiProvider(this.model),
        messages: messages,
      };

      if (tools && Object.keys(tools).length > 0) {
        streamConfig.tools = tools;
        streamConfig.maxSteps = 5; //just 5 toll call steps

        console.log(
          chalk.gray(`[DEBUG] tools enabled: ${Object.keys(tools).join(", ")}`)
        );
      }

      const result = await streamText(streamConfig);

      let fullResponse = "";

      for await (const chunk of result.textStream) {
        fullResponse += chunk;
        if (onChunk) {
          onChunk(chunk);
        }
      }

      const fullResult = result;

      const toolCalls = [];
      const toolResults = [];

      if (fullResult.steps && Array.isArray(fullResult.steps)) {
        for (const step of fullResult.steps) {
          if (step.toolCalls && step.toolCalls.length > 0) {
            for (const toolCall of step.toolCalls) {
              toolCalls.push(toolCall);

              if (onToolCall) {
                onToolCall(toolCall);
              }
            }
          }

          if (step.toolResults && step.toolResults.length > 0) {
            toolResults.push(...step.toolResults);
          }
        }
      }
      return {
        content: fullResponse,
        finishResponse: fullResult.finishReason,
        usage: fullResult.usage,
        toolCalls,
        toolResults,
        steps: fullResult.steps,
      };
    } catch (error: any) {
      console.error(chalk.red("AI Service Error"), error.message);
      throw error;
    }
  }

  /**
   * Get a non-streaming response from the OpenAI API.
   * @param {Array} messages
   * @param {Object} tools
   * @returns {Promise<Object>}
   */
  async getMessage(messages: any, tools = undefined) {
    let fullResponse = "";
    const result = await this.sendMessage(
      messages,
      (chunk: any) => {
        fullResponse += chunk;
      },
      tools
    );

    return result.content;
  }
  /**
   * Get the configured model instance for use with AI SDK functions
   * @returns {LanguageModelV3} The configured OpenAI model instance
   */
  getModel() {
    return this.openaiProvider(this.model);
  }

  /**
   * Genreate application files based on AI response using zod schema.
   * @param {Object} schema
   * @param {string} prompt
   * @returns {Promise<Object>} parsed Object matching the schema
   */

  async generateStructured(schema: any, prompt: string) {
    try {
      const result = await generateObject({
        model: this.openaiProvider(this.model),
        schema: schema,
        prompt: prompt,
      });
      
      return result.object;
    } catch (error:any) {
      console.error(chalk.red("AI Structured Generation Error:"), error.message);
      throw error;
    }
  }
}
