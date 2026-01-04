#!/usr/bin/env node
import dotenv from "dotenv";
import chalk from "chalk";
import figlet from "figlet";
import { Command } from "commander";
import { login } from "./commands/auth/login.js";
import { logout } from "./commands/auth/logOut.js";
import { whoami } from "./commands/auth/whoAmI.js";
import { wakeUp } from "./commands/ai/wakeUp.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

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
     .addCommand(logout)
     .addCommand(whoami)
     .addCommand(wakeUp);

     program.action(()=>{
        program.help();
     })

     program.parse();
}
main().catch((err)=>{
    console.log(chalk.red("Error running CLI Agent"), err);
    process.exit(1);
});
