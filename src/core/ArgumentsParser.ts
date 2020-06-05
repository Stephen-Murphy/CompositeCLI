import kindOf from "kind-of";
import { ICommandRegistry, RegisteredCommand, CommandNameRegex, RegisteredCommandOption, Type, ICommandArguments } from "./types";
import { Arguments } from "./Arguments";

export default class ArgumentsParser {

    private readonly registry: ICommandRegistry;
    private readonly args: Array<any>;
    private readonly argv: ReadonlyArray<any>;
    private command: RegisteredCommand | null = null;
    private readonly flags = new Set<string>();
    private readonly options = new Map<string | number, any>();
    private readonly positionals: Array<any> = [];
    private readonly seen = new Set<RegisteredCommandOption>();
    public static readonly FlagRegExp = /^-{1}(?=[^-])/; // "-" in "-f" but not "--f"
    public static readonly OptionRegExp = /^-{2}(?=[^-])/; // "--" in "--o" but not "-o"
    public static readonly FlagValueRegExp = /[^a-zA-Z]/; // non alphabetical characters, case insensitive
    public static readonly StringQuotesRegExp = /^\"{1}|\"{1}$/; // surrounding double quotes in a string
    public static readonly ArgSeparator = "--";
    public static readonly NoNextArg: unique symbol = Symbol("no next arg");

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

        if (!arg || typeof arg !== "string") {
            // resolve the global default/fallback else error
            const command = this.registry.getCommand("");
            if (!command) throw new Error("no command argument passed, and no global default @Command() specified");
            this.command = command;
            return command;
        } else if (CommandNameRegex.test(arg)) {
            const command = this.registry.getCommand(arg);
            if (!command) throw new Error(`no command resolved for ${arg}`);
            this.args.shift();
            this.command = command;
            return command;
        } else { // initial option is a flag or option for the default command
            const command = this.registry.getCommand("");
            if (!command) throw new Error("no command was passed, and no default handler specified");
            this.command = command;
            return command;
        }

    }

    private parseFlags(): void {

        // all items starting with a single dash are flags and are grouped together as one for handling

        for (const arg of this.args) {

            if (typeof arg !== "string" || !ArgumentsParser.FlagRegExp.test(arg)) continue;
            if (arg === ArgumentsParser.ArgSeparator) break;

            const flagGroup = arg.replace(ArgumentsParser.FlagRegExp, "");
            if (ArgumentsParser.FlagValueRegExp.test(flagGroup))
                throw new Error(`invalid characters in flags -${flagGroup}`);
            this.args.splice(this.args.indexOf(`-${flagGroup}`), 1);

            for (const flag of flagGroup.split("")) {
                const option = this.command!.options.find(o => o.flag === flag);
                if (!option) throw new Error(`unknown flag -${flag} in group -${flagGroup}`);
                if (this.seen.has(option)) throw new Error(`option ${option.name || option.alias || option.flag} already declared`);
                this.seen.add(option);
                if (this.flags.has(flag)) throw new Error(`flag ${flag} already set`);
                this.flags.add(flag);
                if (option.name) {
                    if (this.options.has(option.name)) throw new Error(`option ${option.name} already set`);
                    this.options.set(option.name, true);
                }
                if (option.alias) {
                    if (this.options.has(option.alias)) throw new Error(`option ${option.alias} already set`);
                    this.options.set(option.alias, true);
                }
            }

        }

    }

    private next(): void {

        const arg = this.args[0];

        if (typeof arg === "string") {
            if (arg === ArgumentsParser.ArgSeparator) {
                const lastOption = this.command!.options[this.command!.options.length - 1];
                if (lastOption && lastOption.type & Type.Args) {
                    // ignore remaining args, pass to options as arg
                    if (!lastOption.name) throw new Error("[internal] option.name for Arg type is missing");
                    const [, ...args] = this.args; // remove ArgSeparator ("--")
                    this.args.length = 0;
                    this.options.set(lastOption.name, args);
                    if (lastOption.alias) this.options.set(lastOption.alias, args);
                    return;
                }
            }
            if (ArgumentsParser.OptionRegExp.test(arg))
                return this.parseOption();
            if (ArgumentsParser.FlagRegExp.test(arg))
                throw new Error(`[internal] unhandled flag ${arg} found in args`);
        }

        return this.parsePositional();

    }

    private parseOption(): void {

        // get next arg name (i.e. "--force" => "force")
        const arg = this.validateOptionArg(this.args.shift());
        // check what next arg is - if it looks like a -flag or --option, next is NoNextArg, arg is boolean auto true
        const next = (!this.args.length || (typeof this.args[0] === "string" && this.args[0].startsWith("-"))) ? ArgumentsParser.NoNextArg : this.args[0];

        const option = this.command!.options.find(o => o.name === arg || o.alias === arg);
        if (!option) throw new Error(`unknown option "--${arg}"`);
        if (this.seen.has(option)) throw new Error(`option "--${arg}" is already declared`);
        this.seen.add(option);

        if (option.positional) throw new Error(`[internal] option --${arg} cannot be configured as positional`);
        if (!option.name) throw new Error(`[internal] option --${arg} name is missing`);
        if (this.options.has(option.name)) throw new Error(`option --${arg} already specified as --${option.name}`);
        if (option.alias && this.options.has(option.alias)) throw new Error(`option --${arg} already specified as --${option.alias}`);
        if (option.flag && this.options.has(option.flag)) throw new Error(`option --${arg} already specified as -${option.flag}`);

        // TODO: handle any option value type
        // if input is string - fallback to standard arg parse type

        // TODO: val could be next or arg - needs handling properly
        let val: any;

        // if next value starts with "-" treat as boolean
        if (next === ArgumentsParser.NoNextArg) {
            if (option.type & Type.Boolean) val = true;
            else val = false;
        } else {
            val = this.parseValue(next, option.type).value;
            this.args.shift();
        }

        if (typeof val !== "boolean" && option.flag)
            throw new Error(`[internal] non-boolean option --${arg} cannot have a flag`);

        this.options.set(option.name, val);
        if (option.alias) this.options.set(option.alias, val);
        if (option.flag && val === true)
            this.flags.add(option.flag);

    }

    private parsePositional(): void {

        const arg = this.args.shift()!;

        const option = this.command!.options.find(o => o.positional && !this.seen.has(o));
        if (!option) throw new Error(`no positional option available for arg ${arg}`);
        this.seen.add(option);

        if (!option.name && !option.alias) throw new Error("[internal] positional must have name and/or alias");
        if (option.flag) throw new Error("[internal] positional cannot specify a flag");

        // positional type could be String | Number
        if (option.type & ~(Type.Number | Type.String))
            throw new Error(`[internal] invalid option type for positional argument`);

        const val = this.parseValue(arg, option.type).value;

        this.options.set(this.positionals.length, val);
        this.positionals.push(val);

        if (option.name) {
            if (this.options.has(option.name)) throw new Error(`positional option "${option.name}" already specified`);
            this.options.set(option.name, val);
        }
        if (option.alias) {
            if (this.options.has(option.alias)) throw new Error(`positional option "${option.alias}" already specified`);
            this.options.set(option.alias, val);
        }

    }

    private parseValue(value: any, type: number): any {

        const vType = typeof value;

        // Parse priority: Integer > Number > Boolean > String > Map/Set/Buffer/Array/Object/Function
        if (value === undefined || value === null) return value;
        if ((type & Type.Null) && value === "null") return null;
        if ((type & Type.Integer) && value !== "") {
            if (Number.isInteger(Number(value))) return Number(value);
        }
        if ((type & Type.Number) && value !== "") {
            if (!Number.isNaN(Number(value))) return Number(value);
        }
        if ((type & Type.Boolean) && value !== "") {
            if (vType === "boolean") return value;
            if (vType === "string" || vType === "number") {
                switch (value.toString().toLowerCase()) { // should only be on type YesOrNo
                    case "true": case "1": case "yes": case "y": return true;
                    case "false": case "0": case "no": case "n": return false;
                    default: break;
                }
            }
        }
        if (type & Type.Array) {
            if (Array.isArray(value)) return value;
            if (vType === "string") return value.split(","); // TODO: proper split - this is very primitive and won't handle escaping or quote boundaries
        }
        if (type & Type.Map) {
            if (value instanceof Map) return value;
        }
        if (type & Type.Set) {
            if (value instanceof Set) return value;
        }
        if (type & Type.Buffer) {
            if (value instanceof Buffer) return value;
        }
        if (type & Type.Function) {
            if (vType === "function") return value;
        }
        if (type & Type.Object) {
            if (vType === "object") return value;
        }
        if (type & Type.String) {
            if (vType === "string") {
                if (value.startsWith("\"") && value.endsWith("\"")) {
                    return value.substring(1, value.length - 1);
                } else {
                    return value;
                }
            }
        }

        throw new Error(`parseValue error with value or type mismatch got "${kindOf(value)}" but expected typemask ${type}`);

    }

    private validateOptionArg(arg?: string): string {
        // TODO: update to allow arg=x, --arg=x, --arg x (updates required elsewhere as well)
        if (!arg || !arg.startsWith("--") || !CommandNameRegex.test(arg.replace("--", "")))
            throw new Error(`invalid option "${arg}"`).message;
        return arg.replace(/^--/, "");
    }

}
