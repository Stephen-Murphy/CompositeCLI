import { readdir } from "fs";
import { resolve } from "path";
import { RegisteredCommandHandler, Default, RegisteredCommandOption, RegisteredCommand, ICommandRegistry, ICommandLineApp, Fallback } from "./types";

const importedCommands = new Set<string>();

class CommandRegistry implements ICommandRegistry {

    public readonly handlers: Array<RegisteredCommandHandler> = [];
    public readonly commands: Array<RegisteredCommand> = [];
    public readonly reconciledCommands: Map<string | typeof Fallback, RegisteredCommand> = new Map();
    private readonly pendingCommands = new Set<RegisteredCommand>();

    public constructor() { }

    public reset(clearCache = false) {
        this.handlers.length = 0;
        this.commands.length = 0;
        this.reconciledCommands.clear();
        this.pendingCommands.clear();
        if (clearCache) {
            for (const fileName of importedCommands) {
                delete require.cache[fileName]; // fileName already absolute - require.resolve not needed
            }
        }
    }

    public registerHandler(name: string | typeof Default, alias: string | null, handlerClass: Function) {

        if (this.handlers.find(h => h.handlerClass === handlerClass))
            throw new Error(`CommandRegistry.registerHandler() - handler ${handlerClass.name} is already registered`);

        const handler: RegisteredCommandHandler = {
            command: name,
            alias: alias,
            handlerClass: handlerClass,
            methods: []
        };

        if (!this.pendingCommands.size)
            throw new Error(`@CommandHandler ${name.toString()} has no registered @Commands`);

        this.pendingCommands.forEach(command => {

            if (command.target.constructor !== handlerClass)
                throw new Error(`No CommandHandler registered for Command ${name.toString()}`);
            if (handler.methods.find(m => m.command === command.command))
                throw new Error(`CommandRegistry: error reconciling commands - duplicate command '${command.command.toString()}' in handler '${handler.command.toString()}'`);

            handler.methods.push(command);
            this.commands.push(command);

        });

        this.pendingCommands.clear();

        for (const method of handler.methods) {

            let command: string | typeof Fallback;
            let alias: string | null;

            if (handler.command === Default) {
                if (method.command === Default) {
                    command = "";
                    alias = null;
                } else {
                    command = method.command;
                    alias = method.alias;
                }
            } else {
                if (method.command === Default) {
                    command = handler.command;
                    alias = handler.alias;
                } else if (typeof method.command === "string") {
                    command = `${handler.command}-${method.command}`;
                    //                                          alias without dash(?) i.e. cc instead of create-component
                    alias = handler.alias ? method.alias ? `${handler.alias}${method.alias}` : handler.alias : null;
                } else {
                    throw new Error("Fallback command can only appear on a blank/default handler");
                }
            }

            if (this.reconciledCommands.has(command))
                throw new Error(`CommandRegistry: duplicate command "${command.toString() || Default.toString()}"`);
            this.reconciledCommands.set(command, method);

            if (alias) {
                if (this.reconciledCommands.has(alias))
                    throw new Error(`CommandRegistry: alias "${alias}" already exists or is the same as a command`);
                this.reconciledCommands.set(alias, method);
            }

        }

        this.handlers.push(handler);

    }

    public registerCommand(command: string | typeof Default | typeof Fallback, alias: string | null, options: RegisteredCommandOption[], target: object, method: string, descriptor: PropertyDescriptor) {

        this.pendingCommands.add({
            command,
            alias,
            method,
            options,
            target,
            descriptor
        });

    }

    public getCommand(command: string): RegisteredCommand | null {
        return this.reconciledCommands.get(command) || null;
    }

    public importCommands(commandsDir: string, app: ICommandLineApp) {

        return new Promise(res => {

            if (!commandsDir) throw new Error("CommandLineApp.importCommands() - no commandsDir");

            this.reset(true);
            // if we allow user to import commands manually they won't be invalidated and there could be multiple references to the same class instance but in different file instances
            // TODO: provide CommandImporter{import, clearCache} as a util for user to consume - we can't reliably handle it ourselves
            // Either we handle ALL commands or user handles All commands - can't reliably have a hybrid system

            readdir(commandsDir, { encoding: "utf8" }, (err: NodeJS.ErrnoException, fileNames: Array<string>) => {

                if (err) throw err;

                for (const fileName of fileNames) {
                    if (fileName.endsWith(".js")) {

                        const msg = `Importing command ${fileName}...`;
                        app.logLine(msg);

                        const filePath = resolve(commandsDir!, fileName);
                        importedCommands.add(filePath);

                        try {
                            // TODO: this.awaitingCommands = true; // to handle instance references
                            require(filePath);
                            // TODO: this.awaitingCommands = false;
                            app.logLine(`${msg} Done`);
                        } catch (err) {
                            app.logLine(`${msg} Error`);
                            throw err;
                        }

                    }
                }

                app.logLine("");

                res();

            });

        });

    }

}

export default new CommandRegistry();
