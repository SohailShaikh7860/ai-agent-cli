import OpenAI from "openai";
import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { openaiConfig } from "../../config/openai.config.js";
import chalk, { Chalk } from "chalk";

export class AIService{
    private client: OpenAI;
    
    constructor(){
        if(!openaiConfig.apiKey){
            throw new Error("OpenAI API key is not configured. Please set the OPENAI_API_KEY environment variable.");
        }

        this.client = new OpenAI({
            apiKey: openaiConfig.apiKey
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

    async sendMessage(messages:any, onChunk:any, tools = undefined, onToolCall = null){
        try {
            const openai = createOpenAI({
                apiKey: openaiConfig.apiKey
            });

            const result = await streamText({
                model: openai(openaiConfig.model),
                messages: messages,
            });

            let fullResponse = '';

            for await (const chunk of result.textStream){
                 fullResponse += chunk;
                 if(onChunk){
                    onChunk(chunk);
                 }
            }

            const fullResult = result;

            return{
                content: fullResponse,
                finishResponse: fullResult.finishReason,
                usage: fullResult.usage
            }
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
    async getMessage(messages:any, tools=undefined){
        let fullResponse = '';
        await this.sendMessage(messages, (chunk:any)=>{
            fullResponse += chunk;
        })

        return fullResponse;
    }
}