import { ICommandLineApp } from './types';
import { clearLine, cursorTo } from 'readline';
import { resolve } from 'path';
import ArgumentsParser from './ArgumentsParser';
import { default as chalk } from 'chalk'
import CommandRegistry from './CommandRegistry';


export default class CommandLineApp implements ICommandLineApp {

    public readonly commandsDir: string | null = null;

    constructor(commandsDir?: string) {
        if (typeof commandsDir === 'string') {
            Object.defineProperty(this, 'commandsDir', { writable: false, value: resolve(commandsDir) });
        } else if (commandsDir != null) {
            throw `CommandLineApp() - invalid commandsDir parameter <string | null>?`;
        }
    }

    async init() {
        try {
            if (this.commandsDir) await CommandRegistry.importCommands(this.commandsDir, this);
            return await this.runCommand(process.argv.slice(2));
        } catch (e) {
            console.error(chalk.red(e.message || e));
            process.exit(1);
            return void (0);
        }
    }

    // log/warn/err/write etc
    public logLine(message: string) {
        clearLine(process.stdout, 0);
        cursorTo(process.stdout, 0);
        process.stdout.write(message);
    }

    async runCommand(): Promise<any>;
    async runCommand(args: any[]): Promise<any>;
    async runCommand(args?: any[]): Promise<any> {
        if (!args) args = process.argv.slice(2);
        const command = (new ArgumentsParser(CommandRegistry, args)).parse();
        const handler = new (<any>command.command.target.constructor)();
        return await command.command.descriptor.value.call(handler, command, this);
    }

    public clearCommandCache() {
        CommandRegistry.reset(true);
    }

}
