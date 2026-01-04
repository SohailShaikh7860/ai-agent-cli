import chalk from "chalk";
import { Command } from "commander";
import yoctoSpinner from "yocto-spinner";
import { getStoredToken } from "../../../lib/token.js";
import prisma from "../../../lib/Ds.js";
import { select } from "@clack/prompts";

const wakeUpAction = async () => {
  const token = await getStoredToken();

  if (!token?.access_token) {
    console.log(chalk.red("You must be logged in to wake up the AI Agent."));
    return;
  }

  const spinner = yoctoSpinner({ text: "Waking up the AI Agent..." });
  spinner.start();

  const user = await prisma.user.findFirst({
    where: {
      sessions: {
        some: {
          token: token.access_token,
        },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
    },
  });

  spinner.stop();

  if (!user) {
    console.log(chalk.red("Invalid token. Please log in again."));
    return;
  }

  console.log(
    chalk.green(
      `Hello, ${user.name}! The AI Agent is now awake and ready to assist you.`
    )
  );

  const choice = await select({
    message: "Select an option",
    options: [
       {
        value: "chat",
        label:"Chat",
        hint:"Simple chat with the AI Agent"
       },
       {
        value: "tool",
        label:"Tool Calling",
        hint:"Chat with tools (Google Search, Code Execution)"
       },
       {
        value: "agent",
        label:"Agentic Mode",
        hint:"Advanced AI agent (Comming soon)"
       },
    ],
  });

  switch(choice){
     case "chat":
        console.log(chalk.blue("Starting chat mode..."));
        break;
     case "tool":
        console.log(chalk.green("Starting tool calling mode..."));
        break;
    case "agent":
        console.log(chalk.yellow("Agentic mode is coming soon!"));
        break;
  }
};

export const wakeUp = new Command("wakeUp")
    .description("Wake up the AI Agent")
    .action(wakeUpAction);
