import { ICommandRegistry, RegisteredCommand, CommandNameRegex, RegisteredCommandOption, Type, ICommandArguments } from "./types";
import { Arguments } from "./Arguments";


export default class ArgumentsParser {

    private readonly registry: ICommandRegistry;
    private readonly args: string[];
    private readonly argv: ReadonlyArray<string>;
    private command: RegisteredCommand | null = null; // remaining resolvable commands - gets narrowed as we progress and should end up with only one
    private readonly flags = new Set<string>();
    private readonly options = new Map<string | number, string | number | boolean | null>();
    private readonly positionals: Array<string | number | boolean | null> = [];
    private readonly seen = new Set<RegisteredCommandOption>();
    // need to store a positional count and decrement it each time we parse a positional
    // ...because the error 'positional already handled' is invalid as it suggests that an additional variable argument that has been passed is a duplicate, rather than an invalid option

    constructor(registry: ICommandRegistry, args: string[]) {
        this.registry = registry;
        this.args = Array.from(args);
        this.argv = Array.from(args);
    }

    public parse(): ICommandArguments {

        // first parse and resolve command
        this.resolveCommand();

        // then parse all flags
        this.parseFlags();

        // then parse all the rest of the arguments
        while (this.args.length) {
            this.next();
        }

        return new Arguments(
            this.command!,
            this.argv,
            this.flags,
            this.options,
            this.positionals
        );

    }

    private resolveCommand(): RegisteredCommand {

        const arg = this.args[0] || '';

        let command: RegisteredCommand;

        if (CommandNameRegex.test(arg)) {
            command = this.registry.resolveCommand(arg)!;
            if (!command) throw this.error(`no command resolved for ${arg}`);
            this.args.shift();
            this.command = command;
            return command;
        } else if (!arg) {
            // resolve the global default/fallback else error
            command = this.registry.resolveCommand('')!;
            if (!command) throw this.error('no command argument passed, and no global default @Command() specified');
            this.command = command;
            return command;
        } else {
            throw this.error('no command was passed, and no default handler specified');
        }

    }

    private parseFlags() {

        // all items starting with a single dash should be merged into one
        // if strict mode do not allow duplicates
        // then narrow types(?) or wait for command(?)

        for (let flagGroup of this.args.filter(a => /^-{1}(?=[^-])/.test(a))) {

            flagGroup = flagGroup.replace(/^-{1}/, '');
            if (/[^a-zA-Z]/g.test(flagGroup))
                throw this.error(`invalid characters in flags -${flagGroup}`);
            this.args.splice(this.args.indexOf(`-${flagGroup}`), 1);

            for (const flag of flagGroup.split('')) {
                const option = this.command!.options.find(o => o.flag === flag);
                if (!option) throw this.error(`unknown flag -${flag} in group -${flagGroup}`);
                if (this.seen.has(option)) throw this.error(`option ${option.name || option.alias || option.flag} already declared`);
                this.seen.add(option);
                if (this.flags.has(flag)) throw this.error(`flag ${flag} already set`);
                this.flags.add(flag);
                if (option.name) {
                    if (this.options.has(option.name)) throw this.error(`option ${option.name} already set`);
                    this.options.set(option.name, true);
                }
                if (option.alias) {
                    if (this.options.has(option.alias)) throw this.error(`option ${option.alias} already set`);
                    this.options.set(option.alias, true);
                }
            }

        }

    }

    private next() {

        const arg = this.args[0]!;
        if (!arg) throw this.error('no next argument to parse');

        if (/^-{2}(?=[^-])/.test(arg)) {
            this.parseOption(); // handles option value if present
            return;
        }

        if (/^-{1}(?=[^-])/.test(arg))
            throw this.error(`[internal] unhandled flag ${arg} found in args`);

        this.parsePositional();

    }

    private parseOption() {

        const arg = this.validateOptionArg(this.args.shift());
        const next = this.args[0];

        const option = this.command!.options.find(o => o.name === arg || o.alias === arg);
        if (!option) throw this.error(`unknown option '--${arg}'`);
        if (this.seen.has(option)) throw this.error(`option '--${arg}' is already declared`);
        this.seen.add(option);

        if (option.positional) throw this.error(`[internal] option --${arg} cannot be configured as positional`);
        if (!option.name) throw this.error(`[internal] option --${arg} name is missing`);
        if (this.options.has(option.name)) throw this.error(`option --${arg} already specified as --${option.name}`);
        if (option.alias && this.options.has(option.alias)) throw this.error(`option --${arg} already specified as --${option.alias}`);
        if (option.flag && this.options.has(option.flag)) throw this.error(`option --${arg} already specified as -${option.flag}`);

        if (option.type & (Type.String | Type.Number)) {

            if (option.flag) throw this.error(`[internal] option --${arg} string or number option cannot have a flag`);
            if (!next || next.startsWith('-')) throw this.error(`missing value for option --${arg}`);

            const val: string | number = this.parseValue(arg, option.type);

            this.options.set(option.name, val);
            if (option.alias) this.options.set(option.alias, val);
            this.args.shift(); // consume option val

        } else if (option.type & Type.Boolean) {

            this.options.set(option.name, true);
            if (option.alias) this.options.set(option.alias, true);
            if (option.flag) {
                if (this.flags.has(option.flag)) throw this.error(`flag for option --${arg} already declared`);
                this.flags.add(option.flag);
            }

        } else {
            throw this.error(`[internal] invalid option type configuration for --${arg}`);
        }

    }

    private parsePositional() {

        const arg = this.args.shift()!;

        const option = this.command!.options.find(o => o.positional && !this.seen.has(o));
        if (!option) throw this.error(`no positional option available for arg ${arg}`);
        if (this.seen.has(option)) throw this.error(`positional option already handled`);
        this.seen.add(option);

        if (!option.name && !option.alias) throw this.error('[internal] positional must have name and/or alias');
        if (option.flag) throw this.error('[internal] positional cannot specify a flag');

        // positional type could be String | Number
        if (option.type & ~(Type.Number | Type.String))
            throw this.error(`[internal] invalid option type for positional argument`);

        const val: string | number = this.parseValue(arg, option.type);

        // assign positional in options and positionals
        this.options.set(this.positionals.length, val);
        this.positionals.push(val);

        if (option.name) {
            if (this.options.has(option.name)) throw this.error(`positional option '${option.name}' already specified`);
            this.options.set(option.name, val);
        }
        if (option.alias) {
            if (this.options.has(option.alias)) throw this.error(`positional option '${option.alias}' already specified`);
            this.options.set(option.alias, val);
        }

    }

    private parseValue(value: string, type: number) {
        if (type & Type.Number && !Number.isNaN(Number(value))) {
            return Number(value);
        }
        if (type & Type.String) {
            if (value.startsWith('"') && value.endsWith('"')) {
                return value.replace(/^\"{1}|\"{1}$/, '');
            } else {
                return value;
            }
        }
        throw this.error('parseValue error with value or type mismatch', 2);
    }

    private get error() {
        return (msg: string, stacks: number = 1) => {
            debugger; // need to check - this is a getter so the invocation of the error might not be correct
            const err = new Error();
            const t = err.stack!.split('\n')[1 + stacks].split(' ')[5]; // ಠ_ಠ
            err.message = `${t}() - ${msg}`;
            return err;
        };
    }

    private validateOptionArg(arg?: string): string {
        if (!arg || !arg.startsWith('--') || !CommandNameRegex.test(arg.replace('--', '')))
            throw this.error(`invalid option "${arg}"`, 2);
        return arg.replace('--', '');
    }

}
