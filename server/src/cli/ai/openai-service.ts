import OpenAI from "openai";
import { generateObject, streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { openaiConfig } from "../../config/openai.config.js";
import chalk from "chalk";

export class AIService {
  private client: OpenAI;
  private model = openaiConfig.model;

  constructor() {
    if (!openaiConfig.apiKey) {
      throw new Error(
        "OpenAI API key is not configured. Please set the OPENAI_API_KEY environment variable."
      );
    }

    this.client = new OpenAI({
      apiKey: openaiConfig.apiKey,
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
        model: openai(this.model),
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
   * Genreate application files based on AI response using zod schema.
   * @param {Object} schema
   * @param {string} prompt
   * @returns {Promise<Object>} parsed Object matching the schema
   */

  async generateStructured(schema: any, prompt: string) {
    try {
      const result = await generateObject({
        model: openai(this.model),
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
