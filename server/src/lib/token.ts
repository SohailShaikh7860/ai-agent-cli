import chalk from "chalk";
import {TOKEN_FILE} from "../cli/commands/auth/login.js";
import fs from "node:fs/promises"
import { CONFIG_DIR } from "../cli/commands/auth/login.js";

export async function getStoredToken(){
    try {
        const data = await fs.readFile(TOKEN_FILE, "utf-8");
        const token = JSON.parse(data);
        return token;
    } catch (error) {
        return null;
    }
}

export async function storeToken(token:any){
     try {
        await fs.mkdir(CONFIG_DIR, {recursive: true});

        const tokenData = {
            access_token: token.access_token,
            refresh_token: token.refresh_token,
            token_type: token.token_type,
            scope: token.scope,
            expires_at: token.expires_in
             ? new Date(Date.now() + token.expires_in * 1000).toISOString()
             : null,
             created_at: new Date().toISOString()
        };

        await fs.writeFile(TOKEN_FILE, JSON.stringify(tokenData, null, 2), "utf-8");
        return true;
     } catch (error:any) {
        console.error(chalk.red("Failed to store token:"), error.message)
        return false;
     }
}

export async function clearStoredToken(){
    try {
        await fs.unlink(TOKEN_FILE);
        return true;
    } catch (error) {
        return false;
    }
}

export async function isTokenExpired(){
    const token = await getStoredToken();
    if(!token || !token.expires_at){
        return true;
    }

    const expiresAt = new Date(token.expires_at);
    const now = new Date();

    return expiresAt.getTime() - now.getTime() < 5 * 60 * 1000;
}

export async function requireAuth(){
     const token = await getStoredToken();

     if(!token){
        console.log(chalk.red("You are not logged in. Please run 'cli-ai-agent login' to authenticate."));
        process.exit(1);
     }

     if(await isTokenExpired()){
        console.log(chalk.yellow("Your token has expired. Please run 'cli-ai-agent login' to re-authenticate."));
        process.exit(1);
     }

        return token;
}