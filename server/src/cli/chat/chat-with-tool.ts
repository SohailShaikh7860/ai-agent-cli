import chalk from "chalk";
import boxen from "boxen";
import {
  text,
  isCancel,
  cancel,
  intro,
  outro,
  multiselect,
  select,
} from "@clack/prompts";
import yoctoSpinner from "yocto-spinner";
import { marked } from "marked";
// @ts-expect-error - marked-terminal doesn't have type definitions
import { markedTerminal } from "marked-terminal";
import { AIService } from "../ai/openai-service.js";
import { chatService } from "../../service/chat-service.js";
import { getStoredToken } from "../../lib/token.js";
import prisma from "../../lib/Ds.js";
import {
  getEnabledTools,
  toggleTool,
  availableTools,
  getEnabledToolsNames,
  resetTools,
  enableTools,
} from "../../config/tool.config.js";

// Type definition for marked-terminal options
interface MarkedTerminalOptions {
  code?: (text: string) => string;
  blockquote?: (text: string) => string;
  heading?: (text: string) => string;
  firstHeading?: (text: string) => string;
  hr?: (text: string) => string;
  listitem?: (text: string) => string;
  list?: (text: string) => string;
  paragraph?: (text: string) => string;
  strong?: (text: string) => string;
  em?: (text: string) => string;
  codespan?: (text: string) => string;
  del?: (text: string) => string;
  link?: (text: string) => string;
  href?: (text: string) => string;
}

marked.use(
  markedTerminal({
    // Styling options for terminal output
    code: chalk.cyan,
    blockquote: chalk.gray.italic,
    heading: chalk.green.bold,
    firstHeading: chalk.magenta.underline.bold,
    hr: chalk.reset,
    listitem: chalk.reset,
    list: chalk.reset,
    paragraph: chalk.reset,
    strong: chalk.bold,
    em: chalk.italic,
    codespan: chalk.yellow.bgBlack,
    del: chalk.dim.gray.strikethrough,
    link: chalk.blue.underline,
    href: chalk.blue.underline,
  })
);

const aiService = new AIService();
const chatSvc = new chatService();

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

export async function startToolchat(conversationId: string | null = null) {
  try {
    intro(
      boxen(chalk.bold.cyan("🛠️ Tool Chat"), {
        padding: 1,
        borderStyle: "double",
        borderColor: "cyan",
      })
    );

    const user = await getUserFromToken();

    await selectTools();

    const conversation = await initConversation(
      user.id,
      conversationId,
      "tool"
    );

    resetTools();

    outro(chalk.green("✨ Thanks for using tools"));
  } catch (error) {
    const errorBox = boxen(chalk.red(`[ERROR] ${(error as Error).message}`), {
      padding: 1,
      borderStyle: "round",
      borderColor: "red",
    });
    console.log(errorBox);
    resetTools();
    process.exit(1);
  }
}

export async function selectTools() {
  const toolOptions = availableTools.map((tool) => ({
    value: tool.id,
    label: tool.name,
    hint: tool.description,
  }));

  const selectedTool = await multiselect({
    message: chalk.cyan(
      "Select tools to enable (Space to select, Enter to confirm):"
    ),
    options: toolOptions,
    required: false,
  });

  if (isCancel(selectedTool)) {
    cancel(chalk.yellow("Tool selection cancelled. No tools will be enabled."));
    process.exit(0);
  }

  enableTools(selectedTool);

  if (selectedTool.length === 0) {
    console.log(
      chalk.yellow("⚠️ No tools selected. Proceeding without tools.")
    );
  } else {
    const toolsBox = boxen(
      chalk.green(
        `✅ Enabled tools:\n${selectedTool
          .map((id) => {
            const tool: any = availableTools.find((t) => t.id === id);
            return `  • ${tool.name}`;
          })
          .join("\n")}`
      ),
      {
        padding: 1,
        margin: { top: 1, bottom: 1 },
        borderStyle: "round",
        borderColor: "green",
        title: "🛠️  Active Tools",
        titleAlignment: "center",
      }
    );
    console.log(toolsBox);
  }

  return selectedTool.length > 0;
}

async function initConversation(
  userId: string,
  conversationId: string | null,
  mode: string = "tool"
) {
  const spinner = yoctoSpinner({ text: "Loading conversation..." }).start();

  const conversation = await chatSvc.getOrCreateConversation(
    userId,
    conversationId,
    mode
  );

  spinner.success("Conversation Loaded.");

  const enabledToolsNames = getEnabledToolsNames();
  const toolsDisplay =
    enabledToolsNames.length > 0
      ? `\n${chalk.gray("Active Tools:")} ${enabledToolsNames.join(", ")}`
      : `\n${chalk.gray("No Tools Enabled")}`;

  const conversationInfo = boxen(
    `${chalk.bold("Conversation")}: ${conversation.title}\n${chalk.gray(
      "ID: " + conversation.id
    )}\n${chalk.gray("Mode: " + conversation.mode)}${toolsDisplay}`,
    {
      padding: 1,
      margin: { top: 1, bottom: 1 },
      borderStyle: "round",
      borderColor: "cyan",
      title: "💬 Tool Calling Session",
      titleAlignment: "center",
    }
  );

  console.log(conversationInfo);

  // Display existing messages if any
  if (conversation.messages?.length > 0) {
    console.log(chalk.yellow("📜 Previous messages:\n"));
    displayMessages(conversation.messages);
  }

  return conversation;
}

function displayMessages(messages: any[]) {
  messages.forEach(async (msg) => {
    if (msg.role === "user") {
      const userBox = boxen(chalk.white(msg.content), {
        padding: 1,
        margin: { left: 2, bottom: 1 },
        borderStyle: "round",
        borderColor: "blue",
        title: "👤 You",
        titleAlignment: "left",
      });
      console.log(userBox);
    } else if (msg.role === "assistant") {
      const renderedContent = await marked.parse(msg.content);
      const assistantBox = boxen(renderedContent.trim(), {
        padding: 1,
        margin: { left: 2, bottom: 1 },
        borderStyle: "round",
        borderColor: "green",
        title: "🤖 Assistant (with tools)",
        titleAlignment: "left",
      });
      console.log(assistantBox);
    }
  });
}

async function saveMessage(conversationId: string, role: any, content: any) {
  return await chatSvc.addMessage(conversationId, role, content);
}

async function getAiResponse(conversationId:string){
     const spinner = yoctoSpinner({
        text: "AI is thinking...",
        color: 'cyan'
     }).start();

     const dbMessages = await chatSvc.getMessages(conversationId);
     const aiMessages = chatSvc.formatMessages(dbMessages);

     let fullResponse = "";

     let isFirstChunk = true;

     try {
        const result = await aiService.sendMessage(aiMessages, (chunk:any)=>{
           // Stop spinner on first chunk and show header
      if (isFirstChunk) {
        spinner.stop();
        console.log("\n");
        const header = chalk.green.bold("🤖 Assistant:");
        console.log(header);
        console.log(chalk.gray("─".repeat(60)));
        isFirstChunk = false;
      }
      fullResponse += chunk;
        });

        console.log("\n");
        const renderedMarkdown = marked.parse(fullResponse);
        console.log(renderedMarkdown);
        console.log(chalk.gray("─".repeat(60)));
        console.log("\n");
        
        return result.content;
     } catch (error) {
        spinner.error("Failed to get AI response");
    throw error;
     }
}

async function updateConversationTitle(
  conversationId: string,
  userInput: any,
  messageCount: number
) {
  if (messageCount === 1) {
    const title = userInput.slice(0, 50) + (userInput.length > 50 ? "..." : "");
    await chatSvc.updateTitle(conversationId, title);
  }
}

async function chatLoop(conversation: any) {
  const enabledToolsNames = getEnabledToolsNames();
  const helpBox = boxen(
    `${chalk.gray("• Type your message and press Enter")}\n${chalk.gray(
      "• AI has access to:"
    )} ${
      enabledToolsNames.length > 0 ? enabledToolsNames.join(", ") : "No tools"
    }\n${chalk.gray('• Type "exit" to end conversation')}\n${chalk.gray(
      "• Press Ctrl+C to quit anytime"
    )}`,
    {
      padding: 1,
      margin: { bottom: 1 },
      borderStyle: "round",
      borderColor: "gray",
      dimBorder: true,
    }
  );

  console.log(helpBox);

   while (true) {
    const userInput = await text({
      message: chalk.blue("💬 Your message"),
      placeholder: "Type your message...",
      validate(value) {
        if (!value || value.trim().length === 0) {
          return "Message cannot be empty";
        }
      },
    });

     if (isCancel(userInput)) {
      const exitBox = boxen(chalk.yellow("Chat session ended. Goodbye! 👋"), {
        padding: 1,
        margin: 1,
        borderStyle: "round",
        borderColor: "yellow",
      });
      console.log(exitBox);
      process.exit(0);
    }

    if (userInput.toLowerCase() === "exit") {
      const exitBox = boxen(chalk.yellow("Chat session ended. Goodbye! 👋"), {
        padding: 1,
        margin: 1,
        borderStyle: "round",
        borderColor: "yellow",
      });
      console.log(exitBox);
      break;
    }

    const userBox = boxen(chalk.white(userInput), {
      padding: 1,
      margin: { left: 2, top: 1, bottom: 1 },
      borderStyle: "round",
      borderColor: "blue",
      title: "👤 You",
      titleAlignment: "left",
    });
    console.log(userBox);

    await saveMessage(conversation.id, "user", userInput);
    const messages = await chatSvc.getMessages(conversation.id);
    const aiResponse = await getAiResponse(conversation.id);
    await saveMessage(conversation.id, "assistant", aiResponse);
    await updateConversationTitle(conversation.id, userInput, messages.length);
   }
  
}

export async function startToolChat(conversationId: string | null = null) {
  try {
    intro(
      boxen(chalk.bold.cyan("Tool Calling Mode"), {
        padding: 1,
        borderStyle: "double",
        borderColor: "cyan",
      })
    );

    const user = await getUserFromToken();
    
    // Select tools
    await selectTools();
    
    const conversation = await initConversation(user.id, conversationId, "tool");
    await chatLoop(conversation);
    
    // Reset tools on exit
    resetTools();
    
    outro(chalk.green("✨ Thanks for using tools!"));
  } catch (error:any) {
    const errorBox = boxen(chalk.red(`❌ Error: ${error.message}`), {
      padding: 1,
      margin: 1,
      borderStyle: "round",
      borderColor: "red",
    });
    console.log(errorBox);
    resetTools();
    process.exit(1);
  }
}