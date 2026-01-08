import chalk from "chalk";
import boxen from "boxen";
import { text, isCancel, cancel, intro, outro, confirm } from "@clack/prompts";
import { AIService } from "../ai/openai-service.js";
import { chatService } from "../../service/chat-service.js";
import { getStoredToken } from "../../lib/token.js";
import prisma from "../../lib/Ds.js";
import { generateApplication } from "../../config/agent.config.js";
import yoctoSpinner from "yocto-spinner";

// Lazy initialization to ensure dotenv is loaded first
let aiService: AIService | null = null;
let chatSvc: chatService | null = null;

function getAIService() {
  if (!aiService) {
    aiService = new AIService();
  }
  return aiService;
}

function getChatService() {
  if (!chatSvc) {
    chatSvc = new chatService();
  }
  return chatSvc;
}

async function getUserFromToken() {
  const token = await getStoredToken();
  if (!token?.access_token) {
    throw new Error("Not authenticated. Please login first.");
  }
  const spinner = yoctoSpinner({ text: "Authenticating..." }).start();
  const user = await prisma.user.findFirst({
    where: {
      sessions: {
        some: { token: token.access_token },
      },
    },
  });

  if (!user) {
    spinner.error("user not found");
    throw new Error("Invalid token. Please login again.");
  }

  spinner.success(`Welcome back, ${user.name || user.email}!`);
  return user;
}

async function initConversation(userId:any, conversationId: string | null = null) {
  const conversation = await getChatService().getOrCreateConversation(
    userId,
    conversationId,
    "agent"
  );
  
  const conversationInfo = boxen(
    `${chalk.bold("Conversation")}: ${conversation.title}\n` +
    `${chalk.gray("ID:")} ${conversation.id}\n` +
    `${chalk.gray("Mode:")} ${chalk.magenta("Agent (Code Generator)")}\n` +
    `${chalk.cyan("Working Directory:")} ${process.cwd()}`,
    {
      padding: 1,
      margin: { top: 1, bottom: 1 },
      borderStyle: "round",
      borderColor: "magenta",
      title: "🤖 Agent Mode",
      titleAlignment: "center",
    }
  );
  
  console.log(conversationInfo);
  
  return conversation;
}

async function saveMessage(conversationId:string, role:any, content:any){
     return await getChatService().addMessage(conversationId, role, content);
}

export async function startAgentChat(conversationId: string | null = null) {
    try {
        intro(
            boxen(
                chalk.bold.magenta("🤖 Welcome to Agent Chat Mode!") +
                chalk.gray("Autonomous Application Generator"),
                {
                    padding: 1,
                    borderStyle: "double",
                    borderColor: "magenta",
                }
            )
        )

        const user = await getUserFromToken();

        const shouldContinue = await confirm({
            message: chalk.yellow("⚠️ The agent will create files and folders in the current directory. Continue?"),
            initialValue: true,
        });

        if(isCancel(shouldContinue) || !shouldContinue){
            cancel(chalk.yellow("Agent mode cancelled."));
            process.exit(0);
        }

        const conversation = await initConversation(user.id, conversationId);
        await agentLoop(conversation);

        outro(chalk.green.bold("\n✨ Thanks for using Agent Mode! Goodbye!\n"));
    } catch (error:any) {
        const errorBox = boxen(chalk.red(`❌ Error: ${error.message}`), {
      padding: 1,
      margin: 1,
      borderStyle: "round",
      borderColor: "red",
    });
    console.log(errorBox);
    process.exit(1);
    }
}

async function agentLoop(conversation:any) {
     const helpBox = boxen(
    `${chalk.cyan.bold("What can the agent do?")}\n\n` +
    `${chalk.gray('• Generate complete applications from descriptions')}\n` +
    `${chalk.gray('• Create all necessary files and folders')}\n` +
    `${chalk.gray('• Include setup instructions and commands')}\n` +
    `${chalk.gray('• Generate production-ready code')}\n\n` +
    `${chalk.yellow.bold("Examples:")}\n` +
    `${chalk.white('• "Build a todo app with React and Tailwind"')}\n` +
    `${chalk.white('• "Create a REST API with Express and MongoDB"')}\n` +
    `${chalk.white('• "Make a weather app using OpenWeatherMap API"')}\n\n` +
    `${chalk.gray('Type "exit" to end the session')}`,
    {
      padding: 1,
      margin: { bottom: 1 },
      borderStyle: "round",
      borderColor: "cyan",
      title: "💡 Agent Instructions",
    }
  );

  console.log(helpBox);

  while(true){
     const userInput = await text({
      message: chalk.magenta("🤖 What would you like to build?"),
      placeholder: "Describe your application...",
      validate(value) {
        if (!value || value.trim().length === 0) {
          return "Description cannot be empty";
        }
        if (value.trim().length < 10) {
          return "Please provide more details (at least 10 characters)";
        }
      },
    });

    if(isCancel(userInput)){
         console.log(chalk.yellow("\n👋 Agent session cancelled\n"));
      process.exit(0);
    }

    if (userInput.toLowerCase() === "exit") {
      console.log(chalk.yellow("\n👋 Agent session ended\n"));
      break;
    }

    const userBox = boxen(chalk.white(userInput), {
      padding: 1,
      margin: { top: 1, bottom: 1 },
      borderStyle: "round",
      borderColor: "blue",
      title: "👤 Your Request",
      titleAlignment: "left",
    });
    console.log(userBox);
    
    await saveMessage(conversation.id, "user", userInput);

    try {
        const result = await generateApplication(userInput, getAIService(), process.cwd());

        if(result && result.success){
             // Save successful generation details
        const responseMessage = `Generated application: ${result.folderName}\n` +
          `Files created: ${result.files.length}\n` +
          `Location: ${result.appDir}\n\n` +
          `Setup commands:\n${result.commands.join('\n')}`;
          
          await saveMessage(conversation.id, "assistant", responseMessage);

          const continuePrompt = await confirm({
          message: chalk.cyan("Would you like to generate another application?"),
          initialValue: false,
        });

        if (isCancel(continuePrompt) || !continuePrompt) {
          console.log(chalk.yellow("\n👋 Great! Check your new application.\n"));
          break;
        }

        }else{
            throw new Error("Generation returned no result");
        }
    } catch (error:any) {
        console.log(chalk.red(`\n❌ Error: ${error.message}\n`));
      
      await saveMessage(conversation.id, "assistant", `Error: ${error.message}`);
      
      const retry = await confirm({
        message: chalk.cyan("Would you like to try again?"),
        initialValue: true,
      });

      if (isCancel(retry) || !retry) {
        break;
      }
    }
  }
}