import { ICommandRegistry, RegisteredCommand, CommandNameRegex, RegisteredCommandOption, Type, ICommandArguments } from "./types";
import { Arguments } from "./Arguments";
import kindOf from "kind-of";
import { Result, ResultHandler } from "result-handler";


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
    public static readonly NoNextArg: unique symbol = Symbol("no next arg");
    private readonly _handler: ResultHandler;

    constructor(registry: ICommandRegistry, args: Array<any>) {
        this.registry = registry;
        this.args = Array.from(args);
        this.argv = Array.from(args);
        this._handler = Result.Handler(ArgumentsParser);
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

    private parseCommand(): Result<RegisteredCommand> {

        const result = this._handler<RegisteredCommand>(this.parseCommand);
        const arg = this.args[0];

        if (!arg || typeof arg !== "string") {
            // resolve the global default/fallback else error
            const command = this.registry.getCommand("");
            if (!command) return result.throw("no command argument passed, and no global default @Command() specified");
            this.command = command;
            return result.success(command);
        } else if (CommandNameRegex.test(arg)) {
            const command = this.registry.getCommand(arg);
            if (!command) return result.throw(`no command resolved for ${arg}`);
            this.args.shift();
            this.command = command;
            return result.success(command);
        } else { // initial option is a flag or option for the default command
            const command = this.registry.getCommand("");
            if (!command) return result.throw("no command was passed, and no default handler specified");
            return result.success(command);
        }

    }

    private parseFlags(): Result {

        // all items starting with a single dash are flags and are handled as one

        const result = this._handler(this.parseFlags);

        for (let flagGroup of this.args.filter(a => typeof a === "string" && ArgumentsParser.FlagRegExp.test(a))) {

            flagGroup = flagGroup.replace(ArgumentsParser.FlagRegExp, "");
            if (ArgumentsParser.FlagValueRegExp.test(flagGroup))
                return result.throw(`invalid characters in flags -${flagGroup}`);
            this.args.splice(this.args.indexOf(`-${flagGroup}`), 1);

            for (const flag of flagGroup.split("")) {
                const option = this.command!.options.find(o => o.flag === flag);
                if (!option) return result.throw(`unknown flag -${flag} in group -${flagGroup}`);
                if (this.seen.has(option)) return result.throw(`option ${option.name || option.alias || option.flag} already declared`);
                this.seen.add(option);
                if (this.flags.has(flag)) return result.throw(`flag ${flag} already set`);
                this.flags.add(flag);
                if (option.name) {
                    if (this.options.has(option.name)) return result.throw(`option ${option.name} already set`);
                    this.options.set(option.name, true);
                }
                if (option.alias) {
                    if (this.options.has(option.alias)) return result.throw(`option ${option.alias} already set`);
                    this.options.set(option.alias, true);
                }
            }

        }

        return result.success();

    }

    private next(): Result {

        const arg = this.args[0];

        if (typeof arg === "string") {
            if (ArgumentsParser.OptionRegExp.test(arg))
                return this.parseOption();
            if (ArgumentsParser.FlagRegExp.test(arg))
                throw this._handler(this.next).throw(`[internal] unhandled flag ${arg} found in args`);
        }

        return this.parsePositional();

    }

    private parseOption(): Result {

        const result = this._handler(this.parseOption);

        // get next arg name (i.e. "--force" => "force")
        const arg = this.validateOptionArg(this.args.shift());
        // check what next arg is - if it looks like a -flag or --option, next is NoNextArg, arg is boolean auto true
        const next = (!this.args.length || (typeof this.args[0] === "string" && this.args[0].startsWith("-"))) ? ArgumentsParser.NoNextArg : this.args[0];

        const option = this.command!.options.find(o => o.name === arg || o.alias === arg);
        if (!option) return result.throw(`unknown option "--${arg}"`);
        if (this.seen.has(option)) return result.throw(`option "--${arg}" is already declared`);
        this.seen.add(option);

        if (option.positional) return result.throw(`[internal] option --${arg} cannot be configured as positional`);
        if (!option.name) return result.throw(`[internal] option --${arg} name is missing`);
        if (this.options.has(option.name)) return result.throw(`option --${arg} already specified as --${option.name}`);
        if (option.alias && this.options.has(option.alias)) return result.throw(`option --${arg} already specified as --${option.alias}`);
        if (option.flag && this.options.has(option.flag)) return result.throw(`option --${arg} already specified as -${option.flag}`);

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
            return result.throw(`[internal] non-boolean option --${arg} cannot have a flag`);

        this.options.set(option.name, val);
        if (option.alias) this.options.set(option.alias, val);
        if (option.flag && val === true)
            this.flags.add(option.flag);

        return result.success();

    }

    private parsePositional(): Result {

        const result = this._handler(this.parsePositional);
        const arg = this.args.shift()!;

        const option = this.command!.options.find(o => o.positional && !this.seen.has(o));
        if (!option) return result.throw(`no positional option available for arg ${arg}`);
        this.seen.add(option);

        if (!option.name && !option.alias) return result.throw("[internal] positional must have name and/or alias");
        if (option.flag) return result.throw("[internal] positional cannot specify a flag");

        // positional type could be String | Number
        if (option.type & ~(Type.Number | Type.String))
            return result.throw(`[internal] invalid option type for positional argument`);

        const val = this.parseValue(arg, option.type).value;

        this.options.set(this.positionals.length, val);
        this.positionals.push(val);

        if (option.name) {
            if (this.options.has(option.name)) return result.throw(`positional option "${option.name}" already specified`);
            this.options.set(option.name, val);
        }
        if (option.alias) {
            if (this.options.has(option.alias)) return result.throw(`positional option "${option.alias}" already specified`);
            this.options.set(option.alias, val);
        }

        return result.success();

    }

    private parseValue(value: any, type: number): Result<any> {

        const result = this._handler(this.parseValue);

        // Parse priority: Integer > Number > Boolean > String > Map/Set/Buffer/Array/Object/Function
        if (value === undefined || value === null) return result.success(value);
        if (type & Type.Integer && value !== "") {
            if (Number.isInteger(Number(value))) return result.success(Number(value));
        }
        if (type & Type.Number && value !== "") {
            if (!Number.isNaN(Number(value))) return result.success(Number(value));
        }
        if (type & Type.Boolean && value !== "") {
            if (typeof value === "boolean") return result.success(value);
            if (typeof value === "string" || typeof value === "number") {
                switch (value.toString().toLowerCase()) { // should only be on type YesOrNo
                    case "true": case "1": case "yes": case "y": return result.success(true);
                    case "false": case "0": case "no": case "n": return result.success(false);
                    default: break; // TODO: should this fall through or error?
                }
            }
        }
        if (type & Type.String) {
            if (typeof value === "string") {
                if (value.startsWith("\"") && value.endsWith("\"")) {
                    return result.success(value.substring(1, value.length - 1));
                } else {
                    return result.success(value);
                }
            }
        }
        if (type & Type.Map) {
            if (kindOf(value) === "map") return result.success(value);
        }
        if (type & Type.Set) {
            if (kindOf(value) === "set") return result.success(value);
        }
        if (type & Type.Buffer) {
            if (kindOf(value) === "buffer") return result.success(value);
        }
        if (type & Type.Array) {
            if (Array.isArray(value)) return result.success(value);
            if (typeof value === "string") return result.success(value.split(",")); // TODO: proper split - this is very primitive and won't handle escaping or quote boundaries
        }
        if (type & Type.Object) {
            if (typeof value === "object") return result.success(value);
        }
        if (type & Type.Function) {
            if (typeof value === "function") return result.success(value);
        }

        return result.throw(`parseValue error with value or type mismatch got "${kindOf(value)}" but expected typemask ${type}`);

    }

    private validateOptionArg(arg?: string): string {
        // TODO: update to allow arg=x, --arg=x, --arg x (updates required elsewhere as well)
        if (!arg || !arg.startsWith("--") || !CommandNameRegex.test(arg.replace("--", "")))
            throw this._handler(this.validateOptionArg).failure(`invalid option "${arg}"`).message;
        return arg.replace(/^--/, "");
    }

}
