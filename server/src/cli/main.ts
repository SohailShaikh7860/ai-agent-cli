#!/usr/bin/env node

import dotenv from "dotenv";
import chalk from "chalk";
import figlet from "figlet";
import { Command } from "commander";
import { login } from "./commands/auth/login.js";


dotenv.config();

async function main(){
     console.log(
        chalk.cyan(
            figlet.textSync("CLI-AI-AGENT", { horizontalLayout: "default",
            font: "Standard"
            })
        )
     )

     console.log(chalk.gray("A Cli AI Agent powered by OpenAI\n"));

     const program = new Command("cli-ai-agent");

     program.version("1.0.0")
     .description("A Cli AI Agent powered by OpenAI")
     .addCommand(login)

     program.action(()=>{
        program.help();
     })

     program.parse();
}
main().catch((err)=>{
    console.log(chalk.red("Error running CLI Agent"), err);
    process.exit(1);
});
