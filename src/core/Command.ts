import { Default, DecoratorResult, TCommandOption, CommandNameRegex, Type, TCommandDecorator, RegisteredCommandOption } from "./types";
import CommandRegistry from "./CommandRegistry";
import { err } from "./Util";

// @CommandHandler()
// - required on any class that handles a command

// @Command()
// - required on any method in a class that handles a command

// for a single main() command:
// @CommandHandler("name", "alias") on class
// @Command([...opts]) on method

// for generic commands in one class:
// @CommandHandler()
// @Command("cmd", ...rest); // method 1
// @Command("other", ...rest); // method 2

// for sub commands
// @CommandHandler("main")
// @Command() // default command for main
// @Command("sub") // main-sub
// @Command("other") // main-other

// default command
function CommandDecorator(): DecoratorResult;
// named command or sub-command
function CommandDecorator(name: string): DecoratorResult;
// named command or sub-command with alias
function CommandDecorator(name: string, alias: string): DecoratorResult;
// default command or sub-command with options
function CommandDecorator(options: TCommandOption[]): DecoratorResult;
// named command or sub-command with options
function CommandDecorator(name: string, options: TCommandOption[]): DecoratorResult;
// named command or sub-command with alias and options
function CommandDecorator(name: string, alias: string, options: TCommandOption[]): DecoratorResult;
function CommandDecorator(nameOrOptions?: string | TCommandOption[], aliasOrOptions?: string | TCommandOption[], commandOptions?: TCommandOption[]): DecoratorResult {

    function decorate(target: object, propertyKey: string, descriptor: PropertyDescriptor): void {

        const { name, alias, options } = validateCommand(propertyKey, nameOrOptions, aliasOrOptions, commandOptions);

        CommandRegistry.registerCommand(
            name,
            alias,
            options,
            target, // target class - target.constructor MUST be registered as a CommandHandler already
            propertyKey, // e.g. 'main'
            descriptor // { enumerable, value etc... }
        );

        return;

    }

    return decorate;

}

(<TCommandDecorator>CommandDecorator).Type = Type;

function CommandHandlerDecorator(): any;
function CommandHandlerDecorator(name: string): any;
function CommandHandlerDecorator(name: string, alias: string): any;
function CommandHandlerDecorator(name: typeof Default): any;
function CommandHandlerDecorator(name?: string | typeof Default, alias?: string): any {

    return function decorate(handlerClass: Function): Function {

        // validate configuration and register command handler
        const e = err(`@CommandHandler() ${handlerClass.name} { }`);

        // validate command name as undefined, Default, or pascal-case
        if (name === undefined) {
            name = Default;
        } else if (typeof name === 'string') {
            if (!CommandNameRegex.test(name))
                throw e("command name is not a valid command name");
        } else if (name !== Default) {
            throw e("command name is invalid");
        }

        // validate alias
        // can't be same as command-name, can't have a duplicate with any other command-name or command-alias
        if (typeof alias === 'string') {
            if (!CommandNameRegex.test(alias))
                throw e("command alias is not a valid command name");
            if (alias === name)
                throw e("command alias cannot be the same as command name");
        } else if (alias !== undefined) {
            throw e("command alias is invalid");
        }

        CommandRegistry.registerHandler(name, alias || null, handlerClass);

        return handlerClass;

    };

}

// Method decorator
export const Command = <TCommandDecorator>CommandDecorator;
// Class decorator
export const CommandHandler = CommandHandlerDecorator;

function validateCommand(propertyKey: string, nameOrOptions?: string | TCommandOption[], aliasOrOptions?: string | TCommandOption[], commandOptions?: TCommandOption[]) {

    const e = err("@Command()");
    let name: string | typeof Default = Default;
    let alias: string | null = null;
    let options: TCommandOption[] = [];

    if (typeof nameOrOptions === "string") {

        if (!CommandNameRegex.test(nameOrOptions))
            throw e(`invalid command name for method "${propertyKey}"`);

        name = nameOrOptions;

        if (typeof aliasOrOptions === "string") {

            if (!CommandNameRegex.test(aliasOrOptions))
                throw e(`invalid command alias for method "${propertyKey}"`);

            alias = aliasOrOptions;

            if (Array.isArray(commandOptions)) {

                options = commandOptions;

            } else if (commandOptions !== undefined) {

                throw e(`invalid arguments for command method "${propertyKey}" (1)`);

            }

        } else if (Array.isArray(aliasOrOptions)) {

            if (commandOptions !== undefined) throw e(`invalid arguments for command method "${propertyKey}" (2)`);
            alias = null;
            options = aliasOrOptions;

        } else if (aliasOrOptions !== undefined) {
            throw e(`invalid arguments for command method "${propertyKey}" (3)`);
        }

    } else if (Array.isArray(nameOrOptions)) {

        if (aliasOrOptions !== undefined || commandOptions !== undefined) throw e(`invalid arguments for command method "${propertyKey}" (4)`);
        options = nameOrOptions;

    } else if (nameOrOptions === undefined) {

        if (aliasOrOptions !== undefined || commandOptions !== undefined)
            throw e(`invalid arguments for command method "${propertyKey}" (5)`);

    } else {

        throw e(`invalid arguments for command method "${propertyKey}" (6)`);

    }

    const validated = [];
    for (let i = 0; i < options.length; i++) {
        const option = validateCommandOption(options[i]);
        if ((option.type & Type.Args) && (i !== options.length - 1))
            throw e("only last option can specify 'Args' type");
        validated.push(option);
    }

    return {
        name: name as typeof Default | string,
        alias,
        options: validated
    };

}

function validateCommandOption(option: TCommandOption): RegisteredCommandOption {

    let name: string | null;
    let alias: string | null;
    let flag: string | null;
    let positional: boolean;
    let type: number;

    // valid configs:
    // 'string'
    // { name?: string, positional: true, type: Number | String }
    // { name: string, alias?: string, flag?: string, type: Boolean | Number | String }

    if (typeof option === "string") {

        if (!CommandNameRegex.test(option))
            throw new Error("validateCommandOption: invalid option name string");

        name = option; // --name
        alias = null;
        flag = null;
        positional = false;
        type = Type.Boolean;

    } else if (option && typeof option === "object") {

        if (option.positional) {

            if (!option.type)
                throw new Error("Positional option must specify a type");
            if (option.flag)
                throw new Error("Positional option cannot specify flag");
            if (option.name && !(CommandNameRegex.test(option.name)))
                throw new Error(`Invalid internal name "${option.name}" on positional option`);

            name = option.name || null;
            alias = option.alias || null;
            flag = null;
            positional = true;
            type = option.type;

        } else {

            if (!option.name || !CommandNameRegex.test(option.name))
                throw new Error("validateCommandOption: invalid option.name");
            if (option.alias !== undefined && (!CommandNameRegex.test(option.alias) || option.alias === option.name))
                throw new Error("validateCommandOption: invalid option.alias");
            if (option.flag !== undefined && (!(/^[a-zA-Z]{1}$/.test(option.flag)) || option.flag === option.name || option.alias === option.flag))
                throw new Error("validateCommandOption: invalid option.flag");
            if (option.flag && !option.type) option.type = Type.Boolean;
            if (!option.type || (option.type & (~(Type.Boolean | Type.Number | Type.String | Type.Integer | Type.Array | Type.Object | Type.Function | Type.Map | Type.Set | Type.Buffer))))
                throw new Error("validateCommandOption: invalid option.type");

            name = option.name;
            alias = option.alias || null;
            flag = option.flag || null;
            positional = false;
            type = option.type;

        }

    } else {
        throw new Error("validateCommandOption: invalid option");
    }

    if ((type & Type.Args) && (type !== Type.Args))
        throw new Error("validateCommandOption: invalid option type - 'Args' type cannot be mixed");

    return { name, alias, flag, positional, type };

}
