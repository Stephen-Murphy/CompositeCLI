import { RegisteredCommandHandler, Default, RegisteredCommandOption, RegisteredCommand, ICommandRegistry } from "./types";


// TODO: make all imported commands fully readonly as they are passed in IArguments

class CommandRegistry implements ICommandRegistry {

    public readonly handlers: Array<RegisteredCommandHandler> = [];
    public readonly commands: Array<RegisteredCommand> = [];
    public readonly reconciledCommands: Map<string, RegisteredCommand> = new Map();

    public constructor() { }

    public reset() {
        this.handlers.length = 0;
        this.commands.length = 0;
        this.reconciledCommands.clear();
    }

    // registerHandler
    public registerHandler(name: string | typeof Default, alias: string | null, handlerClass: Function) {

        if (this.hasHandler(handlerClass))
            throw `CommandRegistry.registerHandler() - handler ${handlerClass.name} is already registered`;

        const handler: RegisteredCommandHandler = {
            command: name,
            alias: alias,
            handlerClass: handlerClass,
            methods: []
        };

        this.handlers.push(handler);

    }

    public registerCommand(command: string | typeof Default, alias: string | null, options: RegisteredCommandOption[], target: object, method: string, descriptor: PropertyDescriptor) {

        // input already safe/valid

        // create new method and add to internal registry
        // we can't check for the handler yet because the method decorators are executed before class decorators
        this.commands.push({ // TODO: DeepReadonly({...})
            command,
            alias,
            method,
            options,
            target,
            descriptor
        });

    }

    public reconcile() {
        // assign all commands to their handlers (and ensure no duplicate commands per handler, and that all commands have a handler)
        this.commands.forEach(command => {
            const handler = this.handlers.find(h => h.handlerClass === command.target.constructor);
            if (!handler) throw `CommandRegistry: error reconciling commands - no handler was defined for command ${command.command.toString()}`;
            if (handler.methods.find(m => m.command === command.command)) throw `CommandRegistry: error reconciling commands - duplicate command '${command.command.toString()}' in handler '${handler.command.toString()}'`;
            handler.methods.push(command);
        });
        // ensure all handlers have at least one command
        this.handlers.forEach(handler => {
            if (!handler.methods.length) throw `${handler.command.toString()} has no registered @Commands()`;
        });
        // ensure no duplicate paths exist
        for (let handler of this.handlers) {
            for (let method of handler.methods) {

                let command: string;
                let alias: string | null;

                if (handler.command === Default) {
                    if (method.command === Default) {
                        command = '';
                        alias = null;
                    } else {
                        command = method.command;
                        alias = method.alias;
                    }
                } else {
                    if (method.command === Default) {
                        command = handler.command;
                        alias = handler.alias;
                    } else {
                        command = `${handler.command}-${method.command}`;
                        //                                          alias without dash(?) i.e. cc instead of create-component
                        alias = handler.alias ? method.alias ? `${handler.alias}${method.alias}` : handler.alias : null;
                    }
                }

                if (this.reconciledCommands.has(command))
                    throw `CommandRegistry: duplicate command "${command || Default.toString()}"`;
                this.reconciledCommands.set(command, method);

                if (alias) {
                    if (this.reconciledCommands.has(alias))
                        throw `CommandRegistry: alias "${alias}" already exists or is the same as a command`;
                    this.reconciledCommands.set(alias, method);
                }

            }
        }
        // aggregate all command handlers into groups of handler.command then check within those for duplicates
    }

    // getHandler
    public hasHandler(handler: Function) {
        return !!this.handlers.find(h => h.handlerClass === handler);
    }

    public resolveCommand(command: string): RegisteredCommand | null {
        return this.reconciledCommands.get(command) || null;
    }

}

export default new CommandRegistry();
