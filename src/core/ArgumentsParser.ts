import { ICommandRegistry, RegisteredCommand, CommandNameRegex, RegisteredCommandOption, Type, ICommandArguments } from "./types";
import { Arguments } from "./Arguments";
import kindOf from "kind-of";


export default class ArgumentsParser {

    private readonly registry: ICommandRegistry;
    private readonly args: Array<any>;
    private readonly argv: ReadonlyArray<any>;
    private command: RegisteredCommand | null = null;
    private readonly flags = new Set<string>();
    private readonly options = new Map<string | number, any>();
    private readonly positionals: Array<any> = [];
    private readonly seen = new Set<RegisteredCommandOption>();
    public static readonly FlagRegExp = /^-{1}(?=[^-])/; // '-' in '-f' but not '--f'
    public static readonly OptionRegExp = /^-{2}(?=[^-])/; // '--' in '--o' but not '-o'
    public static readonly FlagValueRegExp = /[^a-zA-Z]/; // non alphabetical characters, case insensitive
    public static readonly StringQuotesRegExp = /^\"{1}|\"{1}$/; // surrounding double quotes in a string
    public static readonly NoNextArg: unique symbol = Symbol('no next arg');

    constructor(registry: ICommandRegistry, args: Array<any>) {
        this.registry = registry;
        this.args = Array.from(args);
        this.argv = Array.from(args);
    }

    public parse(): ICommandArguments {

        // parse/resolve command, then all flags, then remaining arguments

        this.parseCommand();
        this.parseFlags();
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

    private parseCommand(): RegisteredCommand {

        const arg = this.args[0];

        if (!arg || typeof arg !== 'string') {
            // resolve the global default/fallback else error
            let command = this.registry.getCommand('')!;
            if (!command) throw this.error('no command argument passed, and no global default @Command() specified');
            this.command = command;
            return command;
        } else if (CommandNameRegex.test(arg)) {
            let command = this.registry.getCommand(arg)!;
            if (!command) throw this.error(`no command resolved for ${arg}`);
            this.args.shift();
            this.command = command;
            return command;
        } else {
            throw this.error('no command was passed, and no default handler specified');
        }

    }

    private parseFlags() {

        // all items starting with a single dash are flags and are handled as one

        for (let flagGroup of this.args.filter(a => typeof a === 'string' && ArgumentsParser.FlagRegExp.test(a))) {

            flagGroup = flagGroup.replace(ArgumentsParser.FlagRegExp, '');
            if (ArgumentsParser.FlagValueRegExp.test(flagGroup))
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

        const arg = this.args[0];

        if (typeof arg === 'string') {
            if (ArgumentsParser.OptionRegExp.test(arg))
                return this.parseOption();
            if (ArgumentsParser.FlagRegExp.test(arg))
                throw this.error(`[internal] unhandled flag ${arg} found in args`);
        }

        this.parsePositional();

    }

    private parseOption() {

        const arg = this.validateOptionArg(this.args.shift());
        const next = (typeof this.args[0] === 'string' && this.args[0].startsWith('-')) ? ArgumentsParser.NoNextArg : this.args[0];

        const option = this.command!.options.find(o => o.name === arg || o.alias === arg);
        if (!option) throw this.error(`unknown option '--${arg}'`);
        if (this.seen.has(option)) throw this.error(`option '--${arg}' is already declared`);
        this.seen.add(option);

        if (option.positional) throw this.error(`[internal] option --${arg} cannot be configured as positional`);
        if (!option.name) throw this.error(`[internal] option --${arg} name is missing`);
        if (this.options.has(option.name)) throw this.error(`option --${arg} already specified as --${option.name}`);
        if (option.alias && this.options.has(option.alias)) throw this.error(`option --${arg} already specified as --${option.alias}`);
        if (option.flag && this.options.has(option.flag)) throw this.error(`option --${arg} already specified as -${option.flag}`);

        // TODO: handle any option value type
        // if input is string - fallback to standard arg parse type

        // TODO: val could be next or arg - needs handling properly
        let val: any;

        // if next value starts with "-" treat as boolean
        if (next === ArgumentsParser.NoNextArg) {
            if (option.type & Type.Boolean) val = true;
            else val = null;
        } else {
            val = this.parseValue(next, option.type);
            this.args.shift();
        }

        if (typeof val !== 'boolean' && option.flag)
            throw this.error(`[internal] non-boolean option --${arg} cannot have a flag`);

        this.options.set(option.name, val);
        if (option.alias) this.options.set(option.alias, val);
        if (option.flag && val === true && option.type & Type.Boolean)
            this.flags.add(option.flag);

    }

    private parsePositional() {

        const arg = this.args.shift()!;

        const option = this.command!.options.find(o => o.positional && !this.seen.has(o));
        if (!option) throw this.error(`no positional option available for arg ${arg}`);
        this.seen.add(option);

        if (!option.name && !option.alias) throw this.error('[internal] positional must have name and/or alias');
        if (option.flag) throw this.error('[internal] positional cannot specify a flag');

        // positional type could be String | Number
        if (option.type & ~(Type.Number | Type.String))
            throw this.error(`[internal] invalid option type for positional argument`);

        const val = this.parseValue(arg, option.type);

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

    private parseValue(value: any, type: number) {
        // Parse priority: Integer > Number > Boolean > String > Map/Set/Buffer/Array/Object/Function
        if (value === undefined || value === null) return value;
        if (type & Type.Integer && value !== "") {
            if (Number.isInteger(Number(value))) return Number(value);
        }
        if (type & Type.Number && value !== "") {
            if (!Number.isNaN(Number(value))) return Number(value);
        }
        if (type & Type.Boolean && value !== "") {
            if (typeof value === 'boolean') return value;
            if (typeof value === 'string' || typeof value === 'number') {
                switch (value.toString().toLowerCase()) {
                    case 'true': case '1': case 'yes': case 'y': return true;
                    case 'false': case '0': case 'no': case 'n': return false;
                }
            }
        }
        if (type & Type.String) {
            if (typeof value === 'string') {
                if (value.startsWith('"') && value.endsWith('"')) {
                    return value.substring(1, value.length - 1);
                } else {
                    return value;
                }
            }
        }
        if (type & Type.Map) {
            if (kindOf(value) === 'map') return value;
        }
        if (type & Type.Set) {
            if (kindOf(value) === 'set') return value;
        }
        if (type & Type.Buffer) {
            if (kindOf(value) === 'buffer') return value;
        }
        if (type & Type.Array) {
            if (Array.isArray(value)) return value;
            if (typeof value === 'string') return value.split(','); // TODO: proper split - this is very primitive and won't handle escaping or quote boundaries
        }
        if (type & Type.Object) {
            if (typeof value === 'object') return value;
        }
        if (type & Type.Function) {
            if (typeof value === 'function') return value;
        }
        throw this.error(`parseValue error with value or type mismatch got '${kindOf(value)}' but expected typemask ${type}`, 2);
    }

    private get error() { // TODO: refactor out to 'composite-error-handling'
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
