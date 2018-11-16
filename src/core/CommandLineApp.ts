import { ICommandLineApp } from './types';
import { clearLine, cursorTo } from 'readline';
import { resolve } from 'path';
import readline from 'readline';
import ArgumentsParser from './ArgumentsParser';
import { default as chalk } from 'chalk'
import CommandRegistry from './CommandRegistry';
import { readdir } from 'fs';


const importedCommands = new Set<string>();

export default class CommandLineApp implements ICommandLineApp {

    public readonly commandsDir: string | null = null; // null == import commands self

    constructor(commandsDir?: string) {
        if (typeof commandsDir === 'string') {
            Object.defineProperty(this, 'commandsDir', { writable: false, value: resolve(commandsDir) });
        } else if (commandsDir != null) {
            throw `CommandLineApp() - invalid commandsDir parameter <string | null>?`;
        }
    }

    async init() {
        try {
            if (this.commandsDir) await this.importCommands();
            return await this.runCommand(process.argv.slice(2));
        } catch (e) {
            console.error(chalk.red(e.message || e));
            process.exit(1);
            return void (0);
        }
    }

    // log/warn/err/write etc
    logLine(message: string) {
        clearLine(process.stdout, 0);
        cursorTo(process.stdout, 0);
        process.stdout.write(message);
    }

    // async runCommand(data: CommandData, args: string[]): Promise<any>;
    async runCommand(): Promise<any>;
    async runCommand(args: string[]): Promise<any>;
    async runCommand(args?: string[]): Promise<any> {
        if (!args) args = process.argv.slice(2);
        const argCommand = (new ArgumentsParser(CommandRegistry, args)).parse();
        const handler = new (<any>argCommand.command.target.constructor)();
        return await argCommand.command.descriptor.value.call(handler, argCommand, this);
    }

    interactive() {

        this.logLine(' == ZenCLI == \n');

        const _interface = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            completer: (line: string) => {
                const completions = <Array<string>>Array.from(CommandRegistry.reconciledCommands).map(c => c[0]).filter(Boolean);//['woo', 'foo', 'bar', 'etc']; // get completions for command
                const hits = completions.filter(c => c.startsWith(line));
                return [ hits.length ? hits : completions, line ];
            }
        });

        // is this going to detect any stdin/out?
        _interface.on('line', line => this.runCommand(line.split(' ')));

    }

    clearCommandCache() {
        CommandRegistry.reset();
        for (let fileName of importedCommands) {
            delete require.cache[fileName];
        }
    }

    importCommands() {

        return new Promise(res => {

            if (!this.commandsDir) throw 'CommandLineApp.importCommands() - no commandsDir';

            this.clearCommandCache();
            // if we allow user to import commands manually they won't be invalidated and there could be multiple references to the same class instance but in different file instances
            // TODO: provide CommandImporter{import, clearCache} as a util for user to consume - we can't reliably handle it ourselves
            // Either we handle ALL commands or user handles All commands - can't reliably have a hybrid system

            readdir(this.commandsDir, { encoding: "utf8" }, (err: NodeJS.ErrnoException, fileNames: Array<string>) => {

                if (err) throw err;

                for (const fileName of fileNames) {
                    if (fileName.endsWith('.js')) {

                        const msg = `Importing command ${fileName}...`;
                        this.logLine(msg);

                        const filePath = resolve(this.commandsDir!, fileName);
                        importedCommands.add(filePath);

                        try {
                            // TODO: this.awaitingCommands = true; // to handle instance references
                            require(filePath);
                            // TODO: this.awaitingCommands = false;
                            this.logLine(`${msg} Done`);
                        } catch (err) {
                            this.logLine(`${msg} Error`);
                            throw err;
                        }

                    }
                }

                CommandRegistry.reconcile();

                this.logLine('');

                res();

            });

        });

    }

}
