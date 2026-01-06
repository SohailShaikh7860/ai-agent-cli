import {cancel, confirm, intro, isCancel, outro} from "@clack/prompts";
import {logger} from "better-auth";
import {createAuthClient} from "better-auth/client";
import { deviceAuthorizationClient } from "better-auth/client/plugins";

import chalk from "chalk";
import { Command } from "commander";
import fs from "node:fs/promises"
import open from "open";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import yoctoSpinner from "yocto-spinner";
import * as z from "zod/v4";
import dotenv from "dotenv";
import prisma from "../../../lib/Ds.js"
import { getStoredToken, isTokenExpired, storeToken } from "../../../lib/token.js";

// Load environment variables
dotenv.config();

const URL = "http://localhost:3005"
const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
export const CONFIG_DIR = path.join(os.homedir(), ".cli-ai-agent");
export const TOKEN_FILE:string = path.join(CONFIG_DIR, "token.json");

//Token Management functions

export async function loginAction(opts:any){
   const optionsSchema = z.object({
      serverURL: z.string().optional(),
      clientId: z.string().optional()
   })

   const options = optionsSchema.parse(opts);
   const serverURL = options.serverURL || URL;
   const clientId = options.clientId || CLIENT_ID;

   if (!clientId) {
       console.error(chalk.red("Client ID is required"));
       process.exit(1);
   }

   intro(chalk.bold("🔐Auth Cli Login"))

   //TODO: CHANGE THIS TO CHECK DB
   const exisitingToken = await getStoredToken();;
   const expired = await isTokenExpired();

    if(exisitingToken && !expired){
        const shouldReAuth = await confirm({
            message:" You are already logged in. Do you want to re-authenticate? ",
            initialValue:false
        })

        if(isCancel(shouldReAuth) || !shouldReAuth){
            cancel(" Login cancelled. ");
            process.exit(0);
        }
    }

    const authClient = createAuthClient({
        baseURL: serverURL,
        plugins:[deviceAuthorizationClient()]
    })

    const spinner = yoctoSpinner({text: "Requesting device authorization..."})
    .start("Starting login process...");

    try {
        const {data, error} = await authClient.device.code({
            client_id: clientId,
            scope: "openid profile email"
        })

        spinner.stop("Device authorization received.");
        if(error){
            logger.error("Failed to request device authorization:", error);
            process.exit(1);
        }

        const {
            device_code,
            user_code,
            verification_uri,
            verification_uri_complete,
            interval = 5,
            expires_in
        } = data;

        console.log(chalk.cyan("Device Authorization required"))
        console.log(`please visit: ${chalk.underline.blue(verification_uri || verification_uri_complete)}`);

        console.log(`Enter Code: ${chalk.bold.green(user_code)}`)

        const shouldOpen = await confirm({
            message:"Open browser automatically",
            initialValue:true
        })

        if(!isCancel(shouldOpen) && shouldOpen){
            const urlToOpen = verification_uri_complete || verification_uri;
            await open(urlToOpen);
        }

        console.log(
            chalk.gray(
                `Waiting for authorization (expires in ${Math.floor(
                    expires_in / 60
                )} minutes)...`
            )
        )

        const token = await pollForToken(
            authClient,
            device_code,
            clientId,
            interval
        );

        if(token){
            const saved = await storeToken(token);

            if(!saved){
                console.log(chalk.red("Failed to save token locally."));
            }
            console.log(chalk.green("✅ Login successful! Token saved."));
        }

       //todo get the user data

       outro(chalk.green("You are now logged in to the CLI AI Agent!"));

       console.log(chalk.gray(`\n Token saved to: ${TOKEN_FILE}`));

       console.log(chalk.gray(
        "You can now use the CLI AI Agent with authenticated requests."
       ))

        
    } catch (error:any) {
        spinner.stop();
        console.log(chalk.red("\nLogin error:"), error.message);
        process.exit(1);
    }
    
    outro(chalk.green("Login flow started!"));
}

async function pollForToken(authClient: any, device_code: string, client_id: string, interval: number){
            let pollingInterval = interval
            const spinner = yoctoSpinner({text:"", color:"cyan"})
            let dots = 0;

            return new Promise((resolve,reject)=>{
                const poll = async ()=>{
                    dots = (dots + 1) % 4;
                    spinner.text = chalk.gray(
                        `Polling for authorization${".".repeat(dots)}${"".repeat(3 - dots)}}`
                    );

                    if(!spinner.isSpinning) spinner.start();

                    try {
                        const {data, error} = await authClient.device.token({
                            grant_type:"urn:ietf:params:oauth:grant-type:device_code",
                            device_code: device_code,
                            client_id: client_id,
                            fetchOptions: {
                                "user-agent": `My CLI`
                            }
                        })

                        if(data?.access_token){
                            console.log(
                                chalk.bold.yellow(`your access token: ${data.access_token}`)
                            );
                            
                            spinner.stop()
                            resolve(data);
                            return;
                        } else if(error){
                          switch(error.error){
                            case "authorization_pending":
                                break;
                            case "slow_down":
                                pollingInterval += 5;
                                break;
                            case "access_denied":
                                console.error("Access denied by user.");
                                return;
                            case "expired_token":
                                console.error("Device code has expired.Please try again");
                                return;
                            default:
                                spinner.stop();
                                logger.error(`Error: ${error.error_description}`);
                                process.exit(1);
                          }
                        }
                    } catch (error) {
                        spinner.stop();
                        reject(error);
                        return;
                    }
                setTimeout(poll, pollingInterval * 1000);
                }
             setTimeout(poll, pollingInterval * 1000);
            })
        }


// Command setup

export const login = new Command("login")
  .description("Login to the CLI AI Agent")
  .option("-s, --server-url <url>", "Authentication server URL", URL)
  .option("-c, --client-id <id>", "OAuth Client ID", CLIENT_ID)
  .action(loginAction)